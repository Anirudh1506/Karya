/// <reference path="../better-sqlite3.d.ts" />
import type { ProfileRepository, Repository, SettingsRepository } from "@karya/persistence";
import type { EntityId, Profile, SettingDefinition } from "@karya/types";
import type { Database } from "better-sqlite3";
import { parseJson, serializeJson } from "../json";
import type { PayloadRow } from "./rows";

export class SqliteJsonRepository<TEntity extends { id: EntityId }> implements Repository<TEntity> {
  constructor(
    private readonly database: Database,
    private readonly table: string,
    private readonly orderBy = "id",
    private readonly toColumns: (entity: TEntity) => unknown[],
    private readonly upsertSql: string,
  ) {}

  async list(): Promise<TEntity[]> {
    return (this.database.prepare(`SELECT payload FROM ${this.table} ORDER BY ${this.orderBy}`).all() as PayloadRow[])
      .map((row) => parseJson<TEntity>(row.payload));
  }

  async get(id: EntityId): Promise<TEntity | undefined> {
    const row = this.database.prepare(`SELECT payload FROM ${this.table} WHERE id = ?`).get(id) as PayloadRow | undefined;
    return row ? parseJson<TEntity>(row.payload) : undefined;
  }

  async save(entity: TEntity): Promise<void> {
    this.database.prepare(this.upsertSql).run(...this.toColumns(entity), serializeJson(entity));
  }

  async delete(id: EntityId): Promise<void> {
    this.database.prepare(`DELETE FROM ${this.table} WHERE id = ?`).run(id);
  }
}



export function createProfileRepository(database: Database): ProfileRepository {
  return new SqliteJsonRepository<Profile>(
    database,
    "profiles",
    "name ASC",
    (profile) => [profile.id, profile.name, profile.defaultSpaceId, profile.createdAt],
    `
      INSERT INTO profiles (id, name, default_space_id, created_at, payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        default_space_id = excluded.default_space_id,
        created_at = excluded.created_at,
        payload = excluded.payload
    `,
  );
}

export function createSettingsRepository(database: Database): SettingsRepository {
  return new SqliteJsonRepository<SettingDefinition>(
    database,
    "settings",
    "category ASC, label ASC",
    (setting) => [setting.id, setting.category, setting.label, setting.searchable ? 1 : 0],
    `
      INSERT INTO settings (id, category, label, searchable, payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        label = excluded.label,
        searchable = excluded.searchable,
        payload = excluded.payload
    `,
  );
}
