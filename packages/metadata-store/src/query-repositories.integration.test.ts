/// <reference path="./better-sqlite3.d.ts" />
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Resource, SearchDocument, Workspace } from "@karya/types";
import { toDomain as resourceToDomain } from "@karya/resource-service";
import { toDomain as workspaceToDomain } from "@karya/workspace-service";
import { SqliteResourceRepository, SqliteSearchDocumentRepository, SqliteWorkspaceRepository } from "./repositories";
import { SqliteResourceQueryRepository, SqliteSearchQueryRepository, SqliteWorkspaceQueryRepository } from "./query-repositories";
import { migrateMetadataStore } from "./schema";

describe("SQLite query repositories", () => {
  it("handles an empty database", async () => {
    const database = createDatabase();
    const resources = new SqliteResourceQueryRepository(database);

    expect(await resources.listResources()).toEqual({ items: [], total: 0, nextCursor: undefined });
    database.close();
  });

  it("lists resources as read models", async () => {
    const database = createDatabase();
    await seed(database);

    const page = await new SqliteResourceQueryRepository(database).listResources({ sortBy: "name", sortDirection: "asc" });

    expect(page.total).toBe(3);
    expect(page.items.map((resource) => resource.title)).toEqual(["Alpha Notes", "Beta Sheet", "Gamma Deck"]);
    expect(page.items[0]).toMatchObject({ mimeType: "text/markdown", byteLength: 120 });
    database.close();
  });

  it("filters resources by workspace and tag", async () => {
    const database = createDatabase();
    await seed(database);
    const repository = new SqliteResourceQueryRepository(database);

    expect((await repository.listResources({ workspaceId: "workspace-a" })).items.map((resource) => resource.id)).toEqual(["resource-c", "resource-a"]);
    expect((await repository.listResources({ tag: "finance", sortBy: "name", sortDirection: "asc" })).items.map((resource) => resource.id)).toEqual(["resource-b", "resource-c"]);
    database.close();
  });

  it("supports pagination", async () => {
    const database = createDatabase();
    await seed(database);
    const repository = new SqliteResourceQueryRepository(database);

    const first = await repository.listResources({ limit: 2, sortBy: "name", sortDirection: "asc" });
    const second = await repository.listResources({ cursor: first.nextCursor, limit: 2, sortBy: "name", sortDirection: "asc" });

    expect(first.items.map((resource) => resource.id)).toEqual(["resource-a", "resource-b"]);
    expect(first.total).toBe(3);
    expect(first.nextCursor).toBe("2");
    expect(second.items.map((resource) => resource.id)).toEqual(["resource-c"]);
    expect(second.nextCursor).toBeUndefined();
    database.close();
  });

  it("sorts by size and updated date", async () => {
    const database = createDatabase();
    await seed(database);
    const repository = new SqliteResourceQueryRepository(database);

    expect((await repository.listResources({ sortBy: "size", sortDirection: "asc" })).items.map((resource) => resource.id)).toEqual(["resource-a", "resource-b", "resource-c"]);
    expect((await repository.listResources({ sortBy: "updatedAt", sortDirection: "desc" })).items.map((resource) => resource.id)).toEqual(["resource-c", "resource-b", "resource-a"]);
    database.close();
  });

  it("queries workspaces as read models", async () => {
    const database = createDatabase();
    await seed(database);

    const page = await new SqliteWorkspaceQueryRepository(database).listWorkspaces({ sortBy: "name", sortDirection: "asc" });

    expect(page.items.map((workspace) => workspace.name)).toEqual(["Research", "Startup"]);
    expect(page.items[1].resourceIds).toEqual(["resource-a", "resource-c"]);
    database.close();
  });

  it("searches persisted search documents", async () => {
    const database = createDatabase();
    await seed(database);

    const results = await new SqliteSearchQueryRepository(database).search("investor");

    expect(results[0].document.sourceId).toBe("resource-c");
    expect(results[0].score).toBeGreaterThan(0);
    database.close();
  });

  it("handles large datasets with limit and offset", async () => {
    const database = createDatabase();
    await seedLargeDataset(database, 125);

    const page = await new SqliteResourceQueryRepository(database).listResources({
      limit: 25,
      offset: 100,
      sortBy: "name",
      sortDirection: "asc",
    });

    expect(page.total).toBe(125);
    expect(page.items).toHaveLength(25);
    expect(page.nextCursor).toBeUndefined();
    database.close();
  });
});

function createDatabase(): ReturnType<typeof Database> {
  const database = Database(join(mkdtempSync(join(tmpdir(), "karya-query-store-")), "metadata.sqlite"));
  migrateMetadataStore(database);
  return database;
}

async function seed(database: ReturnType<typeof Database>): Promise<void> {
  const resources = new SqliteResourceRepository(database);
  const workspaces = new SqliteWorkspaceRepository(database);
  const search = new SqliteSearchDocumentRepository(database);

  for (const resource of [
    createResource("resource-a", "Alpha Notes", "text/markdown", 120, ["workspace-a"], ["notes"], "2026-01-01T00:00:00.000Z"),
    createResource("resource-b", "Beta Sheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 500, ["workspace-b"], ["finance"], "2026-01-02T00:00:00.000Z"),
    createResource("resource-c", "Gamma Deck", "application/pdf", 900, ["workspace-a"], ["finance", "deck", "investor"], "2026-01-03T00:00:00.000Z"),
  ]) {
    await resources.save(resourceToDomain(resource));
    await search.save(toSearchDocument(resource));
  }

  await workspaces.save(workspaceToDomain(createWorkspace("workspace-a", "Startup", ["resource-a", "resource-c"])));
  await workspaces.save(workspaceToDomain(createWorkspace("workspace-b", "Research", ["resource-b"])));
}

async function seedLargeDataset(database: ReturnType<typeof Database>, count: number): Promise<void> {
  const resources = new SqliteResourceRepository(database);
  for (let index = 0; index < count; index += 1) {
    const padded = String(index).padStart(3, "0");
    await resources.save(resourceToDomain(createResource(`resource-${padded}`, `Resource ${padded}`, "text/plain", index, [], ["bulk"], "2026-01-01T00:00:00.000Z")));
  }
}

function createResource(
  id: string,
  title: string,
  mimeType: string,
  byteLength: number,
  workspaceRefs: string[],
  tags: string[],
  updatedAt: string,
): Resource {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return {
    id,
    type: mimeType,
    metadata: {
      title,
      kind: "content",
      createdAt,
      updatedAt,
      attributes: {
        contentMimeType: mimeType,
        contentByteLength: byteLength,
      },
    },
    owner: "user-1",
    profileId: "profile-1",
    workspaceRefs,
    primaryWorkspaceId: workspaceRefs[0],
    defaultSpace: workspaceRefs.length ? "none" : "profile",
    tags,
    relationships: [],
    status: "active",
    lifecycleState: "active",
    createdAt,
    updatedAt,
  };
}

function createWorkspace(id: string, name: string, resourceRefs: string[]): Workspace {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id,
    name,
    metadata: {
      name,
      createdAt: now,
      updatedAt: now,
    },
    profileId: "profile-1",
    owner: "user-1",
    resourceRefs,
    pinnedApplicationIds: [],
    lifecycleState: "open",
    pinned: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

function toSearchDocument(resource: Resource): SearchDocument {
  return {
    id: `resource:${resource.id}`,
    type: "resource",
    title: resource.metadata.title,
    subtitle: resource.type,
    keywords: resource.tags,
    sourceId: resource.id,
  };
}
