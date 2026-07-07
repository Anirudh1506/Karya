/// <reference path="./better-sqlite3.d.ts" />
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { Identifier } from "@karya/domain";
import type { Resource, SearchDocument, Workspace } from "@karya/types";
import { toDomain as resourceToDomain } from "@karya/resource-service";
import { toDomain as workspaceToDomain } from "@karya/workspace-service";
import { KaryaMetadataStore } from "./metadata-store";
import { SqliteResourceRepository, SqliteSearchDocumentRepository, SqliteWorkspaceRepository } from "./repositories";
import { migrateMetadataStore } from "./schema";

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

    expect(row.version).toBe(1);
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

    expect((await resources.findById(Identifier.from(resource.id, "ResourceId")))?.toSnapshot().id.value).toBe(resource.id);
    expect((await workspaces.findById(Identifier.from(workspace.id, "WorkspaceId")))?.toSnapshot().id.value).toBe(workspace.id);
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
