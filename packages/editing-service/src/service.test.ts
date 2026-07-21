import { InMemoryEventBus } from "@karya/event-bus";
import type { Repository } from "@karya/persistence";
import type { ResourceService } from "@karya/resource-service";
import type { EditableResourceContent, EditCheckpoint, EditSession, EntityId, Resource } from "@karya/types";
import { describe, expect, it, vi } from "vitest";
import { DefaultResourceEditingService } from "./service";

describe("Resource Editing Engine", () => {
  it("tracks dirty state, autosaves deterministically, and publishes lifecycle events", async () => {
    vi.useFakeTimers();
    const fixture = createFixture(25);
    const names: string[] = [];
    fixture.bus.subscribe("EditSessionStarted", () => {
      names.push("started");
    });
    fixture.bus.subscribe("ResourceContentChanged", () => {
      names.push("changed");
    });
    fixture.bus.subscribe("AutosaveStarted", () => {
      names.push("saving");
    });
    fixture.bus.subscribe("AutosaveCompleted", () => {
      names.push("saved");
    });
    const { session } = await fixture.service.open("note-1");
    const dirty = await fixture.service.change(session.id, "A thought worth keeping");
    expect(dirty.dirty).toBe(true);
    expect((await fixture.contents.get("note-1"))?.text).toBe("A thought worth keeping");
    await vi.advanceTimersByTimeAsync(25);
    expect((await fixture.service.getSession(session.id))?.dirty).toBe(false);
    expect(names).toEqual(["started", "changed", "saving", "saved"]);
    vi.useRealTimers();
  });

  it("creates first-edit and session-end checkpoints", async () => {
    const fixture = createFixture(60_000);
    const { session } = await fixture.service.open("note-1");
    await fixture.service.change(session.id, "one");
    await fixture.service.change(session.id, "two");
    await fixture.service.close(session.id);
    expect((await fixture.service.listCheckpoints("note-1")).map((item) => item.kind)).toEqual([
      "first-edit",
      "session-end",
    ]);
  });

  it("restores a dirty session and recovery content after restart", async () => {
    const fixture = createFixture(60_000);
    const opened = await fixture.service.open("note-1");
    await fixture.service.change(opened.session.id, "recover me");
    const restarted = new DefaultResourceEditingService(
      fixture.bus,
      fixture.resources,
      {
        contents: fixture.contents,
        sessions: fixture.sessions,
        checkpoints: fixture.checkpoints,
      },
      60_000,
    );
    await restarted.start();
    const restored = await restarted.open("note-1");
    expect(restored.session.id).toBe(opened.session.id);
    expect(restored.session.dirty).toBe(true);
    expect(restored.content.text).toBe("recover me");
    await restarted.shutdown();
  });
});

function createFixture(delay: number) {
  const bus = new InMemoryEventBus();
  const resource: Resource = {
    id: "note-1",
    type: "note",
    profileId: "profile-1",
    owner: "profile-1",
    workspaceRefs: ["workspace-1"],
    primaryWorkspaceId: "workspace-1",
    lifecycleState: "active",
    status: "active",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    metadata: {
      title: "Note",
      kind: "note",
      description: "",
      attributes: {},
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      createdBy: "profile-1",
      updatedBy: "profile-1",
      tags: [],
    },
  } as unknown as Resource;
  const resources = {
    async getResource() {
      return resource;
    },
    async updateMetadata(_id: EntityId, patch: Partial<Resource["metadata"]>) {
      resource.metadata = { ...resource.metadata, ...patch };
      resource.updatedAt = new Date().toISOString();
      return resource;
    },
  } as unknown as ResourceService;
  const contents = new MemoryRepository<EditableResourceContent>();
  const sessions = new MemoryRepository<EditSession>();
  const checkpoints = new MemoryRepository<EditCheckpoint>();
  return {
    bus,
    resources,
    contents,
    sessions,
    checkpoints,
    service: new DefaultResourceEditingService(bus, resources, { contents, sessions, checkpoints }, delay),
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
