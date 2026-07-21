/// <reference path="./better-sqlite3.d.ts" />
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KaryaMetadataStore } from "./metadata-store";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("SQLite reliability at local-first scale", () => {
  it("validates WAL, indexes, growth, startup, and representative queries", async () => {
    const directory = mkdtempSync(join(tmpdir(), "karya-reliability-"));
    directories.push(directory);
    const databasePath = join(directory, "metadata.sqlite");
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const database = Database(databasePath);
    const timestamp = new Date(0).toISOString();

    const insertResource = database.prepare(
      "INSERT INTO resources (id, type, title, profile_id, owner_id, lifecycle_state, created_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertSearch = database.prepare(
      "INSERT INTO search_documents (id, type, title, source_id, payload) VALUES (?, ?, ?, ?, ?)",
    );
    const insertActivity = database.prepare(
      "INSERT INTO activities (id, event_type, occurred_at, profile_id, workspace_id, resource_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertNotification = database.prepare(
      "INSERT INTO notifications (id, activity_id, created_at, profile_id, workspace_id, resource_id, status, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertOperation = database.prepare(
      "INSERT INTO sync_operations (id, device_id, sequence, timestamp, acknowledgement_state, payload) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const seedStarted = performance.now();
    database.transaction(() => {
      for (let index = 0; index < 10_000; index += 1) {
        const id = `resource-${index}`;
        const profileId = `profile-${index % 24}`;
        const workspaceId = `workspace-${index % 250}`;
        const resource = resourcePayload(id, profileId, workspaceId, timestamp, index);
        insertResource.run(
          id,
          "note",
          resource.metadata.title,
          profileId,
          profileId,
          "active",
          timestamp,
          resource.updatedAt,
          JSON.stringify(resource),
        );
        const document = {
          id: `resource:${id}`,
          type: "resource",
          title: index === 9_999 ? "Needle project plan" : resource.metadata.title,
          keywords: ["note", `ordinal-${index}`],
          sourceId: id,
          profileId,
          workspaceIds: [workspaceId],
          updatedAt: resource.updatedAt,
        };
        insertSearch.run(document.id, document.type, document.title, document.sourceId, JSON.stringify(document));
        const notification = {
          id: `notification-${index}`,
          activityId: `attention-${index}`,
          notificationType: "test",
          icon: "Bell",
          title: `Attention ${index}`,
          category: "system",
          source: "reliability",
          profileId,
          workspaceId,
          status: index % 2 === 0 ? "unread" : "read",
          priority: "normal",
          groupCount: 1,
          actions: [],
          references: [],
          createdAt: new Date(index).toISOString(),
          updatedAt: new Date(index).toISOString(),
        };
        insertNotification.run(
          notification.id,
          notification.activityId,
          notification.createdAt,
          profileId,
          workspaceId,
          id,
          notification.status,
          JSON.stringify(notification),
        );
      }
      for (let index = 0; index < 50_000; index += 1) {
        const occurredAt = new Date(index).toISOString();
        const activity = {
          id: `activity-${index}`,
          eventType: "ResourceUpdated",
          category: "resource",
          verb: "edited",
          title: `Edited ${index}`,
          object: { id: `resource-${index % 10_000}`, type: "resource" },
          relatedObjects: [],
          profileId: `profile-${index % 24}`,
          workspaceId: `workspace-${index % 250}`,
          actor: { id: "local-user", type: "local-user" },
          source: "reliability",
          groupKey: `resource-${index % 10_000}`,
          groupCount: 1,
          createdAt: occurredAt,
          updatedAt: occurredAt,
          occurredAt,
        };
        insertActivity.run(
          activity.id,
          activity.eventType,
          occurredAt,
          activity.profileId,
          activity.workspaceId,
          activity.object.id,
          JSON.stringify(activity),
        );
        const operation = {
          id: `operation-${index}`,
          deviceId: "device-local",
          sequence: index,
          timestamp: occurredAt,
          entityType: "resource",
          entityId: `resource-${index % 10_000}`,
          operationType: "ResourceUpdated",
          payload: "{}",
          dependencies: [],
          acknowledgementState: index % 2 === 0 ? "pending" : "acknowledged",
        };
        insertOperation.run(
          operation.id,
          operation.deviceId,
          operation.sequence,
          occurredAt,
          operation.acknowledgementState,
          JSON.stringify(operation),
        );
      }
    })();
    const seedMs = performance.now() - seedStarted;

    expect((database.pragma("journal_mode") as Array<{ journal_mode: string }>)[0]?.journal_mode).toBe("wal");
    expect((database.pragma("integrity_check") as Array<{ integrity_check: string }>)[0]?.integrity_check).toBe("ok");
    const activityPlan = database
      .prepare(
        "EXPLAIN QUERY PLAN SELECT payload FROM activities WHERE profile_id = ? ORDER BY occurred_at DESC LIMIT 50",
      )
      .all("profile-1") as Array<{ detail: string }>;
    const notificationPlan = database
      .prepare(
        "EXPLAIN QUERY PLAN SELECT payload FROM notifications WHERE profile_id = ? AND status = 'unread' ORDER BY created_at DESC LIMIT 50",
      )
      .all("profile-0") as Array<{ detail: string }>;
    const syncPlan = database
      .prepare(
        "EXPLAIN QUERY PLAN SELECT payload FROM sync_operations WHERE acknowledgement_state = ? ORDER BY timestamp, device_id, sequence, id",
      )
      .all("pending") as Array<{ detail: string }>;
    expect(activityPlan.some(({ detail }) => detail.includes("idx_activities_profile"))).toBe(true);
    expect(notificationPlan.some(({ detail }) => detail.includes("idx_notifications_profile_status"))).toBe(true);
    expect(syncPlan.some(({ detail }) => detail.includes("idx_sync_operations_queue"))).toBe(true);
    database.pragma("wal_checkpoint(TRUNCATE)");
    database.close();

    const resourceStarted = performance.now();
    const resourcePage = await store.resourceQueries.listResources({ workspaceId: "workspace-249", limit: 50 });
    const resourceQueryMs = performance.now() - resourceStarted;
    const searchStarted = performance.now();
    const searchResults = await store.searchQueries.search("needle");
    const searchMs = performance.now() - searchStarted;
    const activityStarted = performance.now();
    const activities = await store.activities.list({ profileId: "profile-1", limit: 50 });
    const activityMs = performance.now() - activityStarted;
    const notificationStarted = performance.now();
    const unread = await store.notifications.countUnread("profile-0");
    const notificationMs = performance.now() - notificationStarted;
    const syncStarted = performance.now();
    const pending = await store.syncOperations.list("pending");
    const syncQueueRestoreMs = performance.now() - syncStarted;
    const databaseBytes = statSync(databasePath).size;

    expect(resourcePage.total).toBe(40);
    expect(searchResults[0]?.document.sourceId).toBe("resource-9999");
    expect(activities).toHaveLength(50);
    expect(unread).toBeGreaterThan(0);
    expect(pending).toHaveLength(25_000);
    await store.close();

    const restartStarted = performance.now();
    const restarted = new KaryaMetadataStore({ databasePath });
    await restarted.initialize();
    const restartMs = performance.now() - restartStarted;
    await restarted.close();

    console.info(
      `KARYA_SQLITE_METRICS=${JSON.stringify({
        seedMs,
        databaseBytes,
        restartMs,
        resourceQueryMs,
        searchMs,
        activityMs,
        notificationMs,
        syncQueueRestoreMs,
      })}`,
    );
  }, 60_000);
});

function resourcePayload(id: string, profileId: string, workspaceId: string, timestamp: string, index: number) {
  return {
    id,
    type: "note",
    metadata: {
      title: `Project note ${index}`,
      description: "Reliability validation",
      kind: "note",
      createdAt: timestamp,
      updatedAt: new Date(index).toISOString(),
      createdBy: profileId,
      updatedBy: profileId,
      attributes: {},
    },
    owner: profileId,
    profileId,
    workspaceRefs: [workspaceId],
    primaryWorkspaceId: workspaceId,
    defaultSpace: "none",
    tags: [],
    relationships: [],
    permissions: { ownerCanEdit: true, sharedWith: [] },
    versionInfo: { version: 1 },
    status: "active",
    lifecycleState: "active",
    createdAt: timestamp,
    updatedAt: new Date(index).toISOString(),
  };
}
