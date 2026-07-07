import {
  Color,
  Identifier,
  Resource as ResourceAggregate,
  Tag,
  Timestamp,
  type Relationship,
  type RelationshipType,
  type ResourceMetadataPatch,
  type ResourceProps,
} from "@karya/domain";
import type { RelationshipType as DtoRelationshipType, Resource } from "@karya/types";

export function toDomain(resource: Resource): ResourceAggregate {
  const createdAt = Timestamp.from(resource.metadata.createdAt);
  const updatedAt = Timestamp.from(resource.metadata.updatedAt);

  return ResourceAggregate.rehydrate({
    id: Identifier.from(resource.id, "ResourceId"),
    type: resource.type,
    metadata: {
      title: resource.metadata.title,
      description: resource.metadata.description,
      kind: resource.metadata.kind,
      createdAt,
      updatedAt,
      createdBy: resource.metadata.createdBy ? Identifier.from(resource.metadata.createdBy, "UserId") : undefined,
      updatedBy: resource.metadata.updatedBy ? Identifier.from(resource.metadata.updatedBy, "UserId") : undefined,
      importance: resource.metadata.importance ?? "normal",
      color: resource.metadata.color ? Color.from(resource.metadata.color) : undefined,
      attributes: resource.metadata.attributes ?? {},
    },
    ownership: {
      owner: Identifier.from(resource.owner, "OwnerId"),
      profileId: Identifier.from(resource.profileId, "ProfileId"),
    },
    workspaceRefs: resource.workspaceRefs.map((id) => Identifier.from(id, "WorkspaceId")),
    primaryWorkspaceId: resource.primaryWorkspaceId ? Identifier.from(resource.primaryWorkspaceId, "WorkspaceId") : undefined,
    defaultSpace: resource.defaultSpace ?? (resource.workspaceRefs.length ? "none" : "profile"),
    tags: resource.tags.map(Tag.from),
    relationships: resource.relationships.map<Relationship>((relationship) => ({
      id: Identifier.from(relationship.id, "RelationshipId"),
      targetResourceId: Identifier.from(relationship.targetResourceId, "ResourceId"),
      type: relationship.type as RelationshipType,
      metadata: relationship.metadata ?? {},
    })),
    permissions: {
      ownerCanEdit: resource.permissions?.ownerCanEdit ?? true,
      sharedWith: (resource.permissions?.sharedWith ?? []).map((id) => Identifier.from(id, "UserId")),
    },
    versionInfo: {
      version: resource.versionInfo?.version ?? 1,
      previousVersionId: resource.versionInfo?.previousVersionId
        ? Identifier.from(resource.versionInfo.previousVersionId, "ResourceId")
        : undefined,
    },
    status: resource.status,
    lifecycle: resource.lifecycleState,
    createdAt: Timestamp.from(resource.createdAt),
    updatedAt: Timestamp.from(resource.updatedAt),
  });
}

export function toDto(resource: ResourceAggregate): Resource {
  const snapshot: ResourceProps = resource.toSnapshot();
  return {
    id: snapshot.id.value,
    type: snapshot.type,
    metadata: {
      title: snapshot.metadata.title,
      description: snapshot.metadata.description,
      kind: snapshot.metadata.kind,
      createdAt: snapshot.metadata.createdAt.value,
      updatedAt: snapshot.metadata.updatedAt.value,
      createdBy: snapshot.metadata.createdBy?.value,
      updatedBy: snapshot.metadata.updatedBy?.value,
      importance: snapshot.metadata.importance,
      color: snapshot.metadata.color?.value,
      attributes: snapshot.metadata.attributes,
    },
    owner: snapshot.ownership.owner.value,
    profileId: snapshot.ownership.profileId.value,
    workspaceRefs: snapshot.workspaceRefs.map((id) => id.value),
    primaryWorkspaceId: snapshot.primaryWorkspaceId?.value,
    defaultSpace: snapshot.defaultSpace,
    tags: snapshot.tags.map((tag) => tag.value),
    relationships: snapshot.relationships.map((relationship) => ({
      id: relationship.id.value,
      targetResourceId: relationship.targetResourceId.value,
      targetObjectId: relationship.metadata.targetObjectId ?? relationship.targetResourceId.value,
      targetObjectType: relationship.metadata.targetObjectType === "event" ? "event" : "resource",
      type: toDtoRelationshipType(relationship.type),
      metadata: relationship.metadata,
    })),
    permissions: {
      ownerCanEdit: snapshot.permissions.ownerCanEdit,
      sharedWith: snapshot.permissions.sharedWith.map((id) => id.value),
    },
    versionInfo: {
      version: snapshot.versionInfo.version,
      previousVersionId: snapshot.versionInfo.previousVersionId?.value,
    },
    status: snapshot.status,
    lifecycleState: snapshot.lifecycle,
    createdAt: snapshot.createdAt.value,
    updatedAt: snapshot.updatedAt.value,
  };
}

function toDtoRelationshipType(type: RelationshipType): DtoRelationshipType {
  if (type === "depends_on") return "dependsOn";
  if (type === "derived_from" || type === "generatedFrom") return "createdFrom";
  if (type === "related_to") return "relatedTo";
  if (type === "attachmentOf") return "attachment";
  return type;
}

export function toDomainMetadataPatch(
  metadata: Partial<Resource["metadata"]> | undefined,
  occurredAt: Timestamp,
): ResourceMetadataPatch {
  if (!metadata) {
    return {};
  }

  return {
    title: metadata.title,
    description: metadata.description,
    kind: metadata.kind,
    updatedAt: metadata.updatedAt ? Timestamp.from(metadata.updatedAt) : occurredAt,
    updatedBy: metadata.updatedBy ? Identifier.from(metadata.updatedBy, "UserId") : undefined,
    importance: metadata.importance,
    color: metadata.color ? Color.from(metadata.color) : undefined,
    attributes: metadata.attributes,
  };
}
