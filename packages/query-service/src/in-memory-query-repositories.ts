import type { EntityId, Resource, SearchDocument, SearchResult, Workspace } from "@karya/types";
import type {
  Page,
  ResourceQuery,
  ResourceQueryRepository,
  ResourceView,
  SearchQueryRepository,
  WorkspaceQuery,
  WorkspaceQueryRepository,
  WorkspaceView,
} from "./contracts";

export class InMemoryResourceQueryRepository implements ResourceQueryRepository {
  constructor(private readonly resources: Resource[] = []) {}

  async getResource(id: EntityId): Promise<ResourceView | undefined> {
    return this.resources.find((resource) => resource.id === id && resource.lifecycleState !== "deleted") ? toResourceView(this.resources.find((resource) => resource.id === id)!) : undefined;
  }

  async listResources(query: ResourceQuery = {}): Promise<Page<ResourceView>> {
    return paginate(sortResources(this.resources.filter((resource) => matchesResource(resource, query)).map(toResourceView), query), query);
  }

  async recentResources(limit = 10): Promise<ResourceView[]> {
    return sortResources(this.resources.filter((resource) => resource.lifecycleState !== "deleted").map(toResourceView), {
      sortBy: "updatedAt",
      sortDirection: "desc",
      limit,
    }).slice(0, limit);
  }
}

export class InMemoryWorkspaceQueryRepository implements WorkspaceQueryRepository {
  constructor(private readonly workspaces: Workspace[] = []) {}

  async getWorkspace(id: EntityId): Promise<WorkspaceView | undefined> {
    const workspace = this.workspaces.find((candidate) => candidate.id === id && candidate.lifecycleState !== "deleted");
    return workspace ? toWorkspaceView(workspace) : undefined;
  }

  async listWorkspaces(query: WorkspaceQuery = {}): Promise<Page<WorkspaceView>> {
    return paginate(
      sortWorkspaces(this.workspaces.filter((workspace) => matchesWorkspace(workspace, query)).map(toWorkspaceView), query),
      query,
    );
  }
}

export class InMemorySearchQueryRepository implements SearchQueryRepository {
  constructor(private readonly documents: SearchDocument[] = []) {}

  async search(text: string): Promise<SearchResult[]> {
    const term = text.trim().toLocaleLowerCase();
    if (!term) return [];
    return this.documents
      .map((document) => ({ document, score: score(document, term) }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score);
  }
}

function matchesResource(resource: Resource, query: ResourceQuery): boolean {
  if (resource.lifecycleState === "deleted") return false;
  if (query.workspaceId && !resource.workspaceRefs.includes(query.workspaceId)) return false;
  if (query.tag && !resource.tags.includes(query.tag)) return false;
  if (query.mimeType && resource.metadata.attributes?.contentMimeType !== query.mimeType && resource.type !== query.mimeType) return false;
  if (query.createdAfter && resource.createdAt < query.createdAfter) return false;
  if (query.createdBefore && resource.createdAt > query.createdBefore) return false;
  if (query.text) {
    const text = `${resource.metadata.title} ${resource.metadata.description ?? ""} ${resource.tags.join(" ")}`.toLocaleLowerCase();
    if (!text.includes(query.text.toLocaleLowerCase())) return false;
  }
  return true;
}

function matchesWorkspace(workspace: Workspace, query: WorkspaceQuery): boolean {
  if (workspace.lifecycleState === "deleted") return false;
  if (query.lifecycleState && workspace.lifecycleState !== query.lifecycleState) return false;
  if (query.text) {
    const text = `${workspace.name} ${workspace.metadata.description ?? ""}`.toLocaleLowerCase();
    if (!text.includes(query.text.toLocaleLowerCase())) return false;
  }
  return true;
}

function toResourceView(resource: Resource): ResourceView {
  return {
    id: resource.id,
    title: resource.metadata.title,
    mimeType: String(resource.metadata.attributes?.contentMimeType ?? resource.type),
    byteLength: Number(resource.metadata.attributes?.contentByteLength ?? 0),
    workspaceIds: resource.workspaceRefs,
    tags: resource.tags,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

function toWorkspaceView(workspace: Workspace): WorkspaceView {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.metadata.description,
    resourceIds: workspace.resourceRefs,
    lifecycleState: workspace.lifecycleState,
    pinned: workspace.pinned,
    favorite: workspace.favorite,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
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

function score(document: SearchDocument, term: string): number {
  const title = document.title.toLocaleLowerCase();
  const subtitle = document.subtitle?.toLocaleLowerCase() ?? "";
  const keywords = document.keywords.join(" ").toLocaleLowerCase();
  let result = 0;
  if (title === term) result += 100;
  if (title.includes(term)) result += 50;
  if (subtitle.includes(term)) result += 20;
  if (keywords.includes(term)) result += 10;
  return result;
}
