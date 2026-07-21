import type {
  EntityId,
  SyncOperation,
  TransportBatch,
  TransportConnectionState,
  TransportSessionRecord,
  TransportStatus,
} from "@karya/types";
import type {
  RemoteTransport,
  RemoteTransportOptions,
  RetryScheduler,
  TransportProvider,
  TransportSessionRepository,
  TransportSynchronizationPort,
} from "./contracts";

const defaultScheduler: RetryScheduler = {
  wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export class RemoteTransportEngine implements RemoteTransport {
  private readonly batchSize: number;
  private readonly retryLimit: number;
  private readonly initialBackoffMs: number;
  private readonly scheduler: RetryScheduler;
  private readonly now: () => Date;
  private session?: TransportSessionRecord;
  private operation?: Promise<void>;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly synchronization: TransportSynchronizationPort,
    private readonly provider: TransportProvider,
    private readonly sessions: TransportSessionRepository,
    private readonly options: RemoteTransportOptions = {},
  ) {
    this.batchSize = positiveInteger(options.batchSize, 50);
    this.retryLimit = nonNegativeInteger(options.retryLimit, 3);
    this.initialBackoffMs = nonNegativeInteger(options.initialBackoffMs, 250);
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.now = options.now ?? (() => new Date());
  }

  async start(): Promise<void> {
    if (this.session) return;
    const restored = await this.sessions.get("remote-transport");
    this.session = restored ? { ...restored, state: "idle", updatedAt: this.timestamp() } : this.createSession();
    await this.persist();
  }

  async stop(): Promise<void> {
    await this.operation?.catch(() => undefined);
    if (this.session?.state === "connected") await this.provider.disconnect();
    await this.transition("idle");
  }

  connect(): Promise<void> {
    return this.exclusive(async () => {
      const session = await this.requireSession();
      if (session.state === "connected") return;
      await this.transition("connecting");
      try {
        const [replicaId, credentials] = await Promise.all([
          this.synchronization.deviceId(),
          this.options.authentication?.proveIdentity(),
        ]);
        await this.provider.connect({ replicaId, credentials });
        await this.transition("connected", 0);
      } catch (cause) {
        await this.transition("failed");
        throw cause;
      }
    });
  }

  disconnect(): Promise<void> {
    return this.exclusive(async () => {
      const session = await this.requireSession();
      if (session.state === "idle" || session.state === "offline") return;
      await this.provider.disconnect();
      await this.transition("offline", 0);
    });
  }

  reconnect(): Promise<void> {
    return this.exclusive(async () => {
      await this.transition("reconnecting");
      try {
        await this.provider.disconnect();
        const [replicaId, credentials] = await Promise.all([
          this.synchronization.deviceId(),
          this.options.authentication?.proveIdentity(),
        ]);
        await this.provider.connect({ replicaId, credentials });
        await this.transition("connected", 0);
      } catch (cause) {
        await this.transition("failed");
        throw cause;
      }
    });
  }

  suspend(): Promise<void> {
    return this.exclusive(async () => {
      const session = await this.requireSession();
      if (session.state === "suspended") return;
      if (session.state === "connected") await this.provider.disconnect();
      await this.transition("suspended");
    });
  }

  resume(): Promise<void> {
    return this.exclusive(async () => {
      const session = await this.requireSession();
      if (session.state !== "suspended") return;
      await this.transition("reconnecting");
      try {
        const [replicaId, credentials] = await Promise.all([
          this.synchronization.deviceId(),
          this.options.authentication?.proveIdentity(),
        ]);
        await this.provider.connect({ replicaId, credentials });
        await this.transition("connected", 0);
      } catch (cause) {
        await this.transition("failed");
        throw cause;
      }
    });
  }

  synchronize(): Promise<void> {
    return this.exclusive(async () => {
      const session = await this.requireSession();
      if (session.state !== "connected") throw new Error("Remote transport is not connected");
      try {
        await this.uploadPending();
        await this.downloadIncoming();
        const current = await this.requireSession();
        this.session = {
          ...current,
          retryCount: 0,
          lastSuccessfulSynchronization: this.timestamp(),
          updatedAt: this.timestamp(),
        };
        await this.persist();
      } catch (cause) {
        await this.transition("failed", this.session?.retryCount);
        throw cause;
      }
    });
  }

  async status(): Promise<TransportStatus> {
    const session = await this.requireSession();
    const pending = await this.synchronization.pending();
    return {
      ...session,
      provider: this.provider.id,
      queueSize: pending.length,
      pendingBatches: Math.ceil(pending.length / this.batchSize),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async uploadPending(): Promise<void> {
    let pending = orderOperations(await this.synchronization.pending());
    while (pending.length > 0) {
      const operations = pending.slice(0, this.batchSize);
      const batch = createBatch(await this.synchronization.deviceId(), operations);
      const acknowledgement = await this.withRetry(() => this.provider.upload(batch));
      const acknowledged = new Set(acknowledgement.operationIds);
      const validAcknowledgements = operations.filter(({ id }) => acknowledged.has(id)).map(({ id }) => id);
      if (validAcknowledgements.length > 0) await this.synchronization.acknowledge(validAcknowledgements);
      if (validAcknowledgements.length === 0) throw new Error(`Transport batch was not acknowledged: ${batch.id}`);
      pending = pending.filter(({ id }) => !acknowledged.has(id));
    }
  }

  private async downloadIncoming(): Promise<void> {
    const session = await this.requireSession();
    const download = await this.withRetry(() => this.provider.download(session.cursor));
    for (const batch of download.batches) {
      const operations = orderOperations(batch.operations);
      await this.synchronization.replay(operations);
      await this.withRetry(() =>
        this.provider.acknowledge({ batchId: batch.id, operationIds: operations.map(({ id }) => id) }),
      );
    }
    this.session = { ...(await this.requireSession()), cursor: download.cursor, updatedAt: this.timestamp() };
    await this.persist();
  }

  private async withRetry<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    let attempt = 0;
    for (;;) {
      try {
        return await operation();
      } catch (cause) {
        if (attempt >= this.retryLimit) throw cause;
        attempt += 1;
        const session = await this.requireSession();
        this.session = { ...session, state: "reconnecting", retryCount: attempt, updatedAt: this.timestamp() };
        await this.persist();
        await this.scheduler.wait(this.initialBackoffMs * 2 ** (attempt - 1));
        await this.provider.connect({
          replicaId: await this.synchronization.deviceId(),
          credentials: await this.options.authentication?.proveIdentity(),
        });
        await this.transition("connected", attempt);
      }
    }
  }

  private async exclusive(operation: () => Promise<void>): Promise<void> {
    if (this.operation) return this.operation;
    this.operation = operation().finally(() => {
      this.operation = undefined;
    });
    return this.operation;
  }

  private async transition(state: TransportConnectionState, retryCount?: number): Promise<void> {
    const session = await this.requireSession();
    this.session = { ...session, state, retryCount: retryCount ?? session.retryCount, updatedAt: this.timestamp() };
    await this.persist();
  }

  private async requireSession(): Promise<TransportSessionRecord> {
    if (!this.session) await this.start();
    return this.session as TransportSessionRecord;
  }

  private createSession(): TransportSessionRecord {
    return { id: "remote-transport", state: "idle", retryCount: 0, updatedAt: this.timestamp() };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private async persist(): Promise<void> {
    if (!this.session) return;
    await this.sessions.save(this.session);
    this.listeners.forEach((listener) => listener());
  }
}

export function createDeterministicBatches(
  replicaId: EntityId,
  operations: readonly SyncOperation[],
  batchSize: number,
): TransportBatch[] {
  const ordered = orderOperations(operations);
  const size = positiveInteger(batchSize, 50);
  const batches: TransportBatch[] = [];
  for (let offset = 0; offset < ordered.length; offset += size) {
    batches.push(createBatch(replicaId, ordered.slice(offset, offset + size)));
  }
  return batches;
}

function createBatch(replicaId: EntityId, operations: readonly SyncOperation[]): TransportBatch {
  const first = operations[0]?.id ?? "empty";
  const last = operations.at(-1)?.id ?? "empty";
  return { id: `batch:${replicaId}:${first}:${last}:${operations.length}`, replicaId, operations };
}

function orderOperations(operations: readonly SyncOperation[]): SyncOperation[] {
  return [...operations].sort(
    (left, right) =>
      left.timestamp.localeCompare(right.timestamp) ||
      left.deviceId.localeCompare(right.deviceId) ||
      left.sequence - right.sequence ||
      left.id.localeCompare(right.id),
  );
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value && Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : fallback;
}
