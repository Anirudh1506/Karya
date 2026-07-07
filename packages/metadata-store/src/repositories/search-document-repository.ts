/// <reference path="../better-sqlite3.d.ts" />
import type { SearchDocumentRepository } from "@karya/persistence";
import type { EntityId, SearchDocument } from "@karya/types";
import type { Database } from "better-sqlite3";
import { parseJson, serializeJson } from "../json";
import type { PayloadRow } from "./rows";

export class SqliteSearchDocumentRepository implements SearchDocumentRepository {
  constructor(private readonly database: Database) {}

  async list(): Promise<SearchDocument[]> {
    return (this.database.prepare("SELECT payload FROM search_documents ORDER BY title ASC").all() as PayloadRow[])
      .map((row) => parseJson<SearchDocument>(row.payload));
  }

  async get(id: EntityId): Promise<SearchDocument | undefined> {
    const row = this.database.prepare("SELECT payload FROM search_documents WHERE id = ?").get(id) as PayloadRow | undefined;
    return row ? parseJson<SearchDocument>(row.payload) : undefined;
  }

  async save(document: SearchDocument): Promise<void> {
    this.database.prepare(`
      INSERT INTO search_documents (id, type, title, source_id, payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        source_id = excluded.source_id,
        payload = excluded.payload
    `).run(document.id, document.type, document.title, document.sourceId, serializeJson(document));
  }

  async delete(id: EntityId): Promise<void> {
    this.database.prepare("DELETE FROM search_documents WHERE id = ?").run(id);
  }

  async clear(): Promise<void> {
    this.database.prepare("DELETE FROM search_documents").run();
  }
}
