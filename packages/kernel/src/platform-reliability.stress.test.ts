import { DefaultResourceEditingService } from "@karya/editing-service";
import { InMemoryEventBus } from "@karya/event-bus";
import type { Repository, SyncOperationRepository } from "@karya/persistence";
import type { ResourceService } from "@karya/resource-service";
import { InMemorySearchService } from "@karya/search-service";
import { SynchronizationEngine } from "@karya/sync-service";
import type {
  ContinuitySession,
  EditableResourceContent,
  EditCheckpoint,
  EditSession,
  EntityId,
  Profile,
  Resource,
  SearchDocument,
  SyncConflict,
  SyncDeviceState,
  SyncOperation,
  SyncReplayReceipt,
  Workspace,
} from "@karya/types";
import { rankContinueWorking } from "@karya/continuity-service";
import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

const metrics: Record<string, number> = {};

describe.sequential("Integrated platform reliability", () => {
  it("keeps editing recovery bounded across 5,000 changes and repeated lifecycle flushes", async () => {
    const bus = new InMemoryEventBus();
    const contents = new MemoryRepository<EditableResourceContent>();
    const sessions = new MemoryRepository<EditSession>();
    const checkpoints = new MemoryRepository<EditCheckpoint>();
    const resource = makeResource("resource-edit", 0);
    const resourceService = {
      async getResource() {
        return resource;
      },
      async updateMetadata(_id: EntityId, patch: Partial<Resource["metadata"]>) {
        resource.metadata = { ...resource.metadata, ...patch };
        return resource;
      },
    } as unknown as ResourceService;
    const service = new DefaultResourceEditingService(
      bus,
      resourceService,
      { contents, sessions, checkpoints },
      60_000,
    );
    const started = performance.now();
    const opened = await service.open(resource.id);
    for (let index = 0; index < 5_000; index += 1) {
      await service.change(opened.session.id, `revision-${index}`);
      if (index % 250 === 0) {
        await service.suspend();
      }
    }
    await service.suspend();
    await service.close(opened.session.id);
    metrics.editing5000Ms = performance.now() - started;

    expect((await contents.get(resource.id))?.text).toBe("revision-4999");
    expect((await contents.get(resource.id))?.revision).toBe(5_000);
    expect(await checkpoints.list()).toHaveLength(2);
    expect((await sessions.list()).filter((session) => session.status === "open")).toHaveLength(0);
    await service.shutdown();
  }, 30_000);

  it("searches and ranks a 10,000 Resource library without stale or duplicate documents", async () => {
    const service = new InMemorySearchService(new InMemoryEventBus());
    const documents = Array.from({ length: 10_000 }, (_, index): SearchDocument => ({
      id: `resource:resource-${index}`,
      type: "resource",
      title: index === 9_999 ? "Needle project plan" : `Project note ${index}`,
      subtitle: `Workspace ${index % 250}`,
      keywords: [`profile-${index % 24}`, `kind-note`, `ordinal-${index}`],
      sourceId: `resource-${index}`,
      profileId: `profile-${index % 24}`,
      workspaceIds: [`workspace-${index % 250}`],
      updatedAt: new Date(index).toISOString(),
    }));
    const indexStarted = performance.now();
    await service.index(documents);
    metrics.searchIndex10000Ms = performance.now() - indexStarted;
    const queryStarted = performance.now();
    const results = await service.query("needle", {
      activeProfileId: "profile-23",
      activeWorkspaceId: "workspace-249",
    });
    metrics.searchQuery10000Ms = performance.now() - queryStarted;

    expect(results[0]?.document.sourceId).toBe("resource-9999");
    expect(await service.listDocuments()).toHaveLength(10_000);
    await service.index([{ ...documents[9_999], title: "Renamed exact target" }]);
    expect(await service.query("needle")).toHaveLength(0);
    expect(await service.query("renamed exact target")).toHaveLength(1);
  }, 30_000);

  it("generates Continue Working deterministically for 10,000 Resources", () => {
    const resources = Array.from({ length: 10_000 }, (_, index) => makeResource(`resource-${index}`, index));
    const profile = makeProfile("profile-1");
    const workspace = makeWorkspace("workspace-1", profile.id);
    const session = makeSession(profile.id, workspace.id, "resource-9999");
    const started = performance.now();
    const first = rankContinueWorking({ session, profiles: [profile], workspaces: [workspace], resources });
    metrics.continueWorking10000Ms = performance.now() - started;
    const second = rankContinueWorking({ session, profiles: [profile], workspaces: [workspace], resources });

    expect(first).toHaveLength(10_000);
    expect(first[0]?.resourceId).toBe("resource-9999");
    expect(second.map(({ resourceId }) => resourceId)).toEqual(first.map(({ resourceId }) => resourceId));
  }, 30_000);

  it("replays 20,000 operations deterministically and suppresses duplicate replay", async () => {
    const bus = new InMemoryEventBus();
    const operations = new MemoryOperationRepository();
    const receipts = new MemoryRepository<SyncReplayReceipt>();
    const repositories = {
      operations,
      receipts,
      deviceStates: new MemoryRepository<SyncDeviceState>(),
      conflicts: new MemoryRepository<SyncConflict>(),
    };
    let applied = 0;
    const engine = new SynchronizationEngine(bus, repositories, {
      async getUpdatedAt() {
        return undefined;
      },
      async apply() {
        applied += 1;
        return true;
      },
    });
    await engine.start();
    const values = Array.from({ length: 20_000 }, (_, index) => makeOperation(index));
    const started = performance.now();
    await engine.replay([...values].reverse());
    metrics.syncReplay20000Ms = performance.now() - started;
    const duplicateStarted = performance.now();
    await engine.replay(values);
    metrics.syncDuplicateReplay20000Ms = performance.now() - duplicateStarted;

    expect(applied).toBe(20_000);
    expect(await receipts.list()).toHaveLength(20_000);
    await engine.stop();
  }, 60_000);

  it("survives an integrated event storm without duplicate derived records or subscriptions", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const started = performance.now();
    for (let index = 0; index < 250; index += 1) {
      const resource = await core.shell.createNote(undefined, `Storm resource ${index}`);
      if (index % 25 === 0) await core.shell.renameResource(resource.id, `Renamed storm resource ${index}`);
    }
    metrics.integratedEventStorm250Ms = performance.now() - started;
    const snapshot = core.shell.getSnapshotSync();
    const documents = await core.registry.resolve("searchService").listDocuments();
    const activities = await core.shell.recentActivities(500);
    const pending = await core.shell.pendingSyncOperations();

    expect(new Set(snapshot.resources.all.map(({ id }) => id)).size).toBe(250);
    expect(new Set(documents.map(({ id }) => id)).size).toBe(documents.length);
    expect(new Set(activities.map(({ id }) => id)).size).toBe(activities.length);
    expect(new Set(pending.map(({ id }) => id)).size).toBe(pending.length);
    await core.suspend();
    await core.resume();
    await core.suspend();
    await core.resume();
    await core.shutdown();
  }, 60_000);

  it("reports benchmark measurements", () => {
    console.info(`KARYA_RELIABILITY_METRICS=${JSON.stringify(metrics)}`);
    expect(Object.keys(metrics)).toHaveLength(7);
  });
});

class MemoryRepository<TEntity extends { id: EntityId }> implements Repository<TEntity> {
  protected readonly values = new Map<EntityId, TEntity>();
  async list() {
    return [...this.values.values()].map((value) => ({ ...value }));
  }
  async get(id: EntityId) {
    const value = this.values.get(id);
    return value ? { ...value } : undefined;
  }
  async save(entity: TEntity) {
    this.values.set(entity.id, { ...entity });
  }
  async delete(id: EntityId) {
    this.values.delete(id);
  }
}

class MemoryOperationRepository extends MemoryRepository<SyncOperation> implements SyncOperationRepository {
  async append(operation: SyncOperation) {
    if (this.values.has(operation.id)) return false;
    await this.save(operation);
    return true;
  }
  async list(state?: SyncOperation["acknowledgementState"]) {
    return (await super.list()).filter((operation) => !state || operation.acknowledgementState === state);
  }
  async updateAcknowledgement(id: EntityId, state: SyncOperation["acknowledgementState"], at?: string) {
    const operation = await this.get(id);
    if (!operation) throw new Error(`Missing operation ${id}`);
    const updated = { ...operation, acknowledgementState: state, acknowledgedAt: at };
    await this.save(updated);
    return updated;
  }
}

function makeResource(id: string, tick: number): Resource {
  const timestamp = new Date(tick).toISOString();
  return {
    id,
    type: "note",
    profileId: "profile-1",
    owner: "profile-1",
    workspaceRefs: ["workspace-1"],
    primaryWorkspaceId: "workspace-1",
    lifecycleState: "active",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      title: `Resource ${id}`,
      kind: "note",
      description: "",
      attributes: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: "profile-1",
      updatedBy: "profile-1",
      tags: [],
    },
  } as unknown as Resource;
}

function makeProfile(id: string): Profile {
  return {
    id,
    name: "Profile",
    defaultSpaceId: "workspace-1",
    spaceIds: ["workspace-1"],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    lifecycleState: "active",
    template: "custom",
    preferences: { favoriteWorkspaceIds: [], defaultApplicationIds: [], defaultCreateTemplateIds: [] },
  };
}

function makeWorkspace(id: string, profileId: string): Workspace {
  const timestamp = new Date(0).toISOString();
  return {
    id,
    name: "Workspace",
    profileId,
    owner: profileId,
    lifecycleState: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
    resourceRefs: [],
    metadata: {
      name: "Workspace",
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: profileId,
      updatedBy: profileId,
    },
  } as unknown as Workspace;
}

function makeSession(profileId: string, workspaceId: string, activeResourceId: string): ContinuitySession {
  const timestamp = new Date(0).toISOString();
  return {
    id: "session-1",
    activeProfileId: profileId,
    activeWorkspaceId: workspaceId,
    recentResourceIds: [activeResourceId],
    layout: { sidebarCollapsed: false, inspectorOpen: false, activeSurface: "workspace" },
    startedAt: timestamp,
    updatedAt: timestamp,
    workspaceSessions: {
      [workspaceId]: {
        id: "workspace-session-1",
        workspaceId,
        profileId,
        startedAt: timestamp,
        lastActiveAt: timestamp,
        activeResourceIds: [activeResourceId],
        recentResourceIds: [activeResourceId],
        launchedApplicationIds: [],
        state: "active",
        resumeCount: 0,
        lastSelectedResourceId: activeResourceId,
        activityTimeline: [],
      },
    },
  };
}

function makeOperation(index: number): SyncOperation {
  return {
    id: `operation-${index.toString().padStart(5, "0")}`,
    deviceId: `device-${index % 3}`,
    sequence: index,
    timestamp: new Date(index).toISOString(),
    entityType: "resource",
    entityId: `resource-${index}`,
    operationType: "ResourceUpdated",
    payload: "{}",
    dependencies: [],
    acknowledgementState: "pending",
  };
}
