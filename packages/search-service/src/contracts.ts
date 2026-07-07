import type { Resource, SearchDocument, SearchResult, Workspace } from "@karya/types";

export interface SearchService {
  loadPersistedIndex(): Promise<void>;
  subscribeToEvents(): () => void;
  indexResource(resource: Resource): Promise<void>;
  removeResource(resourceId: string): Promise<void>;
  indexWorkspace(workspace: Workspace): Promise<void>;
  removeWorkspace(workspaceId: string): Promise<void>;
  index(documents: SearchDocument[]): Promise<void>;
  remove(documentId: string): Promise<void>;
  listDocuments(): Promise<SearchDocument[]>;
  query(term: string): Promise<SearchResult[]>;
}
