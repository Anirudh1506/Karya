import type { EntityId, ISODateString, LifecycleState } from "./common";

export type RelationshipObjectType = "resource" | "event";

export type RelationshipType =
  | "relatedTo"
  | "dependsOn"
  | "references"
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
  kind: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy?: EntityId;
  updatedBy?: EntityId;
  importance?: "low" | "normal" | "high" | "critical";
  color?: string;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface ResourceRelationship {
  id: EntityId;
  targetResourceId: EntityId;
  targetObjectId?: EntityId;
  targetObjectType?: RelationshipObjectType;
  type: RelationshipType;
  metadata?: Record<string, string>;
}

export interface ResourcePermissions {
  ownerCanEdit: boolean;
  sharedWith: EntityId[];
}

export interface ResourceVersionInfo {
  version: number;
  previousVersionId?: EntityId;
}

export interface Resource {
  id: EntityId;
  type: string;
  metadata: ResourceMetadata;
  owner: EntityId;
  profileId: EntityId;
  workspaceRefs: EntityId[];
  primaryWorkspaceId?: EntityId;
  defaultSpace:
    | "none"
    | "user"
    | "profile"
    | "user-and-profile";
  tags: string[];
  relationships: ResourceRelationship[];
  permissions?: ResourcePermissions;
  versionInfo?: ResourceVersionInfo;
  status: LifecycleState;
  lifecycleState: LifecycleState;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
