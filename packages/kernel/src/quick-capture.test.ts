import { describe, expect, it } from "vitest";
import { CaptureContextError } from "@karya/capture-service";
import type { SessionRepository } from "@karya/persistence";
import { InMemoryResourceRepository } from "@karya/resource-service";
import type { ContinuitySession } from "@karya/types";
import { InMemoryWorkspaceRepository } from "@karya/workspace-service";
import { createKaryaCore } from "./factory";
import { createSeedData } from "./seed-data";

describe("Quick Capture", () => {
  it("owns the lifecycle and updates platform consumers through events", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    const events: string[] = [];
    core.registry.resolve("eventBus").subscribe("CaptureStarted", () => {
      events.push("started");
    });
    core.registry.resolve("eventBus").subscribe("ResourceCreated", () => {
      events.push("resource-created");
    });
    core.registry.resolve("eventBus").subscribe("CaptureCompleted", () => {
      events.push("completed");
    });
    await core.boot();

    const capture = await core.shell.beginCapture();
    const resource = await core.shell.completeCapture(capture.id, "  Remember this  ");

    expect(events).toEqual(["started", "resource-created", "completed"]);
    expect(resource).toMatchObject({
      profileId: capture.profileId,
      primaryWorkspaceId: capture.workspaceId,
      workspaceRefs: [capture.workspaceId],
      metadata: { title: "Remember this", kind: "note" },
    });
    expect(core.shell.getSnapshotSync().resources.all.map((item) => item.id)).toContain(resource.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).toContain(
      resource.id,
    );
    expect((await core.shell.search("Remember this")).map((result) => result.document.sourceId)).toContain(resource.id);
    await core.shutdown();
  });

  it("publishes cancellation without creating a Resource", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    let cancelledId: string | undefined;
    core.registry.resolve("eventBus").subscribe("CaptureCancelled", ({ capture }) => {
      cancelledId = capture.id;
    });
    await core.boot();
    const before = core.shell.getSnapshotSync().resources.all.length;

    const capture = await core.shell.beginCapture();
    await core.shell.cancelCapture(capture.id);

    expect(cancelledId).toBe(capture.id);
    expect(core.shell.getSnapshotSync().resources.all).toHaveLength(before);
    await core.shutdown();
  });

  it("fails gracefully when no active Workspace exists", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const workspaceId = core.shell.getSnapshotSync().workspaces.active!.id;
    await core.shell.closeWorkspace(workspaceId);

    await expect(core.shell.beginCapture()).rejects.toBeInstanceOf(CaptureContextError);
    await core.shutdown();
  });

  it("restores a captured Resource from persistence after restart", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const workspaces = new InMemoryWorkspaceRepository(seed.workspaces);
    const resources = new InMemoryResourceRepository();
    const sessions = createSessionRepository(seed.session);
    const persistence = { workspaces, resources, sessions };
    const first = createKaryaCore({ seed: { includeDemoContent: false }, persistence });
    await first.boot();
    const capture = await first.shell.beginCapture();
    const resource = await first.shell.completeCapture(capture.id, "Persistent capture");
    await first.shutdown();

    const second = createKaryaCore({ seed: { includeDemoContent: false }, persistence });
    await second.boot();
    expect(second.shell.getSnapshotSync().resources.all.map((item) => item.id)).toContain(resource.id);
    expect((await second.shell.search("Persistent capture")).map((result) => result.document.sourceId)).toContain(
      resource.id,
    );
    await second.shutdown();
  });
});

function createSessionRepository(initial: ContinuitySession): SessionRepository {
  let session = initial;
  return {
    async list() {
      return [session];
    },
    async get(id) {
      return id === session.id ? session : undefined;
    },
    async save(next) {
      session = next;
    },
    async delete() {},
    async getCurrent() {
      return session;
    },
    async saveCurrent(next) {
      session = next;
    },
  };
}
