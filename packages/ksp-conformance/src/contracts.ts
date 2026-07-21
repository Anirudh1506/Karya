import type { EntityId } from "@karya/types";

export interface KspVersion {
  major: number;
  minor: number;
}

export interface KspVersionRange {
  minimum: KspVersion;
  maximum: KspVersion;
}

export interface KspCapability {
  name: string;
  version: number;
  required?: boolean;
}

export type KspSessionState =
  | "idle"
  | "connecting"
  | "authenticating"
  | "authorizing"
  | "negotiating"
  | "ready"
  | "synchronizing"
  | "interrupted"
  | "rejected"
  | "disconnected";

export type KspErrorCode =
  | "unauthenticated"
  | "unauthorized"
  | "device-untrusted"
  | "device-revoked"
  | "protocol-version-unsupported"
  | "capability-unsupported"
  | "operation-version-unsupported"
  | "invalid-message"
  | "invalid-operation-envelope"
  | "operation-identity-conflict"
  | "dependency-missing"
  | "cursor-invalid"
  | "cursor-expired"
  | "replay-required"
  | "bootstrap-required"
  | "recovery-required"
  | "retry-later"
  | "maintenance"
  | "dependency-unavailable"
  | "transport-failure"
  | "session-expired";

export type KspRetryClass = "immediate" | "delayed" | "reconnect" | "recovery" | "state-change" | "never";

export class KspProtocolError extends Error {
  constructor(
    readonly code: KspErrorCode,
    readonly retry: KspRetryClass,
    message: string,
    readonly correlationId?: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "KspProtocolError";
  }
}

export interface KspOperationEnvelope {
  operationId: EntityId;
  accountId: EntityId;
  originDeviceId: EntityId;
  operationType: string;
  operationVersion: number;
  deviceSequence: number;
  timestamp: string;
  payload: string;
  dependencies: readonly EntityId[];
  envelopeVersion: number;
  capability?: KspCapability;
}

export type KspUploadOutcome = "accepted" | "already-accepted" | "deferred" | "rejected";

export interface KspOperationAcknowledgement {
  operationId: EntityId;
  outcome: KspUploadOutcome;
  error?: KspErrorCode;
}

export interface KspUploadBatch {
  batchId: EntityId;
  operations: readonly KspOperationEnvelope[];
  correlationId: string;
}

export interface KspUploadAcknowledgement {
  batchId: EntityId;
  operations: readonly KspOperationAcknowledgement[];
  correlationId: string;
}

export interface KspReplayWindow {
  batchId: EntityId;
  operations: readonly KspOperationEnvelope[];
  candidateCursor: string;
  complete: boolean;
  correlationId: string;
}

export interface KspReplayAcknowledgement {
  batchId: EntityId;
  operationIds: readonly EntityId[];
  candidateCursor: string;
  complete: boolean;
  correlationId: string;
}

export interface KspSessionRequest {
  accountId: EntityId;
  deviceId: EntityId;
  authenticated: boolean;
  authorized: boolean;
  trusted: boolean;
  versions: KspVersionRange;
  envelopeVersions: readonly number[];
  operationVersions: Readonly<Record<string, readonly number[]>>;
  capabilities: readonly KspCapability[];
  correlationId: string;
}

export interface KspNegotiatedSession {
  sessionId: EntityId;
  accountId: EntityId;
  deviceId: EntityId;
  version: KspVersion;
  envelopeVersion: number;
  capabilities: readonly KspCapability[];
  maximumBatchSize: number;
  state: KspSessionState;
  correlationId: string;
}

export type KspFault =
  | "maintenance"
  | "network-failure"
  | "lost-upload-response"
  | "duplicate-download"
  | "expired-session"
  | "dependency-failure"
  | "bootstrap-failure";

export type KspTransportProfile = "loopback" | "http" | "websocket" | "lan" | "bluetooth" | "usb" | "future";

export interface KspDiagnostic {
  sequence: number;
  type: string;
  correlationId: string;
  sessionId?: EntityId;
  detail?: string;
}

export interface KspMetrics {
  sessionsStarted: number;
  sessionsReady: number;
  sessionsRejected: number;
  reconnects: number;
  operationsOffered: number;
  operationsAccepted: number;
  operationsAlreadyAccepted: number;
  operationsDownloaded: number;
  operationsReplayed: number;
  duplicateDeliveries: number;
  retries: number;
  bootstrapStarted: number;
  bootstrapCompleted: number;
  errors: Partial<Record<KspErrorCode, number>>;
}

export interface KspSessionAdapter {
  readonly negotiated: KspNegotiatedSession;
  readonly transitions: readonly KspSessionState[];
  upload(batch: KspUploadBatch): Promise<KspUploadAcknowledgement>;
  download(cursor: string | undefined, limit: number): Promise<KspReplayWindow>;
  bootstrap(cursor: string | undefined, limit: number): Promise<KspReplayWindow>;
  acknowledgeReplay(acknowledgement: KspReplayAcknowledgement): Promise<void>;
  completeBootstrap(acknowledgement: KspReplayAcknowledgement): Promise<void>;
  heartbeat(correlationId: string): Promise<void>;
  disconnect(correlationId: string): Promise<void>;
}

export interface KspConformanceAdapter {
  readonly id: string;
  readonly profile: KspTransportProfile;
  connect(request: KspSessionRequest): Promise<KspSessionAdapter>;
  handleExtension(type: string, required: boolean, correlationId: string): Promise<"ignored">;
  injectFault(fault: KspFault, count?: number): void;
  revokeDevice(deviceId: EntityId): void;
  expireCursors(): void;
  diagnostics(): readonly KspDiagnostic[];
  metrics(): Readonly<KspMetrics>;
}

export interface KspConformanceAdapterFactory {
  readonly id: string;
  create(profile?: KspTransportProfile): KspConformanceAdapter;
}

export interface KspDurableReplicaState {
  accountId: EntityId;
  deviceId: EntityId;
  pending: KspOperationEnvelope[];
  accepted: Set<EntityId>;
  receipts: Set<EntityId>;
  replayOrder: EntityId[];
  cursor?: string;
  ready: boolean;
  nextSequence: number;
}

export interface KspConformanceCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface KspConformanceReport {
  adapterId: string;
  protocolVersion: "1.0";
  certified: boolean;
  checks: readonly KspConformanceCheck[];
  metrics: Readonly<KspMetrics>;
  diagnosticsRedacted: boolean;
}
