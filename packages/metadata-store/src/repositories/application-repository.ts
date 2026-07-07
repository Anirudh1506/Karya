/// <reference path="../better-sqlite3.d.ts" />
import type { ApplicationRepository } from "@karya/application-registry";
import type { EntityId, InstalledApplication } from "@karya/types";
import type { Database } from "better-sqlite3";
import { parseJson, serializeJson } from "../json";
import type { PayloadRow } from "./rows";

export class SqliteApplicationRepository implements ApplicationRepository {
  constructor(private readonly database: Database) {}

  async list(): Promise<InstalledApplication[]> {
    return (this.database.prepare("SELECT payload FROM applications ORDER BY name ASC").all() as PayloadRow[])
      .map((row) => parseJson<InstalledApplication>(row.payload));
  }

  async findById(id: EntityId): Promise<InstalledApplication | undefined> {
    const row = this.database.prepare("SELECT payload FROM applications WHERE id = ?").get(id) as PayloadRow | undefined;
    return row ? parseJson<InstalledApplication>(row.payload) : undefined;
  }

  async get(id: EntityId): Promise<InstalledApplication | undefined> {
    return this.findById(id);
  }

  async save(application: InstalledApplication): Promise<void> {
    this.database.prepare(`
      INSERT INTO applications (id, name, category, lifecycle_state, pinned, favorite, hidden, launch_count, last_launched_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        lifecycle_state = excluded.lifecycle_state,
        pinned = excluded.pinned,
        favorite = excluded.favorite,
        hidden = excluded.hidden,
        launch_count = excluded.launch_count,
        last_launched_at = excluded.last_launched_at,
        payload = excluded.payload
    `).run(
      application.metadata.id,
      application.metadata.name,
      application.metadata.category ?? "other",
      application.lifecycleState,
      application.pinned ? 1 : 0,
      application.favorite ? 1 : 0,
      application.hidden ? 1 : 0,
      application.launchCount,
      application.lastLaunchedAt ?? null,
      serializeJson(application),
    );
  }

  async remove(id: EntityId): Promise<void> {
    this.database.prepare("DELETE FROM applications WHERE id = ?").run(id);
  }

  async delete(id: EntityId): Promise<void> {
    await this.remove(id);
  }
}
