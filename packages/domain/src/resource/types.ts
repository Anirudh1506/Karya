import type { Color, DomainEvent, Identifier, Importance, Tag, Timestamp } from "../common";
import type { Resource } from "./aggregate";

export type ResourceId = Identifier;
export type ProfileId = Identifier;
export type WorkspaceId = Identifier;
export type OwnerId = Identifier;
export type UserId = Identifier;
export type ResourceStatus = "draft" | "active" | "archived" | "deleted";
export type ResourceLifecycle = ResourceStatus;
export type ResourceType = string;
export type DefaultSpacePlacement = "none" | "user" | "profile" | "user-and-profile";
export type RelationshipType =
  | "references"
  | "dependsOn"
  | "depends_on"
  | "generatedFrom"
  | "derived_from"
  | "relatedTo"
  | "related_to"
  | "attachmentOf"
  | "createdFrom"
  | "duplicateOf"
  | "attachment"
  | "childOf"
  | "parentOf"
  | "inspiredBy"
  | "supports"
  | "blocks"
  | "custom";

export interface ResourceMetadata {
  title: string;
  description?: string;
  kind: ResourceType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: UserId;
  updatedBy?: UserId;
  importance: Importance;
  color?: Color;
  attributes: Record<string, string | number | boolean | null>;
}

export interface ResourceReference {
  id: ResourceId;
  title: string;
  type: ResourceType;
}

export interface Relationship {
  id: Identifier;
  targetResourceId: ResourceId;
  type: RelationshipType;
  metadata: Record<string, string>;
}

export interface ResourcePermissions {
  ownerCanEdit: boolean;
  sharedWith: UserId[];
}

export interface VersionInfo {
  version: number;
  previousVersionId?: ResourceId;
}

export interface ResourceOwnership {
  owner: OwnerId;
  profileId: ProfileId;
}

export interface ResourceProps {
  id: ResourceId;
  type: ResourceType;
  metadata: ResourceMetadata;
  ownership: ResourceOwnership;
  workspaceRefs: WorkspaceId[];
  primaryWorkspaceId?: WorkspaceId;
  defaultSpace: DefaultSpacePlacement;
  tags: Tag[];
  relationships: Relationship[];
  permissions: ResourcePermissions;
  versionInfo: VersionInfo;
  status: ResourceStatus;
  lifecycle: ResourceLifecycle;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ResourceDomainEvent =
  | DomainEvent<"ResourceCreated", { resourceId: ResourceId }>
  | DomainEvent<"ResourceRenamed", { resourceId: ResourceId; title: string }>
  | DomainEvent<"ResourceArchived", { resourceId: ResourceId }>
  | DomainEvent<"ResourceRestored", { resourceId: ResourceId }>
  | DomainEvent<"ResourceDeleted", { resourceId: ResourceId }>
  | DomainEvent<"WorkspaceReferenceAdded", { resourceId: ResourceId; workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspaceReferenceRemoved", { resourceId: ResourceId; workspaceId: WorkspaceId }>
  | DomainEvent<"PrimaryWorkspaceMoved", { resourceId: ResourceId; workspaceId?: WorkspaceId }>
  | DomainEvent<"MetadataUpdated", { resourceId: ResourceId; keys: string[] }>
  | DomainEvent<"RelationshipAdded", { resourceId: ResourceId; targetResourceId: ResourceId; relationshipType: RelationshipType }>
  | DomainEvent<"RelationshipRemoved", { resourceId: ResourceId; relationshipId: Identifier }>
  | DomainEvent<"TagsUpdated", { resourceId: ResourceId; tags: string[] }>;

export interface ResourceSnapshot extends ResourceProps {}

export interface ResourceRepository {
  save(resource: Resource): Promise<void>;
  findById(id: ResourceId): Promise<Resource | undefined>;
  list(): Promise<Resource[]>;
}

export interface CreateResourceRequest {
  id: string;
  type: ResourceType;
  owner: string;
  profileId: string;
  workspaceRefs?: string[];
  primaryWorkspaceId?: string;
  defaultSpace?: DefaultSpacePlacement;
  tags?: string[];
  title?: string;
  description?: string;
  kind?: string;
  importance?: Importance;
  color?: string;
  createdBy?: string;
  occurredAt: string;
  lifecycle?: ResourceLifecycle;
  attributes?: Record<string, string | number | boolean | null>;
}

export type CreateResourceCommand = {
  type: "CreateResource";
  payload: CreateResourceRequest;
};
export type RenameResourceCommand = {
  type: "RenameResource";
  payload: { id: string; title: string; occurredAt: string; actorId?: string };
};
export type ArchiveResourceCommand = {
  type: "ArchiveResource";
  payload: { id: string; occurredAt: string };
};
export type RestoreResourceCommand = {
  type: "RestoreResource";
  payload: { id: string; occurredAt: string };
};
export type DeleteResourceCommand = {
  type: "DeleteResource";
  payload: { id: string; occurredAt: string };
};
export type AddWorkspaceReferenceCommand = {
  type: "AddWorkspaceReference";
  payload: { id: string; workspaceId: string; makePrimary?: boolean; occurredAt: string };
};
export type RemoveWorkspaceReferenceCommand = {
  type: "RemoveWorkspaceReference";
  payload: { id: string; workspaceId: string; occurredAt: string };
};
export type UpdateMetadataCommand = {
  type: "UpdateMetadata";
  payload: { id: string; metadata: ResourceMetadataPatch; occurredAt: string; actorId?: string };
};

export type ResourceCommand =
  | CreateResourceCommand
  | RenameResourceCommand
  | ArchiveResourceCommand
  | RestoreResourceCommand
  | DeleteResourceCommand
  | AddWorkspaceReferenceCommand
  | RemoveWorkspaceReferenceCommand
  | UpdateMetadataCommand;

export interface ResourceMetadataPatch {
  title?: string;
  description?: string;
  kind?: ResourceType;
  updatedAt?: Timestamp;
  updatedBy?: UserId;
  importance?: Importance;
  color?: Color;
  attributes?: Record<string, string | number | boolean | null>;
}
