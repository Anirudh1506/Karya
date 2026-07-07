import type { DefaultSpacePlacement, ResourceCommand } from "@karya/domain";
import type { EntityId, LifecycleState, Resource } from "@karya/types";

export interface CreateResourceRequest {
  displayTitle?: string;
  description?: string;
  type: string;
  owner: EntityId;
  profileId: EntityId;
  workspaceRefs?: EntityId[];
  primaryWorkspaceId?: EntityId;
  defaultSpace?: DefaultSpacePlacement;
  metadata?: Partial<Resource["metadata"]>;
  tags?: string[];
}

export interface UpdateResourceRequest {
  id: EntityId;
  owner?: EntityId;
  profileId?: EntityId;
  metadata?: Partial<Resource["metadata"]>;
  tags?: string[];
  workspaceRefs?: EntityId[];
  primaryWorkspaceId?: EntityId;
  defaultSpace?: DefaultSpacePlacement;
}

export interface ResourceService {
  create(request: CreateResourceRequest): Promise<Resource>;
  update(request: UpdateResourceRequest): Promise<Resource>;
  rename(id: EntityId, title: string): Promise<Resource>;
  archive(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<Resource>;
  delete(id: EntityId): Promise<void>;
  listResources(): Promise<Resource[]>;
  getResource(id: EntityId): Promise<Resource | undefined>;
  createResource(input: CreateResourceRequest): Promise<Resource>;
  updateLifecycle(id: EntityId, lifecycleState: LifecycleState): Promise<Resource>;
  addWorkspaceReference(id: EntityId, workspaceId: EntityId, makePrimary?: boolean): Promise<Resource>;
  removeWorkspaceReference(id: EntityId, workspaceId: EntityId): Promise<Resource>;
  addRelationship(sourceId: EntityId, targetResourceId: EntityId, type: Resource["relationships"][number]["type"], metadata?: Record<string, string>): Promise<Resource>;
  removeRelationship(sourceId: EntityId, relationshipId: EntityId): Promise<Resource>;
  updateMetadata(id: EntityId, metadata: Partial<Resource["metadata"]>): Promise<Resource>;
  execute(command: ResourceCommand): Promise<Resource>;
}
