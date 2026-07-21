/// <reference path="./better-sqlite3.d.ts" />
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { Identifier } from "@karya/domain";
import type { KaryaActivity, KaryaNotification, Profile, Resource, SearchDocument, Workspace } from "@karya/types";
import { toDomain as resourceToDomain } from "@karya/resource-service";
import { toDomain as workspaceToDomain } from "@karya/workspace-service";
import { KaryaMetadataStore, type MetadataStoreSeed } from "./metadata-store";
import { SqliteResourceRepository, SqliteSearchDocumentRepository, SqliteWorkspaceRepository } from "./repositories";
import { migrateMetadataStore } from "./schema";
import { CURRENT_SCHEMA_VERSION } from "./constants";

describe("KaryaMetadataStore", () => {
  it("runs the initial migration exactly once", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });

    await store.initialize();
    await store.initialize();

    const database = Database(databasePath);
    const row = database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as { version: number };
    database.close();
    await store.close();

    expect(row.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("migrates existing Profiles to allow an explicitly absent default Workspace", async () => {
    const databasePath = createDatabasePath();
    const database = Database(databasePath);
    const existingProfile: Profile = {
      id: "profile-existing",
      name: "Existing",
      defaultSpaceId: "workspace-existing",
      spaceIds: ["workspace-existing"],
      createdAt: new Date(1).toISOString(),
    };
    database.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations (version, applied_at) VALUES (7, '2026-07-17T00:00:00.000Z');
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        default_space_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `);
    database
      .prepare("INSERT INTO profiles (id, name, default_space_id, created_at, payload) VALUES (?, ?, ?, ?, ?)")
      .run(
        existingProfile.id,
        existingProfile.name,
        existingProfile.defaultSpaceId,
        existingProfile.createdAt,
        JSON.stringify(existingProfile),
      );

    migrateMetadataStore(database);
    const defaultSpaceColumn = (
      database.prepare("PRAGMA table_info(profiles)").all() as Array<{ name: string; notnull: number }>
    ).find((column) => column.name === "default_space_id");
    database.close();

    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    expect(defaultSpaceColumn?.notnull).toBe(0);
    expect(await store.profiles.get(existingProfile.id)).toEqual(existingProfile);

    const profileWithoutWorkspace: Profile = {
      id: "profile-without-workspace",
      name: "Research",
      spaceIds: [],
      createdAt: new Date(2).toISOString(),
    };
    await store.profiles.save(profileWithoutWorkspace);
    expect(await store.profiles.get(profileWithoutWorkspace.id)).toEqual(profileWithoutWorkspace);
    await store.close();
  });

  it("repairs a missing default context without replacing existing user records", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const now = "2026-07-17T00:00:00.000Z";
    const defaultProfile: Profile = {
      id: "profile-primary",
      name: "Default Profile",
      defaultSpaceId: "workspace-default-space",
      spaceIds: ["workspace-default-space"],
      createdAt: now,
    };
    const defaultWorkspace: Workspace = {
      ...createWorkspace(),
      id: "workspace-default-space",
      name: "Default Space",
      metadata: { ...createWorkspace().metadata, name: "Default Space" },
      profileId: defaultProfile.id,
      owner: defaultProfile.id,
      resourceRefs: [],
    };
    const seed: MetadataStoreSeed = {
      applications: [],
      profiles: [defaultProfile],
      resources: [],
      settings: [],
      workspaces: [defaultWorkspace],
      session: {
        id: "session-current",
        activeProfileId: defaultProfile.id,
        activeWorkspaceId: defaultWorkspace.id,
        recentResourceIds: [],
        layout: { sidebarCollapsed: false, inspectorOpen: true, activeSurface: "home" },
        startedAt: now,
        updatedAt: now,
      },
    };
    await store.profiles.save({ id: "profile-user", name: "Research", spaceIds: [], createdAt: now });
    await store.sessions.saveCurrent({
      ...seed.session,
      activeProfileId: "profile:none",
      activeWorkspaceId: undefined,
    });

    await store.seedIfEmpty(seed);

    expect((await store.profiles.list()).map((profile) => profile.id).sort()).toEqual([
      "profile-primary",
      "profile-user",
    ]);
    expect((await store.workspaces.list()).map((workspace) => workspace.id)).toContain(defaultWorkspace.id);
    expect(await store.resources.list()).toEqual([]);
    expect(await store.sessions.getCurrent()).toEqual(seed.session);
    await store.close();
  });

  it("persists Account and Trusted Device identity", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const now = new Date(1).toISOString();
    await store.accounts.save({
      id: "account-1",
      displayName: "Karya",
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: "active",
      profileIds: ["profile-1"],
      recovery: { id: "recovery-1", recoveryVersion: 1, accountGeneration: 1, updatedAt: now },
    });
    await store.trustedDevices.save({
      id: "device-1",
      accountId: "account-1",
      name: "Mac",
      platform: "macos",
      registeredAt: now,
      trustState: "trusted",
      lastSeenAt: now,
      syncCapabilities: { operations: true, content: true, background: true },
    });
    await store.close();
    const restored = new KaryaMetadataStore({ databasePath });
    await restored.initialize();
    expect(await restored.accounts.get("account-1")).toMatchObject({ displayName: "Karya" });
    expect(await restored.trustedDevices.get("device-1")).toMatchObject({ trustState: "trusted" });
    await restored.close();
  });

  it("persists the immutable synchronization queue and acknowledgement state", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const operation: import("@karya/types").SyncOperation = {
      id: "operation-1",
      deviceId: "device-1",
      sequence: 1,
      timestamp: new Date(1).toISOString(),
      entityType: "profile",
      entityId: "profile-1",
      operationType: "ProfileCreated",
      payload: "{}",
      dependencies: [],
      acknowledgementState: "pending",
    };
    expect(await store.syncOperations.append(operation)).toBe(true);
    expect(await store.syncOperations.append({ ...operation, payload: "changed" })).toBe(false);
    await store.syncOperations.updateAcknowledgement(operation.id, "acknowledged", new Date(2).toISOString());
    await store.close();

    const restored = new KaryaMetadataStore({ databasePath });
    await restored.initialize();
    const [acknowledged] = await restored.syncOperations.list("acknowledged");
    expect(acknowledged).toMatchObject({ id: operation.id, payload: operation.payload });
    await restored.close();
  });

  it("restores the transport cursor and last successful synchronization", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const updatedAt = new Date(2).toISOString();
    await store.transportSessions.save({
      id: "remote-transport",
      state: "offline",
      cursor: "42",
      retryCount: 2,
      lastSuccessfulSynchronization: new Date(1).toISOString(),
      updatedAt,
    });
    await store.close();

    const restored = new KaryaMetadataStore({ databasePath });
    await restored.initialize();
    expect(await restored.transportSessions.get("remote-transport")).toMatchObject({
      cursor: "42",
      retryCount: 2,
      updatedAt,
    });
    await restored.close();
  });

  it("restores editable content, dirty sessions, and checkpoints", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    await store.editableContents.save({
      id: "resource-1",
      resourceId: "resource-1",
      text: "draft",
      format: "plain-text",
      encoding: "utf-8",
      revision: 1,
      updatedAt: new Date(1).toISOString(),
    });
    await store.editSessions.save({
      id: "edit-1",
      resourceId: "resource-1",
      openedAt: new Date(0).toISOString(),
      lastEditedAt: new Date(1).toISOString(),
      dirty: true,
      autosaveState: "scheduled",
      status: "open",
    });
    await store.editCheckpoints.save({
      id: "edit-1:first-edit",
      resourceId: "resource-1",
      sessionId: "edit-1",
      kind: "first-edit",
      text: "",
      revision: 0,
      createdAt: new Date(1).toISOString(),
    });
    await store.close();

    const restored = new KaryaMetadataStore({ databasePath });
    await restored.initialize();
    expect((await restored.editableContents.get("resource-1"))?.text).toBe("draft");
    expect((await restored.editSessions.get("edit-1"))?.dirty).toBe(true);
    expect((await restored.editCheckpoints.list()).map((item) => item.kind)).toEqual(["first-edit"]);
    await restored.close();
  });

  it("persists Activities append-only with indexed timeline fields", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const activity = createActivity();

    await store.activities.append(activity);
    await store.activities.append({ ...activity, title: "Must not overwrite" });

    expect(await store.activities.list()).toEqual([activity]);
    expect(await store.activities.get(activity.id)).toEqual(activity);
    await store.close();
  });

  it("restores append-only Notifications and mutable attention state", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();
    const notification = createNotification();
    expect(await store.notifications.create(notification)).toBe(true);
    expect(await store.notifications.create(notification)).toBe(false);
    expect(await store.notifications.countUnread("profile-1")).toBe(1);
    await store.notifications.save({ ...notification, status: "read", readAt: notification.updatedAt });
    await store.close();

    const restored = new KaryaMetadataStore({ databasePath });
    await restored.initialize();
    expect(await restored.notifications.get(notification.id)).toMatchObject({
      status: "read",
      activityId: notification.activityId,
    });
    expect(await restored.notifications.countUnread("profile-1")).toBe(0);
    await restored.close();
  });

  it("persists resource, tag, relationship, workspace, and search document records", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();

    const resources = new SqliteResourceRepository(open(databasePath));
    const workspaces = new SqliteWorkspaceRepository(open(databasePath));
    const search = new SqliteSearchDocumentRepository(open(databasePath));
    const resource = createResource();
    const workspace = createWorkspace();
    const document = createSearchDocument(resource);

    await resources.save(resourceToDomain(resource));
    await workspaces.save(workspaceToDomain(workspace));
    await search.save(document);

    expect((await resources.findById(Identifier.from(resource.id, "ResourceId")))?.toSnapshot().id.value).toBe(
      resource.id,
    );
    expect((await workspaces.findById(Identifier.from(workspace.id, "WorkspaceId")))?.toSnapshot().id.value).toBe(
      workspace.id,
    );
    expect(await search.get(document.id)).toEqual(document);

    await store.close();
  });

  it("rolls back all repository writes in a failed unit of work", async () => {
    const store = new KaryaMetadataStore({ databasePath: createDatabasePath() });
    await store.initialize();

    await expect(
      store.unitOfWork.transaction(async () => {
        await store.search.save(createSearchDocument(createResource()));
        throw new Error("fail command");
      }),
    ).rejects.toThrow("fail command");

    expect(await store.search.list()).toEqual([]);
    await store.close();
  });

  it("enforces foreign-key integrity for workspace resource references", () => {
    const database = Database(createDatabasePath());
    migrateMetadataStore(database);

    expect(() => {
      database
        .prepare("INSERT INTO workspace_resources (workspace_id, resource_id) VALUES (?, ?)")
        .run("missing-workspace", "missing-resource");
    }).toThrow();

    database.close();
  });

  it("serializes concurrent writes through SQLite", async () => {
    const store = new KaryaMetadataStore({ databasePath: createDatabasePath() });
    await store.initialize();

    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        store.search.save({
          id: `command:${index}`,
          type: "command",
          title: `Command ${index}`,
          keywords: ["command"],
          sourceId: `command:${index}`,
        }),
      ),
    );

    expect(await store.search.list()).toHaveLength(12);
    await store.close();
  });

  it("recovers cleanly after an interrupted transaction", async () => {
    const databasePath = createDatabasePath();
    const store = new KaryaMetadataStore({ databasePath });
    await store.initialize();

    await expect(
      store.unitOfWork.transaction(async () => {
        await store.search.save(createSearchDocument(createResource()));
        throw new Error("interrupt");
      }),
    ).rejects.toThrow("interrupt");
    await store.close();

    const recovered = new KaryaMetadataStore({ databasePath });
    await recovered.initialize();

    expect(await recovered.search.list()).toEqual([]);
    await recovered.search.save(createSearchDocument(createResource()));
    expect(await recovered.search.list()).toHaveLength(1);
    await recovered.close();
  });
});

function createDatabasePath(): string {
  return join(mkdtempSync(join(tmpdir(), "karya-metadata-store-")), "metadata.sqlite");
}

function open(databasePath: string): ReturnType<typeof Database> {
  return Database(databasePath);
}

function createResource(): Resource {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "resource-1",
    type: "document",
    metadata: {
      title: "Investor Deck",
      kind: "document",
      createdAt: now,
      updatedAt: now,
      createdBy: "user-1",
      updatedBy: "user-1",
      importance: "normal",
    },
    owner: "user-1",
    profileId: "profile-1",
    workspaceRefs: ["workspace-1"],
    primaryWorkspaceId: "workspace-1",
    defaultSpace: "none",
    tags: ["finance", "deck"],
    relationships: [
      {
        id: "relationship-1",
        targetResourceId: "resource-2",
        type: "references",
      },
    ],
    status: "active",
    lifecycleState: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function createWorkspace(): Workspace {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "workspace-1",
    name: "Investor Relations",
    metadata: {
      name: "Investor Relations",
      createdAt: now,
      updatedAt: now,
      createdBy: "user-1",
      updatedBy: "user-1",
    },
    profileId: "profile-1",
    owner: "user-1",
    resourceRefs: ["resource-1"],
    pinnedApplicationIds: [],
    lifecycleState: "open",
    pinned: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createSearchDocument(resource: Resource): SearchDocument {
  return {
    id: `resource:${resource.id}`,
    type: "resource",
    title: resource.metadata.title,
    subtitle: resource.type,
    keywords: resource.tags,
    sourceId: resource.id,
  };
}

function createActivity(): KaryaActivity {
  const occurredAt = "2026-01-01T12:00:00.000Z";
  return {
    id: "activity:resource-created",
    eventType: "ResourceCreated",
    category: "resource",
    verb: "created",
    title: "Created Investor Deck",
    object: { id: "resource-1", type: "resource", title: "Investor Deck" },
    relatedObjects: [],
    profileId: "profile-1",
    workspaceId: "workspace-1",
    actor: { id: "profile-1", type: "local-user" },
    source: "resources",
    groupKey: "resource:created:resource-1",
    groupCount: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  };
}

function createNotification(): KaryaNotification {
  const timestamp = "2026-01-01T12:00:00.000Z";
  return {
    id: "notification-1",
    activityId: "activity:resource-created",
    notificationType: "test-attention",
    icon: "Bell",
    title: "Attention needed",
    category: "system",
    source: "activity-timeline",
    profileId: "profile-1",
    workspaceId: "workspace-1",
    status: "unread",
    priority: "high",
    groupCount: 1,
    actions: [],
    references: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
