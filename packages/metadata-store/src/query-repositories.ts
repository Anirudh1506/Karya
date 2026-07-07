/// <reference path="./better-sqlite3.d.ts" />
import type {
  Page,
  ResourceQuery,
  ResourceQueryRepository,
  ResourceView,
  SearchQueryRepository,
  WorkspaceQuery,
  WorkspaceQueryRepository,
  WorkspaceView,
} from "@karya/query-service";
import type { EntityId, Resource, SearchDocument, SearchResult, Workspace } from "@karya/types";
import type { Database } from "better-sqlite3";
import { parseJson } from "./json";

interface PayloadRow {
  payload: string;
}

export class SqliteResourceQueryRepository implements ResourceQueryRepository {
  constructor(private readonly database: Database) {}

  async getResource(id: EntityId): Promise<ResourceView | undefined> {
    const row = this.database.prepare("SELECT payload FROM resources WHERE id = ? AND lifecycle_state != 'deleted'").get(id) as PayloadRow | undefined;
    return row ? toResourceView(parseJson<Resource>(row.payload)) : undefined;
  }

  async listResources(query: ResourceQuery = {}): Promise<Page<ResourceView>> {
    const resources = this.selectResources().filter((resource) => matchesResource(resource, query));
    return paginate(sortResources(resources.map(toResourceView), query), query);
  }

  async recentResources(limit = 10): Promise<ResourceView[]> {
    return this.selectResources()
      .filter((resource) => resource.lifecycleState !== "deleted")
      .map(toResourceView)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  private selectResources(): Resource[] {
    return (this.database.prepare("SELECT payload FROM resources WHERE lifecycle_state != 'deleted'").all() as PayloadRow[])
      .map((row) => parseJson<Resource>(row.payload));
  }
}

export class SqliteWorkspaceQueryRepository implements WorkspaceQueryRepository {
  constructor(private readonly database: Database) {}

  async getWorkspace(id: EntityId): Promise<WorkspaceView | undefined> {
    const row = this.database.prepare("SELECT payload FROM workspaces WHERE id = ? AND lifecycle_state != 'deleted'").get(id) as PayloadRow | undefined;
    return row ? toWorkspaceView(parseJson<Workspace>(row.payload)) : undefined;
  }

  async listWorkspaces(query: WorkspaceQuery = {}): Promise<Page<WorkspaceView>> {
    const workspaces = (this.database.prepare("SELECT payload FROM workspaces WHERE lifecycle_state != 'deleted'").all() as PayloadRow[])
      .map((row) => parseJson<Workspace>(row.payload))
      .filter((workspace) => matchesWorkspace(workspace, query))
      .map(toWorkspaceView);

    return paginate(sortWorkspaces(workspaces, query), query);
  }
}

export class SqliteSearchQueryRepository implements SearchQueryRepository {
  constructor(private readonly database: Database) {}

  async search(text: string): Promise<SearchResult[]> {
    const term = text.trim().toLocaleLowerCase();
    if (!term) return [];

    return (this.database.prepare("SELECT payload FROM search_documents").all() as PayloadRow[])
      .map((row) => parseJson<SearchDocument>(row.payload))
      .map((document) => ({ document, score: scoreDocument(document, term) }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score);
  }
}

function matchesResource(resource: Resource, query: ResourceQuery): boolean {
  if (query.workspaceId && !resource.workspaceRefs.includes(query.workspaceId)) return false;
  if (query.tag && !resource.tags.includes(query.tag)) return false;
  if (query.mimeType && getMimeType(resource) !== query.mimeType) return false;
  if (query.createdAfter && resource.createdAt < query.createdAfter) return false;
  if (query.createdBefore && resource.createdAt > query.createdBefore) return false;
  if (query.text) {
    const haystack = `${resource.metadata.title} ${resource.metadata.description ?? ""} ${resource.type} ${resource.tags.join(" ")}`.toLocaleLowerCase();
    if (!haystack.includes(query.text.toLocaleLowerCase())) return false;
  }
  return true;
}

function matchesWorkspace(workspace: Workspace, query: WorkspaceQuery): boolean {
  if (query.lifecycleState && workspace.lifecycleState !== query.lifecycleState) return false;
  if (query.text) {
    const haystack = `${workspace.name} ${workspace.metadata.description ?? ""}`.toLocaleLowerCase();
    if (!haystack.includes(query.text.toLocaleLowerCase())) return false;
  }
  return true;
}

function toResourceView(resource: Resource): ResourceView {
  return {
    id: resource.id,
    title: resource.metadata.title,
    mimeType: getMimeType(resource),
    byteLength: Number(resource.metadata.attributes?.contentByteLength ?? 0),
    workspaceIds: [...resource.workspaceRefs],
    tags: [...resource.tags],
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

function toWorkspaceView(workspace: Workspace): WorkspaceView {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.metadata.description,
    resourceIds: [...workspace.resourceRefs],
    lifecycleState: workspace.lifecycleState,
    pinned: workspace.pinned,
    favorite: workspace.favorite,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function getMimeType(resource: Resource): string {
  return String(resource.metadata.attributes?.contentMimeType ?? resource.type);
}

function paginate<TItem>(items: TItem[], query: { limit?: number; offset?: number; cursor?: string }): Page<TItem> {
  const offset = query.cursor ? Number(query.cursor) : query.offset ?? 0;
  const limit = query.limit ?? 50;
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;
  return {
    items: pageItems,
    total: items.length,
    nextCursor: nextOffset < items.length ? String(nextOffset) : undefined,
  };
}

function sortResources(resources: ResourceView[], query: ResourceQuery): ResourceView[] {
  const direction = query.sortDirection === "asc" ? 1 : -1;
  const sortBy = query.sortBy ?? "updatedAt";
  return [...resources].sort((left, right) => {
    if (sortBy === "name") return left.title.localeCompare(right.title) * direction;
    if (sortBy === "createdAt") return left.createdAt.localeCompare(right.createdAt) * direction;
    if (sortBy === "size") return (left.byteLength - right.byteLength) * direction;
    return left.updatedAt.localeCompare(right.updatedAt) * direction;
  });
}

function sortWorkspaces(workspaces: WorkspaceView[], query: WorkspaceQuery): WorkspaceView[] {
  const direction = query.sortDirection === "asc" ? 1 : -1;
  const sortBy = query.sortBy ?? "updatedAt";
  return [...workspaces].sort((left, right) => {
    if (sortBy === "name") return left.name.localeCompare(right.name) * direction;
    if (sortBy === "createdAt") return left.createdAt.localeCompare(right.createdAt) * direction;
    return left.updatedAt.localeCompare(right.updatedAt) * direction;
  });
}

function scoreDocument(document: SearchDocument, term: string): number {
  const title = document.title.toLocaleLowerCase();
  const subtitle = document.subtitle?.toLocaleLowerCase() ?? "";
  const keywords = document.keywords.join(" ").toLocaleLowerCase();
  let score = 0;
  if (title === term) score += 100;
  if (title.includes(term)) score += 50;
  if (subtitle.includes(term)) score += 20;
  if (keywords.includes(term)) score += 10;
  return score;
}
