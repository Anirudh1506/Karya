import { describe, expect, it } from "vitest";
import type { ActivityRepository } from "@karya/persistence";
import type { EntityId, KaryaActivity } from "@karya/types";
import { createKaryaCore } from "./factory";

describe("Activity Timeline Core integration", () => {
  it("records meaningful Resource history, supports queries, and navigates through context resolution", async () => {
    const activities = memoryActivityRepository();
    const core = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities } });
    await core.boot();
    const origin = core.shell.getSnapshotSync().workspaces.active!;
    const resource = await core.shell.createNote(undefined, "Timeline note", "");
    await core.shell.renameResource(resource.id, "Timeline renamed");
    const target = await core.shell.createWorkspace("Timeline target");
    await core.shell.openWorkspace(origin.id);
    await core.shell.moveResource(resource.id, { workspaceId: target.id });
    await core.shell.openWorkspace(target.id);
    await core.shell.archiveResource(resource.id);
    await core.shell.restoreResource(resource.id);

    const resourceHistory = await core.shell.activitiesByResource(resource.id);
    expect(resourceHistory.map((activity) => activity.eventType)).toEqual(
      expect.arrayContaining([
        "ResourceCreated",
        "ResourceRenamed",
        "ResourceMoved",
        "ResourceArchived",
        "ResourceRestored",
      ]),
    );
    expect(await core.shell.activitiesByWorkspace(target.id)).not.toHaveLength(0);
    expect((await core.shell.activitiesByEventType("ResourceRenamed"))[0]?.object.id).toBe(resource.id);
    const activity = (await core.shell.activitiesByEventType("ResourceRestored"))[0]!;
    await core.shell.openWorkspace(origin.id);
    await core.shell.openActivity(activity.id);
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(target.id);
    expect(core.shell.getSnapshotSync().resources.selectedId).toBe(resource.id);
    await core.shutdown();
  });

  it("restores the append-only timeline from persistence", async () => {
    const activities = memoryActivityRepository();
    const first = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities } });
    await first.boot();
    const resource = await first.shell.createNote(undefined, "Restored history", "");
    const before = await first.shell.activitiesByResource(resource.id);
    await first.shutdown();

    const second = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities } });
    await second.boot();
    expect((await second.shell.activitiesByResource(resource.id)).map((activity) => activity.id)).toEqual(
      before.map((activity) => activity.id),
    );
    await second.shutdown();
  });
});

function memoryActivityRepository(): ActivityRepository {
  const values = new Map<EntityId, KaryaActivity>();
  return {
    async append(activity) {
      if (!values.has(activity.id)) values.set(activity.id, activity);
    },
    async list() {
      return [...values.values()];
    },
    async get(id) {
      return values.get(id);
    },
  };
}
