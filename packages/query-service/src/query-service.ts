import type {
  Page,
  QueryService,
  ResourceQuery,
  ResourceQueryRepository,
  ResourceView,
  SearchQueryRepository,
  WorkspaceQuery,
  WorkspaceQueryRepository,
  WorkspaceView,
} from "./contracts";
import type { EntityId, SearchResult } from "@karya/types";

export interface DefaultQueryServiceOptions {
  resources: ResourceQueryRepository;
  search: SearchQueryRepository;
  workspaces: WorkspaceQueryRepository;
}

export class DefaultQueryService implements QueryService {
  constructor(private readonly options: DefaultQueryServiceOptions) {}

  async getResource(id: EntityId): Promise<ResourceView> {
    const resource = await this.options.resources.getResource(id);
    if (!resource) {
      throw new Error(`Resource not found: ${id}`);
    }
    return resource;
  }

  listResources(query?: ResourceQuery): Promise<Page<ResourceView>> {
    return this.options.resources.listResources(query);
  }

  search(text: string): Promise<SearchResult[]> {
    return this.options.search.search(text);
  }

  async getWorkspace(id: EntityId): Promise<WorkspaceView> {
    const workspace = await this.options.workspaces.getWorkspace(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }
    return workspace;
  }

  listWorkspaces(query?: WorkspaceQuery): Promise<Page<WorkspaceView>> {
    return this.options.workspaces.listWorkspaces(query);
  }

  recentResources(limit?: number): Promise<ResourceView[]> {
    return this.options.resources.recentResources(limit);
  }
}
