import type { EntityId, Resource } from "@karya/types";
import type { ResourceState } from "../types";

export function deriveResources(
  resources: Resource[],
  selectedId: EntityId | undefined,
  recentIds: EntityId[],
): ResourceState {
  const contentResources = resources.filter((resource) => !isCalendarEventResource(resource));
  const visibleResources = contentResources.filter((resource) => resource.lifecycleState !== "deleted");
  const activeResources = contentResources.filter((resource) => resource.lifecycleState === "active");
  const archivedResources = contentResources.filter((resource) => resource.lifecycleState === "archived");
  const deletedResources = contentResources.filter((resource) => resource.lifecycleState === "deleted");
  const active = selectedId ? visibleResources.find((resource) => resource.id === selectedId) : undefined;
  const recent = recentIds
    .map((id) => visibleResources.find((resource) => resource.id === id))
    .filter((resource): resource is Resource => Boolean(resource));
  const recentModifiedByWorkspace = activeResources.reduce<Record<EntityId, Resource[]>>((collections, resource) => {
    if (readStringAttribute(resource, "folderParentId")) return collections;
    resource.workspaceRefs.forEach((workspaceId) => {
      collections[workspaceId] = [...(collections[workspaceId] ?? []), resource];
    });
    return collections;
  }, {});
  Object.values(recentModifiedByWorkspace).forEach((workspaceResources) => {
    workspaceResources.sort((left, right) => {
      const byModified = (right.metadata.updatedAt ?? right.updatedAt).localeCompare(
        left.metadata.updatedAt ?? left.updatedAt,
      );
      return byModified || left.id.localeCompare(right.id);
    });
    workspaceResources.splice(8);
  });
  const folders = visibleResources.filter(isFolderResource);
  const childrenByFolder = visibleResources.reduce<Record<EntityId, Resource[]>>((children, resource) => {
    const parentId = readStringAttribute(resource, "folderParentId");
    if (!parentId) return children;
    children[parentId] = [...(children[parentId] ?? []), resource];
    return children;
  }, {});
  const topLevel = visibleResources.filter((resource) => !readStringAttribute(resource, "folderParentId"));

  return {
    all: contentResources,
    active,
    selectedId: active?.id,
    recent,
    recentModifiedByWorkspace,
    topLevel,
    folders,
    childrenByFolder,
    childCountByFolder: Object.fromEntries(
      folders.map((folder) => [folder.id, childrenByFolder[folder.id]?.length ?? 0]),
    ),
    indexedCountByFolder: Object.fromEntries(
      folders.map((folder) => [
        folder.id,
        Number(readNumberAttribute(folder, "folderIndexedCount") ?? childrenByFolder[folder.id]?.length ?? 0),
      ]),
    ),
    folderHealthById: Object.fromEntries(
      folders.map((folder) => [folder.id, readStringAttribute(folder, "resourceHealth") ?? "available"]),
    ),
    activeResources,
    archivedResources,
    deletedResources,
    metadataById: Object.fromEntries(contentResources.map((resource) => [resource.id, resource.metadata])),
    activeCount: activeResources.length,
    archivedCount: archivedResources.length,
    deletedCount: deletedResources.length,
    totalCount: contentResources.length,
  };
}

function isCalendarEventResource(resource: Resource): boolean {
  return resource.metadata.kind === "calendar-event" || resource.type === "application/vnd.karya.calendar-event";
}

function isFolderResource(resource: Resource): boolean {
  return resource.type === "inode/directory" || resource.metadata.kind === "folder";
}

function readStringAttribute(resource: Resource, key: string): string | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "string" ? value : undefined;
}

function readNumberAttribute(resource: Resource, key: string): number | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "number" ? value : undefined;
}
