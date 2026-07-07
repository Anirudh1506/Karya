import type { ImportDestination, Resource } from "@karya/types";
import type { KernelCommandContext } from "../../command-bus";

const DESKTOP_HOME_DEFAULT_SPACE_ID = "workspace-desktop-home-default-space";
const DESKTOP_USER_ID = "desktop-user";

export type CommandContext = KernelCommandContext;
export type RegistryContext = Pick<KernelCommandContext, "registry">;

export async function resolveImportDestination(destination: ImportDestination | undefined, context: RegistryContext) {
  const workspaceService = context.registry.resolve("workspaceService");
  const profileService = context.registry.resolve("profileService");
  const [activeProfile, activeWorkspace, profiles, workspaces] = await Promise.all([
    profileService.getActiveProfile(),
    workspaceService.getActiveWorkspace(),
    profileService.listProfiles(),
    workspaceService.listWorkspaces(),
  ]);

  const availableWorkspaces = workspaces.filter((candidate) => candidate.lifecycleState !== "deleted");
  const activeAvailableWorkspace = activeWorkspace?.lifecycleState !== "deleted" ? activeWorkspace : undefined;
  const workspace = destination?.workspaceId
    ? availableWorkspaces.find((candidate) => candidate.id === destination.workspaceId)
    : activeAvailableWorkspace;

  if (destination?.workspaceId && !workspace) {
    throw new Error(`Import destination workspace not available: ${destination.workspaceId}`);
  }

  const explicitProfile = destination?.profileId
    ? profiles.find((candidate) => candidate.id === destination.profileId)
    : undefined;

  if (destination?.profileId && !explicitProfile) {
    throw new Error(`Import destination profile not found: ${destination.profileId}`);
  }

  const isDesktopDefaultSpace = destination?.defaultSpace === "user" || workspace?.id === DESKTOP_HOME_DEFAULT_SPACE_ID;
  const profile = isDesktopDefaultSpace
    ? { id: DESKTOP_USER_ID }
    : explicitProfile
    ?? (workspace ? profiles.find((candidate) => candidate.id === workspace.profileId) : undefined)
    ?? activeProfile;

  const profileDefaultSpaceId = profiles.find((candidate) => candidate.id === profile.id)?.defaultSpaceId;
  const workspaceRefs = workspace ? [workspace.id] : [];
  const defaultSpace = destination?.defaultSpace
    ?? (workspace && workspace.id === profileDefaultSpaceId ? "profile" : workspaceRefs.length ? "none" : "profile");

  return {
    defaultSpace,
    primaryWorkspaceId: workspace?.id,
    profileId: profile.id,
    workspaceRefs,
  };
}

export async function requireResource(resourceId: string, context: CommandContext) {
  const resource = await context.registry.resolve("resourceService").getResource(resourceId);
  if (!resource) {
    throw new Error(`Resource not found: ${resourceId}`);
  }
  return resource;
}

export async function markResourceHealth(
  resourceId: string,
  health: "available" | "missing" | "moved" | "offline" | "cloud-only" | "archived",
  context: CommandContext,
) {
  const resource = await requireResource(resourceId, context);
  return registryUpdateMetadata(context, resourceId, {
    attributes: {
      ...(resource.metadata.attributes ?? {}),
      resourceHealth: health,
      resourceLastVerifiedAt: new Date().toISOString(),
    },
  });
}

export async function registryUpdateMetadata(
  context: CommandContext,
  resourceId: string,
  metadata: Partial<Resource["metadata"]>,
) {
  const resource = await requireResource(resourceId, context);
  return context.registry.resolve("resourceService").updateMetadata(resourceId, {
    ...resource.metadata,
    ...metadata,
    attributes: {
      ...(resource.metadata.attributes ?? {}),
      ...(metadata.attributes ?? {}),
    },
  });
}

export function getResourcePath(resource: Awaited<ReturnType<typeof requireResource>>): string | undefined {
  const value = resource.metadata.attributes?.contentSourcePath;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readStringAttribute(resource: Awaited<ReturnType<typeof requireResource>>, key: string): string | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function requireResourcePath(resource: Awaited<ReturnType<typeof requireResource>>): string {
  const path = getResourcePath(resource);
  if (!path) {
    throw new Error(`Resource does not have a local filesystem location: ${resource.id}`);
  }
  return path;
}

export async function assertPathAvailable(
  resource: Awaited<ReturnType<typeof requireResource>>,
  path: string,
  context: CommandContext,
): Promise<void> {
  const exists = await context.platform?.fileSystem.exists(path);
  if (!exists) {
    await markResourceHealth(resource.id, "missing", context);
    throw new Error(`Resource source is missing: ${path}`);
  }
}
