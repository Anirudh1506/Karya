import { InMemoryEventBus } from "@karya/event-bus";
import type { Repository, SyncOperationRepository } from "@karya/persistence";
import type { EntityId, Profile, SyncConflict, SyncDeviceState, SyncOperation, SyncReplayReceipt } from "@karya/types";
import { describe, expect, it } from "vitest";
import { SynchronizationEngine } from "./service";

describe("SynchronizationEngine", () => {
  it("creates ordered operations, restores its queue and retains device identity", async () => {
    const fixture = createFixture();
    await fixture.engine.start();
    const deviceId = (await fixture.engine.status()).deviceId;
    await fixture.bus.publish("ProfileCreated", { profile: profile("profile-1", "One", 1) });
    await fixture.bus.publish("ProfileUpdated", { profile: profile("profile-1", "Two", 2) });
    expect((await fixture.engine.pending()).map((item) => item.sequence)).toEqual([1, 2]);
    await fixture.engine.stop();

    const restarted = new SynchronizationEngine(fixture.bus, fixture.repositories, fixture.target);
    await restarted.start();
    expect((await restarted.status()).deviceId).toBe(deviceId);
    expect((await restarted.status()).queueSize).toBe(2);
  });

  it("replays deterministically and ignores duplicate operations", async () => {
    const fixture = createFixture();
    await fixture.engine.start();
    const later = operation("operation-2", 2, profile("profile-1", "Later", 2));
    const earlier = operation("operation-1", 1, profile("profile-1", "Earlier", 1));
    await fixture.engine.replay([later, earlier, later]);
    expect(fixture.applied).toEqual(["operation-1", "operation-2"]);
    expect(await fixture.receipts.list()).toHaveLength(2);
    await fixture.engine.replay([earlier, later]);
    expect(fixture.applied).toHaveLength(2);
  });

  it("acknowledges without mutating operation identity and emits conflict hooks", async () => {
    const fixture = createFixture("9999-01-01T00:00:00.000Z");
    await fixture.engine.start();
    await fixture.bus.publish("ProfileCreated", { profile: profile("profile-1", "One", 1) });
    const [queued] = await fixture.engine.pending();
    await fixture.engine.acknowledge([queued.id]);
    const [acknowledged] = await fixture.engine.acknowledged();
    expect(acknowledged.id).toBe(queued.id);
    expect(acknowledged.payload).toBe(queued.payload);
    await fixture.engine.replay([queued]);
    expect((await fixture.engine.conflicts())[0]).toMatchObject({
      reason: "concurrent-modification",
      operationId: queued.id,
    });
  });
});

function createFixture(localTimestamp?: string) {
  const bus = new InMemoryEventBus();
  const operations = new MemoryOperationRepository();
  const deviceStates = new MemoryRepository<SyncDeviceState>();
  const receipts = new MemoryRepository<SyncReplayReceipt>();
  const conflicts = new MemoryRepository<SyncConflict>();
  const applied: string[] = [];
  const target = {
    async getUpdatedAt() {
      return localTimestamp;
    },
    async apply(value: SyncOperation) {
      applied.push(value.id);
      return true;
    },
  };
  const repositories = { operations, deviceStates, receipts, conflicts };
  return {
    bus,
    operations,
    receipts,
    applied,
    target,
    repositories,
    engine: new SynchronizationEngine(bus, repositories, target),
  };
}

function operation(id: string, sequence: number, value: Profile): SyncOperation {
  return {
    id,
    deviceId: "device-remote",
    sequence,
    timestamp: new Date(sequence).toISOString(),
    entityType: "profile",
    entityId: value.id,
    operationType: "ProfileUpdated",
    payload: JSON.stringify(value),
    dependencies: [],
    acknowledgementState: "pending",
  };
}

function profile(id: string, name: string, tick: number): Profile {
  const timestamp = new Date(tick).toISOString();
  return {
    id,
    name,
    defaultSpaceId: `space:${id}:default`,
    spaceIds: [`space:${id}:default`],
    createdAt: timestamp,
    updatedAt: timestamp,
    lifecycleState: "active",
    template: "custom",
    preferences: { favoriteWorkspaceIds: [], defaultApplicationIds: [], defaultCreateTemplateIds: [] },
  };
}

class MemoryRepository<TEntity extends { id: EntityId }> implements Repository<TEntity> {
  private readonly values = new Map<EntityId, TEntity>();
  async list() {
    return [...this.values.values()];
  }
  async get(id: EntityId) {
    return this.values.get(id);
  }
  async save(entity: TEntity) {
    this.values.set(entity.id, { ...entity });
  }
  async delete(id: EntityId) {
    this.values.delete(id);
  }
}

class MemoryOperationRepository implements SyncOperationRepository {
  private readonly values = new Map<EntityId, SyncOperation>();
  async append(operation: SyncOperation) {
    if (this.values.has(operation.id)) return false;
    this.values.set(operation.id, operation);
    return true;
  }
  async get(id: EntityId) {
    return this.values.get(id);
  }
  async list(state?: SyncOperation["acknowledgementState"]) {
    return [...this.values.values()].filter((item) => !state || item.acknowledgementState === state);
  }
  async updateAcknowledgement(
    id: EntityId,
    state: SyncOperation["acknowledgementState"],
    at?: string,
    reason?: string,
  ) {
    const current = this.values.get(id);
    if (!current) throw new Error("missing");
    const updated = { ...current, acknowledgementState: state, acknowledgedAt: at, failureReason: reason };
    this.values.set(id, updated);
    return updated;
  }
}
