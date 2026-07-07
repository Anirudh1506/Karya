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
  return {
    ...metadata,
    title: metadata.title === undefined ? undefined : Label.from(metadata.title).value,
    kind: metadata.kind?.trim(),
    attributes: metadata.attributes ? { ...metadata.attributes } : undefined,
  };
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
