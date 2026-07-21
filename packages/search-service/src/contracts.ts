import type { Profile, Resource, SearchDocument, SearchResult, Workspace } from "@karya/types";

export interface SearchContext {
  activeProfileId?: string;
  activeWorkspaceId?: string;
  recentResourceIds?: string[];
  types?: Array<"profile" | "workspace" | "resource">;
}

export interface SearchService {
  loadPersistedIndex(): Promise<void>;
  subscribeToEvents(): () => void;
  indexResource(resource: Resource): Promise<void>;
  removeResource(resourceId: string): Promise<void>;
  indexWorkspace(workspace: Workspace): Promise<void>;
  removeWorkspace(workspaceId: string): Promise<void>;
  indexProfile(profile: Profile): Promise<void>;
  removeProfile(profileId: string): Promise<void>;
  rebuild(documents: SearchDocument[]): Promise<void>;
  index(documents: SearchDocument[]): Promise<void>;
  remove(documentId: string): Promise<void>;
  listDocuments(): Promise<SearchDocument[]>;
  query(term: string, context?: SearchContext): Promise<SearchResult[]>;
}
