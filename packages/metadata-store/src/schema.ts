/// <reference path="./better-sqlite3.d.ts" />
import type { Database } from "better-sqlite3";
import { CURRENT_SCHEMA_VERSION, NULLABLE_PROFILE_DEFAULT_SPACE_MIGRATION_VERSION } from "./constants";

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
  if (current < 2) {
    applyActivityMigration(database);
  }
  if (current < 3) applyNotificationMigration(database);
  if (current < 4) applyEditingMigration(database);
  if (current < 5) applySynchronizationMigration(database);
  if (current < 6) applyAccountMigration(database);
  if (current < 7) applyTransportMigration(database);
  if (current < NULLABLE_PROFILE_DEFAULT_SPACE_MIGRATION_VERSION) {
    applyNullableProfileDefaultSpaceMigration(database);
  }
}

function applyNullableProfileDefaultSpaceMigration(database: Database): void {
  const apply = database.transaction(() => {
    const columns = database.prepare("PRAGMA table_info(profiles)").all() as Array<{
      name: string;
      notnull: number;
    }>;
    const defaultSpaceColumn = columns.find((column) => column.name === "default_space_id");

    if (defaultSpaceColumn?.notnull === 1) {
      database.exec(`
        ALTER TABLE profiles RENAME TO profiles_with_required_default_space;

        CREATE TABLE profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          default_space_id TEXT,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );

        INSERT INTO profiles (id, name, default_space_id, created_at, payload)
        SELECT id, name, default_space_id, created_at, payload
        FROM profiles_with_required_default_space;

        DROP TABLE profiles_with_required_default_space;
      `);
    }

    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(NULLABLE_PROFILE_DEFAULT_SPACE_MIGRATION_VERSION, new Date().toISOString());
  });
  apply();
}

function applyTransportMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS transport_sessions (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_transport_sessions_updated ON transport_sessions(updated_at DESC);
    `);
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(7, new Date().toISOString());
  });
  apply();
}

function applyAccountMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_accounts_updated ON accounts(updated_at DESC);
      CREATE TABLE IF NOT EXISTS trusted_devices (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_updated ON trusted_devices(updated_at DESC);
    `);
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(6, new Date().toISOString());
  });
  apply();
}

function applySynchronizationMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sync_operations (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, sequence INTEGER NOT NULL, timestamp TEXT NOT NULL, acknowledgement_state TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_operations_device_sequence ON sync_operations(device_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_queue ON sync_operations(acknowledgement_state, timestamp, id);
      CREATE TABLE IF NOT EXISTS sync_device_states (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_replay_receipts (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_conflicts (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
    `);
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(5, new Date().toISOString());
  });
  apply();
}

function applyEditingMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS editable_contents (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS edit_sessions (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS edit_checkpoints (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_editable_contents_updated ON editable_contents(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_edit_sessions_updated ON edit_sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_edit_checkpoints_updated ON edit_checkpoints(updated_at DESC);
    `);
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(4, new Date().toISOString());
  });
  apply();
}

function applyNotificationMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        activity_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        profile_id TEXT,
        workspace_id TEXT,
        resource_id TEXT,
        status TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_profile_status ON notifications(profile_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id, created_at DESC);
    `);
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(3, new Date().toISOString());
  });
  apply();
}

function applyActivityMigration(database: Database): void {
  const apply = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        profile_id TEXT,
        workspace_id TEXT,
        resource_id TEXT,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activities_occurred ON activities(occurred_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_profile ON activities(profile_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_resource ON activities(resource_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activities_event_type ON activities(event_type, occurred_at DESC);
    `);
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(2, new Date().toISOString());
  });
  apply();
}

function getCurrentVersion(database: Database): number {
  const row = database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as
    { version?: number | null } | undefined;
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
        default_space_id TEXT,
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
