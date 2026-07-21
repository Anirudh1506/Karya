import type { EntityId } from "@karya/types";
import type {
  KspCapability,
  KspConformanceAdapter,
  KspConformanceAdapterFactory,
  KspDiagnostic,
  KspErrorCode,
  KspFault,
  KspMetrics,
  KspNegotiatedSession,
  KspOperationAcknowledgement,
  KspOperationEnvelope,
  KspReplayAcknowledgement,
  KspReplayWindow,
  KspSessionAdapter,
  KspSessionRequest,
  KspSessionState,
  KspTransportProfile,
  KspUploadAcknowledgement,
  KspUploadBatch,
  KspVersion,
} from "./contracts";
import { KspProtocolError } from "./contracts";
import { orderEnvelopes, sameEnvelope } from "./ordering";

const supportedVersion: KspVersion = { major: 1, minor: 0 };
const supportedEnvelopeVersions = new Set([1]);
const supportedCapabilities = new Map([
  ["background-sync", 1],
  ["checkpoint", 1],
]);

export class ReferenceKspAdapterFactory implements KspConformanceAdapterFactory {
  readonly id = "karya-ksp-reference";

  create(profile: KspTransportProfile = "loopback"): KspConformanceAdapter {
    return new ReferenceKspAdapter(profile);
  }
}

export class ReferenceKspAdapter implements KspConformanceAdapter {
  readonly id: string;
  private readonly operations = new Map<EntityId, KspOperationEnvelope>();
  private readonly stream: EntityId[] = [];
  private readonly revokedDevices = new Set<EntityId>();
  private readonly seenDevices = new Set<EntityId>();
  private readonly faults = new Map<KspFault, number>();
  private readonly diagnosticLog: KspDiagnostic[] = [];
  private readonly metricValues: KspMetrics = emptyMetrics();
  private cursorGeneration = 1;
  private nextSession = 1;
  private nextDiagnostic = 1;

  constructor(readonly profile: KspTransportProfile = "loopback") {
    this.id = `karya-ksp-reference:${profile}`;
  }

  async connect(request: KspSessionRequest): Promise<KspSessionAdapter> {
    if (this.seenDevices.has(request.deviceId)) this.metricValues.reconnects += 1;
    this.seenDevices.add(request.deviceId);
    this.metricValues.sessionsStarted += 1;
    const transitions: KspSessionState[] = ["idle", "connecting", "authenticating"];
    this.record("connection.request", request.correlationId);
    this.failIfFault("maintenance", request.correlationId);
    this.failIfFault("network-failure", request.correlationId);

    if (!request.authenticated) {
      transitions.push("rejected");
      this.reject("unauthenticated", "state-change", request.correlationId, "Authentication proof was not accepted");
    }

    transitions.push("authorizing");
    if (this.revokedDevices.has(request.deviceId)) {
      transitions.push("rejected");
      this.reject("device-revoked", "state-change", request.correlationId, "Device membership is revoked");
    }
    if (!request.trusted) {
      transitions.push("rejected");
      this.reject("device-untrusted", "state-change", request.correlationId, "Device membership is not trusted");
    }
    if (!request.authorized) {
      transitions.push("rejected");
      this.reject("unauthorized", "state-change", request.correlationId, "Account stream access was denied");
    }

    transitions.push("negotiating");
    const version = negotiateVersion(request);
    const envelopeVersion = negotiateEnvelope(request);
    const capabilities = negotiateCapabilities(request.capabilities);
    const sessionId = `session:${this.profile}:${this.nextSession++}`;
    const negotiated: KspNegotiatedSession = {
      sessionId,
      accountId: request.accountId,
      deviceId: request.deviceId,
      version,
      envelopeVersion,
      capabilities,
      maximumBatchSize: profileBatchSize(this.profile),
      state: "ready",
      correlationId: request.correlationId,
    };
    transitions.push("ready");
    this.metricValues.sessionsReady += 1;
    this.record("session.ready", request.correlationId, sessionId, this.profile);
    return new ReferenceKspSession(this, request, negotiated, transitions);
  }

  async handleExtension(type: string, required: boolean, correlationId: string): Promise<"ignored"> {
    if (required) {
      this.reject("capability-unsupported", "state-change", correlationId, `Required message is unknown: ${type}`);
    }
    this.record("extension.ignored", correlationId, undefined, type);
    return "ignored";
  }

  injectFault(fault: KspFault, count = 1): void {
    this.faults.set(fault, Math.max(0, count));
  }

  revokeDevice(deviceId: EntityId): void {
    this.revokedDevices.add(deviceId);
  }

  expireCursors(): void {
    this.cursorGeneration += 1;
  }

  diagnostics(): readonly KspDiagnostic[] {
    return this.diagnosticLog.map((item) => ({ ...item }));
  }

  metrics(): Readonly<KspMetrics> {
    return { ...this.metricValues, errors: { ...this.metricValues.errors } };
  }

  assertSession(session: KspNegotiatedSession, correlationId: string): void {
    if (this.revokedDevices.has(session.deviceId)) {
      this.reject("device-revoked", "state-change", correlationId, "Device membership was revoked");
    }
    this.failIfFault("expired-session", correlationId, "session-expired");
    this.failIfFault("maintenance", correlationId);
    this.failIfFault("network-failure", correlationId);
  }

  acceptUpload(
    session: KspNegotiatedSession,
    request: KspSessionRequest,
    batch: KspUploadBatch,
  ): KspUploadAcknowledgement {
    this.assertSession(session, batch.correlationId);
    if (batch.operations.length > session.maximumBatchSize) {
      this.reject("invalid-message", "never", batch.correlationId, "Batch exceeds negotiated operation limit");
    }
    this.metricValues.operationsOffered += batch.operations.length;
    const acknowledgements: KspOperationAcknowledgement[] = [];
    const deferOne = this.consumeFault("dependency-failure");

    for (const [index, operation] of batch.operations.entries()) {
      if (deferOne && index === batch.operations.length - 1) {
        acknowledgements.push({
          operationId: operation.operationId,
          outcome: "deferred",
          error: "dependency-unavailable",
        });
        this.addError("dependency-unavailable");
        continue;
      }
      const invalid = validateEnvelope(operation, session, request);
      if (invalid) {
        acknowledgements.push({ operationId: operation.operationId, outcome: "rejected", error: invalid });
        this.addError(invalid);
        continue;
      }
      const existing = this.operations.get(operation.operationId);
      if (existing) {
        if (!sameEnvelope(existing, operation)) {
          this.reject(
            "operation-identity-conflict",
            "never",
            batch.correlationId,
            `Operation identity conflict: ${operation.operationId}`,
          );
        }
        acknowledgements.push({ operationId: operation.operationId, outcome: "already-accepted" });
        this.metricValues.operationsAlreadyAccepted += 1;
        continue;
      }
      this.operations.set(operation.operationId, cloneEnvelope(operation));
      this.stream.push(operation.operationId);
      acknowledgements.push({ operationId: operation.operationId, outcome: "accepted" });
      this.metricValues.operationsAccepted += 1;
    }

    const acknowledgement = {
      batchId: batch.batchId,
      operations: acknowledgements,
      correlationId: batch.correlationId,
    } satisfies KspUploadAcknowledgement;
    this.record("upload.accepted", batch.correlationId, session.sessionId, `operations:${acknowledgements.length}`);
    if (this.consumeFault("lost-upload-response")) {
      this.metricValues.retries += 1;
      this.raise("transport-failure", "reconnect", batch.correlationId, "Upload response was lost after acceptance");
    }
    return acknowledgement;
  }

  createReplayWindow(
    session: KspNegotiatedSession,
    request: KspSessionRequest,
    cursor: string | undefined,
    limit: number,
    correlationId: string,
  ): KspReplayWindow {
    this.assertSession(session, correlationId);
    const offset = this.readCursor(cursor, session);
    const maximum = Math.max(1, Math.min(limit, session.maximumBatchSize));
    const selected: KspOperationEnvelope[] = [];
    let nextOffset = offset;

    while (nextOffset < this.stream.length && selected.length < maximum) {
      const operation = this.operations.get(this.stream[nextOffset]);
      nextOffset += 1;
      if (!operation || operation.originDeviceId === session.deviceId) continue;
      if (operation.accountId !== session.accountId) continue;
      if (!supportsOperation(request, operation)) {
        this.reject(
          "operation-version-unsupported",
          "state-change",
          correlationId,
          `Operation version is not supported: ${operation.operationType}`,
        );
      }
      selected.push(cloneEnvelope(operation));
    }

    const window: KspReplayWindow = {
      batchId: `replay:${session.deviceId}:${offset}:${nextOffset}`,
      operations: orderEnvelopes(selected),
      candidateCursor: this.cursor(session, nextOffset),
      complete: nextOffset >= this.stream.length,
      correlationId,
    };
    this.metricValues.operationsDownloaded += selected.length;
    this.record("download.window", correlationId, session.sessionId, `operations:${selected.length}`);
    return window;
  }

  acknowledgeReplay(session: KspNegotiatedSession, acknowledgement: KspReplayAcknowledgement): void {
    this.assertSession(session, acknowledgement.correlationId);
    this.readCursor(acknowledgement.candidateCursor, session);
    if (!acknowledgement.complete) {
      this.reject("replay-required", "immediate", acknowledgement.correlationId, "Replay window is incomplete");
    }
    this.metricValues.operationsReplayed += acknowledgement.operationIds.length;
    this.record(
      "replay.acknowledged",
      acknowledgement.correlationId,
      session.sessionId,
      `operations:${acknowledgement.operationIds.length}`,
    );
  }

  shouldDuplicateDownload(): boolean {
    const duplicate = this.consumeFault("duplicate-download");
    if (duplicate) this.metricValues.duplicateDeliveries += 1;
    return duplicate;
  }

  shouldFailBootstrap(correlationId: string): boolean {
    if (!this.consumeFault("bootstrap-failure")) return false;
    this.addError("transport-failure");
    this.record("bootstrap.interrupted", correlationId);
    return true;
  }

  record(type: string, correlationId: string, sessionId?: EntityId, detail?: string): void {
    this.diagnosticLog.push({
      sequence: this.nextDiagnostic++,
      type,
      correlationId,
      sessionId,
      detail,
    });
  }

  incrementReconnect(): void {
    this.metricValues.reconnects += 1;
  }

  incrementBootstrapStarted(): void {
    this.metricValues.bootstrapStarted += 1;
  }

  incrementBootstrapCompleted(): void {
    this.metricValues.bootstrapCompleted += 1;
  }

  private cursor(session: KspNegotiatedSession, offset: number): string {
    return `opaque.${this.cursorGeneration}.${session.accountId}.${session.deviceId}.${offset}.ksp`;
  }

  private readCursor(cursor: string | undefined, session: KspNegotiatedSession): number {
    if (!cursor) return 0;
    const parts = cursor.split(".");
    if (parts.length !== 6 || parts[0] !== "opaque" || parts[5] !== "ksp") {
      this.reject("cursor-invalid", "recovery", session.correlationId, "Cursor is invalid");
    }
    const generation = Number(parts[1]);
    const offset = Number(parts[4]);
    if (generation !== this.cursorGeneration) {
      this.reject("cursor-expired", "recovery", session.correlationId, "Cursor has expired");
    }
    if (
      parts[2] !== session.accountId ||
      parts[3] !== session.deviceId ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      this.reject("cursor-invalid", "recovery", session.correlationId, "Cursor scope is invalid");
    }
    return offset;
  }

  private failIfFault(fault: KspFault, correlationId: string, code?: KspErrorCode): void {
    if (!this.consumeFault(fault)) return;
    this.metricValues.retries += 1;
    if (fault === "maintenance")
      this.raise("maintenance", "delayed", correlationId, "Service is in maintenance", 1_000);
    this.raise(code ?? "transport-failure", "reconnect", correlationId, `${fault} interrupted the session`);
  }

  private consumeFault(fault: KspFault): boolean {
    const remaining = this.faults.get(fault) ?? 0;
    if (remaining <= 0) return false;
    this.faults.set(fault, remaining - 1);
    return true;
  }

  private reject(code: KspErrorCode, retry: KspProtocolError["retry"], correlationId: string, message: string): never {
    this.metricValues.sessionsRejected += 1;
    this.raise(code, retry, correlationId, message);
  }

  private raise(
    code: KspErrorCode,
    retry: KspProtocolError["retry"],
    correlationId: string,
    message: string,
    retryAfterMs?: number,
  ): never {
    this.addError(code);
    this.record("protocol.error", correlationId, undefined, code);
    throw new KspProtocolError(code, retry, message, correlationId, retryAfterMs);
  }

  private addError(code: KspErrorCode): void {
    this.metricValues.errors[code] = (this.metricValues.errors[code] ?? 0) + 1;
  }
}

class ReferenceKspSession implements KspSessionAdapter {
  private readonly stateTransitions: KspSessionState[];
  private lastWindow?: KspReplayWindow;
  private connected = true;

  constructor(
    private readonly adapter: ReferenceKspAdapter,
    private readonly request: KspSessionRequest,
    readonly negotiated: KspNegotiatedSession,
    transitions: readonly KspSessionState[],
  ) {
    this.stateTransitions = [...transitions];
  }

  get transitions(): readonly KspSessionState[] {
    return [...this.stateTransitions];
  }

  async upload(batch: KspUploadBatch): Promise<KspUploadAcknowledgement> {
    this.beginSynchronization(batch.correlationId);
    try {
      return this.adapter.acceptUpload(this.negotiated, this.request, batch);
    } finally {
      this.finishSynchronization();
    }
  }

  async download(cursor: string | undefined, limit: number): Promise<KspReplayWindow> {
    const correlationId = `${this.request.correlationId}:download`;
    this.beginSynchronization(correlationId);
    try {
      if (this.adapter.shouldDuplicateDownload() && this.lastWindow) return cloneWindow(this.lastWindow);
      const window = this.adapter.createReplayWindow(this.negotiated, this.request, cursor, limit, correlationId);
      this.lastWindow = cloneWindow(window);
      return window;
    } finally {
      this.finishSynchronization();
    }
  }

  async bootstrap(cursor: string | undefined, limit: number): Promise<KspReplayWindow> {
    const correlationId = `${this.request.correlationId}:bootstrap`;
    this.beginSynchronization(correlationId);
    if (!cursor) this.adapter.incrementBootstrapStarted();
    try {
      if (this.adapter.shouldFailBootstrap(correlationId)) {
        throw new KspProtocolError("transport-failure", "reconnect", "Bootstrap was interrupted", correlationId);
      }
      return this.adapter.createReplayWindow(this.negotiated, this.request, cursor, limit, correlationId);
    } finally {
      this.finishSynchronization();
    }
  }

  async acknowledgeReplay(acknowledgement: KspReplayAcknowledgement): Promise<void> {
    this.ensureConnected(acknowledgement.correlationId);
    this.adapter.acknowledgeReplay(this.negotiated, acknowledgement);
  }

  async completeBootstrap(acknowledgement: KspReplayAcknowledgement): Promise<void> {
    this.ensureConnected(acknowledgement.correlationId);
    this.adapter.acknowledgeReplay(this.negotiated, acknowledgement);
    this.adapter.incrementBootstrapCompleted();
    this.adapter.record("bootstrap.completed", acknowledgement.correlationId, this.negotiated.sessionId);
  }

  async heartbeat(correlationId: string): Promise<void> {
    this.ensureConnected(correlationId);
    this.adapter.assertSession(this.negotiated, correlationId);
    this.adapter.record("heartbeat", correlationId, this.negotiated.sessionId);
  }

  async disconnect(correlationId: string): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.stateTransitions.push("disconnected");
    this.adapter.record("session.disconnected", correlationId, this.negotiated.sessionId);
  }

  private beginSynchronization(correlationId: string): void {
    this.ensureConnected(correlationId);
    this.stateTransitions.push("synchronizing");
  }

  private finishSynchronization(): void {
    if (this.connected) this.stateTransitions.push("ready");
  }

  private ensureConnected(correlationId: string): void {
    if (this.connected) return;
    throw new KspProtocolError("session-expired", "reconnect", "Session is disconnected", correlationId);
  }
}

function negotiateVersion(request: KspSessionRequest): KspVersion {
  const { minimum, maximum } = request.versions;
  if (
    minimum.major > supportedVersion.major ||
    maximum.major < supportedVersion.major ||
    (minimum.major === supportedVersion.major && minimum.minor > supportedVersion.minor)
  ) {
    throw new KspProtocolError(
      "protocol-version-unsupported",
      "state-change",
      "No compatible KSP protocol version",
      request.correlationId,
    );
  }
  return { ...supportedVersion };
}

function negotiateEnvelope(request: KspSessionRequest): number {
  const match = [...request.envelopeVersions]
    .sort((left, right) => right - left)
    .find((value) => supportedEnvelopeVersions.has(value));
  if (match === undefined) {
    throw new KspProtocolError(
      "operation-version-unsupported",
      "state-change",
      "No compatible operation envelope version",
      request.correlationId,
    );
  }
  return match;
}

function negotiateCapabilities(capabilities: readonly KspCapability[]): KspCapability[] {
  const agreed: KspCapability[] = [];
  for (const capability of capabilities) {
    const supported = supportedCapabilities.get(capability.name);
    if (supported === undefined || supported < capability.version) {
      if (capability.required) {
        throw new KspProtocolError(
          "capability-unsupported",
          "state-change",
          `Required capability is unsupported: ${capability.name}`,
        );
      }
      continue;
    }
    agreed.push({ ...capability, version: Math.min(supported, capability.version) });
  }
  return agreed;
}

function validateEnvelope(
  operation: KspOperationEnvelope,
  session: KspNegotiatedSession,
  request: KspSessionRequest,
): KspErrorCode | undefined {
  if (
    !operation.operationId ||
    !operation.accountId ||
    !operation.originDeviceId ||
    !operation.operationType ||
    operation.deviceSequence < 1 ||
    !Number.isSafeInteger(operation.deviceSequence)
  ) {
    return "invalid-operation-envelope";
  }
  if (operation.accountId !== session.accountId || operation.originDeviceId !== session.deviceId) {
    return "unauthorized";
  }
  if (operation.envelopeVersion !== session.envelopeVersion || !supportsOperation(request, operation)) {
    return "operation-version-unsupported";
  }
  return undefined;
}

function supportsOperation(request: KspSessionRequest, operation: KspOperationEnvelope): boolean {
  const versions = request.operationVersions[operation.operationType] ?? request.operationVersions["*"];
  return Boolean(versions?.includes(operation.operationVersion));
}

function profileBatchSize(profile: KspTransportProfile): number {
  if (profile === "bluetooth") return 16;
  if (profile === "lan" || profile === "usb") return 256;
  return 128;
}

function emptyMetrics(): KspMetrics {
  return {
    sessionsStarted: 0,
    sessionsReady: 0,
    sessionsRejected: 0,
    reconnects: 0,
    operationsOffered: 0,
    operationsAccepted: 0,
    operationsAlreadyAccepted: 0,
    operationsDownloaded: 0,
    operationsReplayed: 0,
    duplicateDeliveries: 0,
    retries: 0,
    bootstrapStarted: 0,
    bootstrapCompleted: 0,
    errors: {},
  };
}

function cloneEnvelope(operation: KspOperationEnvelope): KspOperationEnvelope {
  return {
    ...operation,
    dependencies: [...operation.dependencies],
    capability: operation.capability && { ...operation.capability },
  };
}

function cloneWindow(window: KspReplayWindow): KspReplayWindow {
  return { ...window, operations: window.operations.map(cloneEnvelope) };
}
