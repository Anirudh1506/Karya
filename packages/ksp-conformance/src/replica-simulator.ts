import type { EntityId } from "@karya/types";
import type {
  KspCapability,
  KspConformanceAdapter,
  KspDurableReplicaState,
  KspOperationEnvelope,
  KspReplayAcknowledgement,
  KspReplayWindow,
  KspSessionAdapter,
  KspSessionRequest,
  KspVersionRange,
} from "./contracts";
import { KspProtocolError } from "./contracts";
import { orderEnvelopes } from "./ordering";

export interface ReplicaSimulatorOptions {
  accountId?: EntityId;
  authenticated?: boolean;
  authorized?: boolean;
  trusted?: boolean;
  versions?: KspVersionRange;
  envelopeVersions?: readonly number[];
  operationVersions?: Readonly<Record<string, readonly number[]>>;
  capabilities?: readonly KspCapability[];
  batchSize?: number;
}

export interface SynchronizeOptions {
  interruptReplayAfter?: number;
  maximumWindows?: number;
}

export class KspReplicaSimulator {
  private session?: KspSessionAdapter;
  private correlationSequence = 1;
  private readonly batchSize: number;
  private readonly requestTemplate: Omit<KspSessionRequest, "correlationId">;

  constructor(
    private readonly adapter: KspConformanceAdapter,
    deviceId: EntityId,
    options: ReplicaSimulatorOptions = {},
    private readonly durable: KspDurableReplicaState = createDurableState(deviceId, options.accountId ?? "account:ksp"),
  ) {
    this.batchSize = options.batchSize ?? 50;
    this.requestTemplate = {
      accountId: this.durable.accountId,
      deviceId: this.durable.deviceId,
      authenticated: options.authenticated ?? true,
      authorized: options.authorized ?? true,
      trusted: options.trusted ?? true,
      versions: options.versions ?? { minimum: { major: 1, minor: 0 }, maximum: { major: 1, minor: 0 } },
      envelopeVersions: options.envelopeVersions ?? [1],
      operationVersions: options.operationVersions ?? { "karya.test": [1], "*": [1] },
      capabilities: options.capabilities ?? [{ name: "background-sync", version: 1 }],
    };
  }

  get deviceId(): EntityId {
    return this.durable.deviceId;
  }

  get accountId(): EntityId {
    return this.durable.accountId;
  }

  get state(): Readonly<KspDurableReplicaState> {
    return {
      ...this.durable,
      pending: this.durable.pending.map(cloneEnvelope),
      accepted: new Set(this.durable.accepted),
      receipts: new Set(this.durable.receipts),
      replayOrder: [...this.durable.replayOrder],
    };
  }

  get transitions(): readonly string[] {
    return this.session?.transitions ?? ["idle"];
  }

  async connect(): Promise<void> {
    this.session = await this.adapter.connect({ ...this.requestTemplate, correlationId: this.correlation("connect") });
  }

  async disconnect(): Promise<void> {
    if (!this.session) return;
    await this.session.disconnect(this.correlation("disconnect"));
    this.session = undefined;
  }

  async heartbeat(): Promise<void> {
    const session = await this.requireSession();
    await session.heartbeat(this.correlation("heartbeat"));
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  createOperation(
    payload: string,
    dependencies: readonly EntityId[] = [],
    operationType = "karya.test",
    operationVersion = 1,
  ): KspOperationEnvelope {
    const sequence = this.durable.nextSequence++;
    const operation: KspOperationEnvelope = {
      operationId: `operation:${this.deviceId}:${sequence}`,
      accountId: this.accountId,
      originDeviceId: this.deviceId,
      operationType,
      operationVersion,
      deviceSequence: sequence,
      timestamp: new Date(sequence).toISOString(),
      payload,
      dependencies: [...dependencies],
      envelopeVersion: 1,
    };
    this.durable.pending.push(operation);
    return cloneEnvelope(operation);
  }

  queue(operation: KspOperationEnvelope): void {
    if (operation.originDeviceId !== this.deviceId) throw new Error("A replica may only queue its own operation");
    this.durable.pending.push(cloneEnvelope(operation));
    this.durable.nextSequence = Math.max(this.durable.nextSequence, operation.deviceSequence + 1);
  }

  async synchronize(options: SynchronizeOptions = {}): Promise<void> {
    const session = await this.requireSession();
    await this.uploadPending(session);
    await this.downloadAndReplay(session, options);
  }

  async synchronizeWithRetry(attempts = 3, options: SynchronizeOptions = {}): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= attempts; attempt += 1) {
      try {
        await this.synchronize(options);
        return;
      } catch (error) {
        lastError = error;
        if (!(error instanceof KspProtocolError) || !["immediate", "delayed", "reconnect"].includes(error.retry)) {
          throw error;
        }
        if (attempt === attempts) break;
        await this.reconnect();
      }
    }
    throw lastError;
  }

  async bootstrap(options: SynchronizeOptions = {}): Promise<void> {
    const session = await this.requireSession();
    const maximumWindows = options.maximumWindows ?? Number.POSITIVE_INFINITY;
    let windows = 0;
    while (windows < maximumWindows) {
      const window = await session.bootstrap(this.durable.cursor, this.batchSize);
      windows += 1;
      await this.replayWindow(window, options.interruptReplayAfter);
      const acknowledgement = replayAcknowledgement(window);
      if (window.complete) {
        await session.completeBootstrap(acknowledgement);
      } else {
        await session.acknowledgeReplay(acknowledgement);
      }
      this.durable.cursor = window.candidateCursor;
      if (window.complete) {
        this.durable.ready = true;
        return;
      }
    }
  }

  restart(): KspReplicaSimulator {
    return new KspReplicaSimulator(this.adapter, this.deviceId, this.options(), cloneDurableState(this.durable));
  }

  digest(): string {
    return [
      this.deviceId,
      [...this.durable.receipts].sort().join(","),
      this.durable.replayOrder.join(","),
      [...this.durable.accepted].sort().join(","),
      this.durable.cursor ?? "none",
      String(this.durable.ready),
    ].join("|");
  }

  private async uploadPending(session: KspSessionAdapter): Promise<void> {
    let remaining = orderEnvelopes(
      this.durable.pending.filter(({ operationId }) => !this.durable.accepted.has(operationId)),
    );
    while (remaining.length > 0) {
      const operations = remaining.slice(0, Math.min(this.batchSize, session.negotiated.maximumBatchSize));
      const batchId = `batch:${this.deviceId}:${operations[0]?.operationId}:${operations.at(-1)?.operationId}`;
      const acknowledgement = await session.upload({
        batchId,
        operations,
        correlationId: this.correlation("upload"),
      });
      let progress = 0;
      for (const outcome of acknowledgement.operations) {
        if (outcome.outcome === "accepted" || outcome.outcome === "already-accepted") {
          this.durable.accepted.add(outcome.operationId);
          progress += 1;
        }
        if (outcome.outcome === "rejected") {
          throw new KspProtocolError(
            outcome.error ?? "invalid-operation-envelope",
            "never",
            `Operation was rejected: ${outcome.operationId}`,
            acknowledgement.correlationId,
          );
        }
      }
      if (progress === 0) {
        throw new KspProtocolError(
          "dependency-unavailable",
          "delayed",
          "Upload made no progress",
          acknowledgement.correlationId,
        );
      }
      remaining = remaining.filter(({ operationId }) => !this.durable.accepted.has(operationId));
    }
  }

  private async downloadAndReplay(session: KspSessionAdapter, options: SynchronizeOptions): Promise<void> {
    const maximumWindows = options.maximumWindows ?? Number.POSITIVE_INFINITY;
    let windows = 0;
    while (windows < maximumWindows) {
      const window = await session.download(this.durable.cursor, this.batchSize);
      windows += 1;
      await this.replayWindow(window, options.interruptReplayAfter);
      await session.acknowledgeReplay(replayAcknowledgement(window));
      this.durable.cursor = window.candidateCursor;
      if (window.complete) return;
    }
  }

  private async replayWindow(window: KspReplayWindow, interruptAfter?: number): Promise<void> {
    const pending = orderEnvelopes(window.operations).filter(
      ({ operationId }) => !this.durable.receipts.has(operationId),
    );
    let applied = 0;
    let madeProgress = true;

    while (pending.length > 0 && madeProgress) {
      madeProgress = false;
      for (let index = 0; index < pending.length;) {
        const operation = pending[index];
        if (!operation.dependencies.every((dependency) => this.durable.receipts.has(dependency))) {
          index += 1;
          continue;
        }
        this.durable.receipts.add(operation.operationId);
        this.durable.replayOrder.push(operation.operationId);
        pending.splice(index, 1);
        applied += 1;
        madeProgress = true;
        if (interruptAfter !== undefined && applied >= interruptAfter) {
          throw new KspProtocolError(
            "transport-failure",
            "reconnect",
            "Replay was interrupted after durable partial progress",
            window.correlationId,
          );
        }
      }
    }

    if (pending.length > 0) {
      throw new KspProtocolError(
        "dependency-missing",
        "recovery",
        `Replay dependencies are missing for ${pending[0]?.operationId}`,
        window.correlationId,
      );
    }
  }

  private async requireSession(): Promise<KspSessionAdapter> {
    if (!this.session) await this.connect();
    return this.session as KspSessionAdapter;
  }

  private correlation(purpose: string): string {
    return `correlation:${this.deviceId}:${purpose}:${this.correlationSequence++}`;
  }

  private options(): ReplicaSimulatorOptions {
    return {
      accountId: this.requestTemplate.accountId,
      authenticated: this.requestTemplate.authenticated,
      authorized: this.requestTemplate.authorized,
      trusted: this.requestTemplate.trusted,
      versions: this.requestTemplate.versions,
      envelopeVersions: this.requestTemplate.envelopeVersions,
      operationVersions: this.requestTemplate.operationVersions,
      capabilities: this.requestTemplate.capabilities,
      batchSize: this.batchSize,
    };
  }
}

export function createOperationEnvelope(
  deviceId: EntityId,
  sequence: number,
  options: Partial<KspOperationEnvelope> = {},
): KspOperationEnvelope {
  return {
    operationId: options.operationId ?? `operation:${deviceId}:${sequence}`,
    accountId: options.accountId ?? "account:ksp",
    originDeviceId: deviceId,
    operationType: options.operationType ?? "karya.test",
    operationVersion: options.operationVersion ?? 1,
    deviceSequence: sequence,
    timestamp: options.timestamp ?? new Date(sequence).toISOString(),
    payload: options.payload ?? `payload:${sequence}`,
    dependencies: options.dependencies ? [...options.dependencies] : [],
    envelopeVersion: options.envelopeVersion ?? 1,
    capability: options.capability && { ...options.capability },
  };
}

function createDurableState(deviceId: EntityId, accountId: EntityId): KspDurableReplicaState {
  return {
    accountId,
    deviceId,
    pending: [],
    accepted: new Set(),
    receipts: new Set(),
    replayOrder: [],
    ready: false,
    nextSequence: 1,
  };
}

function cloneDurableState(state: KspDurableReplicaState): KspDurableReplicaState {
  return {
    ...state,
    pending: state.pending.map(cloneEnvelope),
    accepted: new Set(state.accepted),
    receipts: new Set(state.receipts),
    replayOrder: [...state.replayOrder],
  };
}

function cloneEnvelope(operation: KspOperationEnvelope): KspOperationEnvelope {
  return {
    ...operation,
    dependencies: [...operation.dependencies],
    capability: operation.capability && { ...operation.capability },
  };
}

function replayAcknowledgement(window: KspReplayWindow): KspReplayAcknowledgement {
  return {
    batchId: window.batchId,
    operationIds: window.operations.map(({ operationId }) => operationId),
    candidateCursor: window.candidateCursor,
    complete: true,
    correlationId: window.correlationId,
  };
}
