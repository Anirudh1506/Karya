/// <reference path="../better-sqlite3.d.ts" />
import type { Database } from "better-sqlite3";
import type { NotificationRepository, NotificationRepositoryQuery } from "@karya/persistence";
import type { EntityId, KaryaNotification } from "@karya/types";

interface NotificationRow {
  payload: string;
}

export class SqliteNotificationRepository implements NotificationRepository {
  constructor(private readonly database: Database) {}

  async create(notification: KaryaNotification): Promise<boolean> {
    const result = this.database
      .prepare(
        `INSERT OR IGNORE INTO notifications
      (id, activity_id, created_at, profile_id, workspace_id, resource_id, status, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        notification.id,
        notification.activityId ?? null,
        notification.createdAt,
        notification.profileId ?? null,
        notification.workspaceId ?? null,
        notification.resourceId ?? null,
        notification.status,
        JSON.stringify(notification),
      ) as { changes: number };
    return result.changes > 0;
  }
  async save(notification: KaryaNotification): Promise<void> {
    this.database
      .prepare(`UPDATE notifications SET status = ?, payload = ? WHERE id = ?`)
      .run(notification.status, JSON.stringify(notification), notification.id);
  }
  async list(query: NotificationRepositoryQuery = {}): Promise<KaryaNotification[]> {
    const clauses: string[] = [];
    const values: Array<string | number> = [];
    if (query.profileId) {
      clauses.push("profile_id = ?");
      values.push(query.profileId);
    }
    if (query.workspaceId) {
      clauses.push("workspace_id = ?");
      values.push(query.workspaceId);
    }
    if (query.unreadOnly) clauses.push("status = 'unread'");
    if (!query.includeDismissed) clauses.push("status NOT IN ('dismissed', 'archived', 'deleted')");
    values.push(query.limit ?? 500);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.database
      .prepare(`SELECT payload FROM notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(...values) as NotificationRow[];
    return rows.map(({ payload }) => JSON.parse(payload) as KaryaNotification);
  }
  async get(id: EntityId): Promise<KaryaNotification | undefined> {
    const row = this.database.prepare("SELECT payload FROM notifications WHERE id = ?").get(id) as
      NotificationRow | undefined;
    return row ? (JSON.parse(row.payload) as KaryaNotification) : undefined;
  }
  async countUnread(profileId?: EntityId): Promise<number> {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS count FROM notifications WHERE status = 'unread'${profileId ? " AND profile_id = ?" : ""}`,
      )
      .get(...(profileId ? [profileId] : [])) as { count: number };
    return row.count;
  }
}
