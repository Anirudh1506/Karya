import type { EntityId, Profile, Resource, Workspace } from "@karya/types";
import type { ProfileState } from "../types";

const DESKTOP_HOME_DEFAULT_SPACE_ID = "workspace-desktop-home-default-space";

export function deriveProfiles(
  profiles: Profile[],
  resources: Resource[],
  workspaces: Workspace[],
  activeProfileId?: EntityId,
): ProfileState {
  const visible = profiles.filter((profile) => (profile.lifecycleState ?? "active") !== "deleted");
  const activeProfiles = visible.filter((profile) => (profile.lifecycleState ?? "active") === "active");
  const active = activeProfiles.find((profile) => profile.id === activeProfileId) ?? activeProfiles[0];
  const archived = profiles.filter((profile) => profile.lifecycleState === "archived");
  const favoriteWorkspaceIds = new Set(visible.flatMap((profile) => profile.preferences?.favoriteWorkspaceIds ?? []));
  const favorite = visible.filter((profile) => profile.preferences?.favoriteWorkspaceIds?.some((id) => favoriteWorkspaceIds.has(id)));
  const recent = [...activeProfiles]
    .sort((left, right) => (right.lastActiveAt ?? right.updatedAt ?? right.createdAt).localeCompare(left.lastActiveAt ?? left.updatedAt ?? left.createdAt))
    .slice(0, 6);
  const workspaceIdsByProfile = workspaces.reduce<Record<EntityId, EntityId[]>>((groups, workspace) => {
    if (workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID) return groups;
    groups[workspace.profileId] = [...(groups[workspace.profileId] ?? []), workspace.id];
    return groups;
  }, {});

  return {
    all: profiles,
    active,
    recent,
    favorite,
    archived,
    defaultProfile: activeProfiles[0],
    defaultSpaceIds: profiles.map((profile) => profile.defaultSpaceId),
    statisticsById: Object.fromEntries(
      profiles.map((profile) => [profile.id, deriveProfileStatistics(profile, resources, workspaces)]),
    ),
    workspaceIdsByProfile,
  };
}

function deriveProfileStatistics(profile: Profile, resources: Resource[], workspaces: Workspace[]): ProfileState["statisticsById"][EntityId] {
  const profileResources = resources.filter((resource) => resource.profileId === profile.id && resource.defaultSpace !== "user");
  const profileWorkspaces = workspaces.filter((workspace) => workspace.profileId === profile.id && workspace.id !== DESKTOP_HOME_DEFAULT_SPACE_ID && workspace.lifecycleState !== "deleted");
  const recentResourceUpdate = profileResources
    .map((resource) => resource.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0];
  const recentWorkspaceUpdate = profileWorkspaces
    .map((workspace) => workspace.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0];

  return {
    totalResources: profileResources.length,
    activeResources: profileResources.filter((resource) => resource.lifecycleState === "active").length,
    archivedResources: profileResources.filter((resource) => resource.lifecycleState === "archived").length,
    workspaceCount: profileWorkspaces.length,
    recentActivity: [recentResourceUpdate, recentWorkspaceUpdate].filter(Boolean).sort((left, right) => right.localeCompare(left))[0],
    lastActive: profile.lastActiveAt,
    storageUsed: profileResources.reduce((sum, resource) => {
      const byteLength = resource.metadata.attributes?.contentByteLength;
      return sum + (typeof byteLength === "number" ? byteLength : 0);
    }, 0),
    applicationsUsed: 0,
    importCount: profileResources.filter((resource) => resource.tags.includes("imported")).length,
  };
}
