import type { EntityId, Resource, Workspace } from "@karya/types";
import type { WorkspaceState } from "../types";

const DESKTOP_HOME_DEFAULT_SPACE_ID = "workspace-desktop-home-default-space";

export function deriveWorkspaces(workspaces: Workspace[], activeWorkspaceId?: EntityId): Omit<WorkspaceState, "resourceCountByWorkspace" | "resourceIdsByWorkspace"> {
  const visible = workspaces.filter((workspace) => workspace.lifecycleState !== "deleted");
  const open = visible.filter((workspace) => workspace.lifecycleState === "open");
  const archived = workspaces.filter((workspace) => workspace.lifecycleState === "archived");
  const pinned = visible.filter((workspace) => workspace.pinned);
  const active = visible.find((workspace) => workspace.id === activeWorkspaceId) ?? open[0];
  const recent = [...visible].sort((left, right) =>
    (right.lastOpenedAt ?? right.updatedAt).localeCompare(left.lastOpenedAt ?? left.updatedAt),
  ).slice(0, 8);

  return {
    all: workspaces,
    active,
    open,
    recent,
    archived,
    pinned,
    status: Object.fromEntries(workspaces.map((workspace) => [workspace.id, workspace.lifecycleState])),
    openCount: open.length,
    archivedCount: archived.length,
    pinnedCount: pinned.length,
    totalCount: workspaces.length,
  };
}

export function countResourcesByWorkspace(resources: Resource[]): Record<EntityId, number> {
  return resources.reduce<Record<EntityId, number>>((counts, resource) => {
    if (resource.lifecycleState === "deleted") return counts;
    if (hasFolderParent(resource)) return counts;
    resource.workspaceRefs.forEach((workspaceId) => {
      counts[workspaceId] = (counts[workspaceId] ?? 0) + 1;
    });
    return counts;
  }, {});
}

export function collectResourcesByWorkspace(resources: Resource[]): Record<EntityId, EntityId[]> {
  return resources.reduce<Record<EntityId, EntityId[]>>((collections, resource) => {
    if (resource.lifecycleState === "deleted") return collections;
    if (hasFolderParent(resource)) return collections;
    resource.workspaceRefs.forEach((workspaceId) => {
      collections[workspaceId] = [...(collections[workspaceId] ?? []), resource.id];
    });
    return collections;
  }, {});
}

function hasFolderParent(resource: Resource): boolean {
  return typeof resource.metadata.attributes?.folderParentId === "string";
}
