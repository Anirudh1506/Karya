import { describe, expect, it } from "vitest";
import type { ActivityRepository, NotificationRepository } from "@karya/persistence";
import type { EntityId, KaryaActivity, KaryaNotification } from "@karya/types";
import { createKaryaCore } from "./factory";

describe("Notification Engine integration", () => {
  it("selectively translates Activities, deduplicates, and owns read and dismissal state", async () => {
    const activities = memoryActivities();
    const notifications = memoryNotifications();
    const core = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities, notifications } });
    await core.boot();
    const workspace = core.shell.getSnapshotSync().workspaces.active!;
    const note = await core.shell.createNote(undefined, "No notification", "");
    await core.shell.openResource(note.id);
    expect(await core.shell.notificationCount()).toBe(0);

    await core.shell.archiveWorkspace(workspace.id);
    const [archived] = await core.shell.unreadNotifications();
    expect(archived?.notificationType).toBe("active-workspace-archived");
    expect(archived?.activityId).toBeTruthy();
    expect(await core.shell.notificationCount()).toBe(1);

    await expect(core.shell.beginCapture()).rejects.toThrow();
    expect((await core.shell.unreadNotifications()).map((item) => item.notificationType)).toContain(
      "capture-missing-context",
    );

    await core.shell.markNotificationRead(archived!.id);
    expect(await core.shell.notificationCount()).toBe(1);
    await core.shell.dismissNotification(archived!.id);
    expect((await core.shell.recentNotifications()).map(({ id }) => id)).not.toContain(archived!.id);
    expect(await notifications.get(archived!.id)).toMatchObject({ status: "dismissed" });
    await core.shutdown();
  });

  it("restores notification state without rebuilding or duplicating it", async () => {
    const activities = memoryActivities();
    const notifications = memoryNotifications();
    const first = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities, notifications } });
    await first.boot();
    await first.shell.archiveWorkspace(first.shell.getSnapshotSync().workspaces.active!.id);
    const before = await first.shell.unreadNotifications();
    await first.shutdown();

    const second = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities, notifications } });
    await second.boot();
    expect((await second.shell.unreadNotifications()).map(({ id }) => id)).toEqual(before.map(({ id }) => id));
    await second.shutdown();
  });

  it("filters by active Profile and resolves Resource navigation through Core", async () => {
    const activities = memoryActivities();
    const notifications = memoryNotifications();
    const core = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { activities, notifications } });
    await core.boot();
    const origin = core.shell.getSnapshotSync().workspaces.active!;
    const resource = await core.shell.createNote(undefined, "Moved attention", "");
    const destination = await core.shell.createWorkspace("Destination");
    await core.shell.openWorkspace(origin.id);
    await core.shell.moveResource(resource.id, { workspaceId: destination.id });
    const [notification] = await core.shell.unreadNotifications();
    expect(notification?.notificationType).toBe("resource-moved-from-active-workspace");

    const otherProfile = await core.shell.createProfile("Other Profile");
    expect(await core.shell.recentNotifications()).toEqual([]);
    await core.shell.switchProfile(origin.profileId);
    await core.shell.openNotification(notification!.id);
    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe(origin.profileId);
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(destination.id);
    expect(core.shell.getSnapshotSync().resources.selectedId).toBe(resource.id);
    expect(otherProfile.id).not.toBe(origin.profileId);
    await core.shutdown();
  });
});

function memoryActivities(): ActivityRepository {
  const values = new Map<EntityId, KaryaActivity>();
  return {
    async append(item) {
      if (!values.has(item.id)) values.set(item.id, item);
    },
    async list() {
      return [...values.values()];
    },
    async get(id) {
      return values.get(id);
    },
  };
}

function memoryNotifications(): NotificationRepository {
  const values = new Map<EntityId, KaryaNotification>();
  return {
    async create(item) {
      if (values.has(item.id)) return false;
      values.set(item.id, item);
      return true;
    },
    async save(item) {
      values.set(item.id, item);
    },
    async get(id) {
      return values.get(id);
    },
    async list(query = {}) {
      return [...values.values()]
        .filter(
          (item) =>
            (!query.profileId || item.profileId === query.profileId) &&
            (!query.workspaceId || item.workspaceId === query.workspaceId) &&
            (!query.unreadOnly || item.status === "unread") &&
            (query.includeDismissed || !["dismissed", "archived", "deleted"].includes(item.status)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, query.limit ?? 500);
    },
    async countUnread(profileId) {
      return [...values.values()].filter(
        (item) => item.status === "unread" && (!profileId || item.profileId === profileId),
      ).length;
    },
  };
}
