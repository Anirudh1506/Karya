import type { EntityId, SearchResult } from "@karya/types";

export type QuerySortDirection = "asc" | "desc";

export interface PageRequest {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface Page<TItem> {
  items: TItem[];
  total: number;
  nextCursor?: string;
}

export type ResourceSortBy = "name" | "createdAt" | "updatedAt" | "size" | "relevance";
export type WorkspaceSortBy = "name" | "createdAt" | "updatedAt";

export interface ResourceQuery extends PageRequest {
  workspaceId?: EntityId;
  tag?: string;
  mimeType?: string;
  createdAfter?: string;
  createdBefore?: string;
  text?: string;
  sortBy?: ResourceSortBy;
  sortDirection?: QuerySortDirection;
}

export interface WorkspaceQuery extends PageRequest {
  text?: string;
  lifecycleState?: string;
  sortBy?: WorkspaceSortBy;
  sortDirection?: QuerySortDirection;
}

export interface ResourceView {
  id: EntityId;
  title: string;
  mimeType: string;
  byteLength: number;
  workspaceIds: EntityId[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceView {
  id: EntityId;
  name: string;
  description?: string;
  resourceIds: EntityId[];
  lifecycleState: string;
  pinned: boolean;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceQueryRepository {
  getResource(id: EntityId): Promise<ResourceView | undefined>;
  listResources(query?: ResourceQuery): Promise<Page<ResourceView>>;
  recentResources(limit?: number): Promise<ResourceView[]>;
}

export interface WorkspaceQueryRepository {
  getWorkspace(id: EntityId): Promise<WorkspaceView | undefined>;
  listWorkspaces(query?: WorkspaceQuery): Promise<Page<WorkspaceView>>;
}

export interface SearchQueryRepository {
  search(text: string): Promise<SearchResult[]>;
}

export interface QueryService {
  getResource(id: EntityId): Promise<ResourceView>;
  listResources(query?: ResourceQuery): Promise<Page<ResourceView>>;
  search(text: string): Promise<SearchResult[]>;
  getWorkspace(id: EntityId): Promise<WorkspaceView>;
  listWorkspaces(query?: WorkspaceQuery): Promise<Page<WorkspaceView>>;
  recentResources(limit?: number): Promise<ResourceView[]>;
}
