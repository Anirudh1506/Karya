import type { WorkspaceLayout } from "@karya/domain";
import type { EntityId, Workspace, WorkspaceLaunchSet, WorkspaceReference } from "@karya/types";

export interface CreateWorkspaceRequest {
  name: string;
  profileId: EntityId;
  owner?: EntityId;
  description?: string;
  templateId?: EntityId;
}

export interface WorkspaceService {
  create(request: CreateWorkspaceRequest): Promise<Workspace>;
  open(id: EntityId): Promise<Workspace>;
  close(id: EntityId): Promise<Workspace>;
  rename(id: EntityId, name: string): Promise<Workspace>;
  archive(id: EntityId): Promise<Workspace>;
  restore(id: EntityId): Promise<Workspace>;
  delete(id: EntityId): Promise<Workspace>;
  pin(id: EntityId): Promise<Workspace>;
  unpin(id: EntityId): Promise<Workspace>;
  favorite(id: EntityId): Promise<Workspace>;
  unfavorite(id: EntityId): Promise<Workspace>;
  listWorkspaces(): Promise<Workspace[]>;
  listWorkspaceReferences(): Promise<WorkspaceReference[]>;
  getActiveWorkspace(): Promise<Workspace | undefined>;
  createWorkspace(name: string, profileId: EntityId): Promise<Workspace>;
  activateWorkspace(id: EntityId): Promise<Workspace>;
  restoreWorkspace(id: EntityId): Promise<Workspace>;
  addResourceReference(workspaceId: EntityId, resourceId: EntityId): Promise<Workspace>;
  removeResourceReference(workspaceId: EntityId, resourceId: EntityId): Promise<Workspace>;
  setPreferredApplication(workspaceId: EntityId, applicationId: EntityId, preferred?: boolean): Promise<Workspace>;
  updateLaunchSet(workspaceId: EntityId, launchSet: WorkspaceLaunchSet | undefined): Promise<Workspace>;
  updateLayout(workspaceId: EntityId, layout: Partial<WorkspaceLayout>): Promise<Workspace>;
}
