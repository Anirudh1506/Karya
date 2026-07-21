import { Identifier, Label } from "../common";
import type { Relationship, RelationshipType, ResourceMetadata, ResourceMetadataPatch, ResourceProps } from "./types";

export function normalizeProps(props: ResourceProps): ResourceProps {
  return {
    ...props,
    metadata: normalizeMetadata(props.metadata),
    workspaceRefs: uniqueByValue(props.workspaceRefs),
    tags: uniqueByValue(props.tags),
    relationships: props.relationships.map(normalizeRelationship),
    permissions: {
      ownerCanEdit: props.permissions.ownerCanEdit,
      sharedWith: uniqueByValue(props.permissions.sharedWith),
    },
    versionInfo: { ...props.versionInfo },
  };
}

export function normalizeMetadata(metadata: ResourceMetadata): ResourceMetadata {
  return {
    ...metadata,
    title: Label.from(metadata.title).value,
    kind: metadata.kind.trim(),
    importance: metadata.importance ?? "normal",
    attributes: { ...(metadata.attributes ?? {}) },
  };
}

export function normalizeMetadataPatch(metadata: ResourceMetadataPatch): ResourceMetadataPatch {
  const normalized: ResourceMetadataPatch = {};
  if (metadata.title !== undefined) normalized.title = Label.from(metadata.title).value;
  if (metadata.description !== undefined) normalized.description = metadata.description;
  if (metadata.kind !== undefined) normalized.kind = metadata.kind.trim();
  if (metadata.updatedAt !== undefined) normalized.updatedAt = metadata.updatedAt;
  if (metadata.updatedBy !== undefined) normalized.updatedBy = metadata.updatedBy;
  if (metadata.importance !== undefined) normalized.importance = metadata.importance;
  if (metadata.color !== undefined) normalized.color = metadata.color;
  if (metadata.attributes !== undefined) normalized.attributes = { ...metadata.attributes };
  return normalized;
}

export function normalizeRelationship(relationship: Relationship): Relationship {
  return {
    ...relationship,
    type: normalizeRelationshipType(relationship.type),
    metadata: { ...(relationship.metadata ?? {}) },
  };
}

export function normalizeRelationshipType(type: RelationshipType): RelationshipType {
  if (type === "depends_on") return "dependsOn";
  if (type === "derived_from") return "generatedFrom";
  if (type === "related_to") return "relatedTo";
  return type;
}

export function uniqueIdentifiers(ids: string[], label: string): Identifier[] {
  return uniqueByValue(ids.map((id) => Identifier.from(id, label)));
}

export function uniqueByValue<TItem extends { value: string }>(items: TItem[]): TItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}
