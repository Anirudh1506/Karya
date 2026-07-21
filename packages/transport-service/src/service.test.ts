import type { EntityId, SyncOperation, TransportSessionRecord } from "@karya/types";
import { describe, expect, it } from "vitest";
import type { TransportSessionRepository, TransportSynchronizationPort } from "./contracts";
import { LoopbackTransportHub, LoopbackTransportProvider } from "./loopback";
import { createDeterministicBatches, RemoteTransportEngine } from "./service";

describe("RemoteTransportEngine", () => {
  it("moves through the session lifecycle and restores durable status as idle", async () => {
    const sessions = new MemorySessionRepository();
    const engine = new RemoteTransportEngine(
      new FakeSynchronization("device-a"),
      new LoopbackTransportProvider(),
      sessions,
    );

    await engine.start();
    expect((await engine.status()).state).toBe("idle");
    await engine.connect();
    expect((await engine.status()).state).toBe("connected");
    await engine.suspend();
    expect((await engine.status()).state).toBe("suspended");
    await engine.resume();
    expect((await engine.status()).state).toBe("connected");
    await engine.disconnect();
    expect((await engine.status()).state).toBe("offline");

    const restored = new RemoteTransportEngine(
      new FakeSynchronization("device-a"),
      new LoopbackTransportProvider(),
      sessions,
    );
    await restored.start();
    expect((await restored.status()).state).toBe("idle");
  });

  it("preserves operation order and creates stable batches", () => {
    const operations = [operation("c", "device-a", 3), operation("a", "device-a", 1), operation("b", "device-a", 2)];
    const batches = createDeterministicBatches("device-a", operations, 2);

    expect(batches.map((batch) => batch.operations.map(({ id }) => id))).toEqual([["a", "b"], ["c"]]);
    expect(createDeterministicBatches("device-a", operations, 2).map(({ id }) => id)).toEqual(
      batches.map(({ id }) => id),
    );
  });

  it("retries with exponential backoff and completes partial acknowledgements", async () => {
    const synchronization = new FakeSynchronization("device-a", [
      operation("a", "device-a", 1),
      operation("b", "device-a", 2),
      operation("c", "device-a", 3),
    ]);
    const provider = new LoopbackTransportProvider();
    provider.simulateUploadFailures(2);
    provider.simulatePartialAcknowledgement(1);
    const waits: number[] = [];
    const engine = new RemoteTransportEngine(synchronization, provider, new MemorySessionRepository(), {
      batchSize: 3,
      retryLimit: 3,
      initialBackoffMs: 10,
      scheduler: { wait: async (milliseconds) => void waits.push(milliseconds) },
    });

    await engine.start();
    await engine.connect();
    await engine.synchronize();

    expect(waits).toEqual([10, 20]);
    expect(synchronization.acknowledged).toEqual(["a", "b", "c"]);
    expect((await engine.status()).queueSize).toBe(0);
    expect((await engine.status()).lastSuccessfulSynchronization).toBeDefined();
  });

  it("exchanges operations between two logical replicas without duplicate replay", async () => {
    const hub = new LoopbackTransportHub();
    const replicaA = new FakeSynchronization("device-a", [operation("operation-a", "device-a", 1)]);
    const replicaB = new FakeSynchronization("device-b");
    const transportA = new RemoteTransportEngine(
      replicaA,
      new LoopbackTransportProvider(hub),
      new MemorySessionRepository(),
    );
    const transportB = new RemoteTransportEngine(
      replicaB,
      new LoopbackTransportProvider(hub),
      new MemorySessionRepository(),
    );

    await Promise.all([transportA.start(), transportB.start()]);
    await Promise.all([transportA.connect(), transportB.connect()]);
    await transportA.synchronize();
    await transportB.synchronize();
    await transportB.synchronize();

    expect(replicaA.acknowledged).toEqual(["operation-a"]);
    expect(replicaB.replayed.map(({ id }) => id)).toEqual(["operation-a"]);
  });
});

class FakeSynchronization implements TransportSynchronizationPort {
  readonly acknowledged: EntityId[] = [];
  readonly replayed: SyncOperation[] = [];

  constructor(
    private readonly replicaId: EntityId,
    private readonly operations: SyncOperation[] = [],
  ) {}

  async deviceId() {
    return this.replicaId;
  }
  async pending() {
    return this.operations.filter(({ id }) => !this.acknowledged.includes(id));
  }
  async acknowledge(operationIds: readonly EntityId[]) {
    this.acknowledged.push(...operationIds.filter((id) => !this.acknowledged.includes(id)));
  }
  async replay(operations: readonly SyncOperation[]) {
    this.replayed.push(...operations.filter(({ id }) => !this.replayed.some((item) => item.id === id)));
  }
}

class MemorySessionRepository implements TransportSessionRepository {
  private value?: TransportSessionRecord;
  async get() {
    return this.value;
  }
  async save(session: TransportSessionRecord) {
    this.value = { ...session };
  }
}

function operation(id: EntityId, deviceId: EntityId, sequence: number): SyncOperation {
  return {
    id,
    deviceId,
    sequence,
    timestamp: new Date(sequence).toISOString(),
    entityType: "resource",
    entityId: `resource-${id}`,
    operationType: "ResourceUpdated",
    payload: "{}",
    dependencies: [],
    acknowledgementState: "pending",
  };
}
