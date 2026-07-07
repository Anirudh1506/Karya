/// <reference path="./better-sqlite3.d.ts" />
import type { Database } from "better-sqlite3";

const CURRENT_SCHEMA_VERSION = 1;

export function migrateMetadataStore(database: Database): void {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const current = getCurrentVersion(database);
  if (current > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Metadata store schema ${current} is newer than this Karya build supports`);
  }

  if (current < 1) {
    applyInitialMigration(database);
  }
}

function getCurrentVersion(database: Database): number {
  const row = database
    .prepare("SELECT MAX(version) AS version FROM schema_migrations")
    .get() as { version?: number | null } | undefined;
  return row?.version ?? 0;
}

function applyInitialMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE resource_tags (
        resource_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (resource_id, tag),
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );

      CREATE TABLE relationships (
        id TEXT PRIMARY KEY,
        source_resource_id TEXT NOT NULL,
        target_resource_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (source_resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );

      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL,
        pinned INTEGER NOT NULL,
        favorite INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE workspace_resources (
        workspace_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        PRIMARY KEY (workspace_id, resource_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );

      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        default_space_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL,
        pinned INTEGER NOT NULL,
        favorite INTEGER NOT NULL,
        hidden INTEGER NOT NULL,
        launch_count INTEGER NOT NULL,
        last_launched_at TEXT,
        payload TEXT NOT NULL
      );

      CREATE TABLE settings (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        label TEXT NOT NULL,
        searchable INTEGER NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE continuity_sessions (
        id TEXT PRIMARY KEY,
        active_profile_id TEXT NOT NULL,
        active_workspace_id TEXT,
        updated_at TEXT NOT NULL,
        is_current INTEGER NOT NULL DEFAULT 0,
        payload TEXT NOT NULL
      );

      CREATE TABLE search_documents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        source_id TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE INDEX idx_resources_profile ON resources(profile_id);
      CREATE INDEX idx_resources_lifecycle ON resources(lifecycle_state);
      CREATE INDEX idx_resource_tags_tag ON resource_tags(tag);
      CREATE INDEX idx_workspaces_profile ON workspaces(profile_id);
      CREATE INDEX idx_workspaces_lifecycle ON workspaces(lifecycle_state);
      CREATE INDEX idx_workspace_resources_resource ON workspace_resources(resource_id);
      CREATE INDEX idx_applications_category ON applications(category);
      CREATE INDEX idx_applications_lifecycle ON applications(lifecycle_state);
      CREATE INDEX idx_sessions_current ON continuity_sessions(is_current);
      CREATE INDEX idx_search_documents_type ON search_documents(type);
    `);

    database
      .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(CURRENT_SCHEMA_VERSION, new Date().toISOString());
  });

  apply();
}
