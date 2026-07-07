/// <reference path="../better-sqlite3.d.ts" />
import type { SessionRepository } from "@karya/persistence";
import type { ContinuitySession, EntityId } from "@karya/types";
import type { Database } from "better-sqlite3";
import { parseJson, serializeJson } from "../json";
import type { PayloadRow } from "./rows";

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly database: Database) {}

  async list(): Promise<ContinuitySession[]> {
    return (this.database.prepare("SELECT payload FROM continuity_sessions ORDER BY updated_at DESC").all() as PayloadRow[])
      .map((row) => parseJson<ContinuitySession>(row.payload));
  }

  async get(id: EntityId): Promise<ContinuitySession | undefined> {
    const row = this.database.prepare("SELECT payload FROM continuity_sessions WHERE id = ?").get(id) as PayloadRow | undefined;
    return row ? parseJson<ContinuitySession>(row.payload) : undefined;
  }

  async save(session: ContinuitySession): Promise<void> {
    this.saveWithCurrentFlag(session, false);
  }

  async delete(id: EntityId): Promise<void> {
    this.database.prepare("DELETE FROM continuity_sessions WHERE id = ?").run(id);
  }

  async getCurrent(): Promise<ContinuitySession | undefined> {
    const row = this.database.prepare("SELECT payload FROM continuity_sessions WHERE is_current = 1 LIMIT 1").get() as PayloadRow | undefined;
    return row ? parseJson<ContinuitySession>(row.payload) : undefined;
  }

  async saveCurrent(session: ContinuitySession): Promise<void> {
    const save = this.database.transaction(() => {
      this.database.prepare("UPDATE continuity_sessions SET is_current = 0").run();
      this.saveWithCurrentFlag(session, true);
    });
    save();
  }

  private saveWithCurrentFlag(session: ContinuitySession, isCurrent: boolean): void {
    this.database.prepare(`
      INSERT INTO continuity_sessions (id, active_profile_id, active_workspace_id, updated_at, is_current, payload)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        active_profile_id = excluded.active_profile_id,
        active_workspace_id = excluded.active_workspace_id,
        updated_at = excluded.updated_at,
        is_current = excluded.is_current,
        payload = excluded.payload
    `).run(
      session.id,
      session.activeProfileId,
      session.activeWorkspaceId ?? null,
      session.updatedAt,
      isCurrent ? 1 : 0,
      serializeJson(session),
    );
  }
}
