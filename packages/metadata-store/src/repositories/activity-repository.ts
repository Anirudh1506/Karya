/// <reference path="../better-sqlite3.d.ts" />
import type { Database } from "better-sqlite3";
import type { ActivityRepository, ActivityRepositoryQuery } from "@karya/persistence";
import type { EntityId, KaryaActivity } from "@karya/types";

interface ActivityRow {
  id: string;
  payload: string;
}

export class SqliteActivityRepository implements ActivityRepository {
  constructor(private readonly database: Database) {}

  async append(activity: KaryaActivity): Promise<void> {
    this.database
      .prepare(
        `
      INSERT OR IGNORE INTO activities (
        id, event_type, occurred_at, profile_id, workspace_id, resource_id, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        activity.id,
        activity.eventType,
        activity.occurredAt,
        activity.profileId ?? null,
        activity.workspaceId ?? null,
        activity.object.type === "resource" ? activity.object.id : null,
        JSON.stringify(activity),
      );
  }

  async list(query: ActivityRepositoryQuery = {}): Promise<KaryaActivity[]> {
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
    if (query.resourceId) {
      clauses.push("resource_id = ?");
      values.push(query.resourceId);
    }
    if (query.eventType) {
      clauses.push("event_type = ?");
      values.push(query.eventType);
    }
    values.push(query.limit ?? 500);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.database
      .prepare(`SELECT id, payload FROM activities ${where} ORDER BY occurred_at DESC, id DESC LIMIT ?`)
      .all(...values) as ActivityRow[];
    return rows.map((row) => JSON.parse(row.payload) as KaryaActivity);
  }

  async get(id: EntityId): Promise<KaryaActivity | undefined> {
    const row = this.database.prepare("SELECT id, payload FROM activities WHERE id = ?").get(id) as
      ActivityRow | undefined;
    return row ? (JSON.parse(row.payload) as KaryaActivity) : undefined;
  }
}
