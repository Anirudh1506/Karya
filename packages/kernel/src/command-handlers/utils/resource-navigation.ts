import type { InstalledApplication } from "@karya/types";
import type { CommandContext } from "./resource-context";
import { assertPathAvailable, getResourcePath, markResourceHealth, readStringAttribute, requireResource } from "./resource-context";
import { isKaryaBookmark, readTaskString } from "./native-resources";
import { isLinkedResource, syncLinkedResource } from "./linked-resources";

export async function openResourceById(resourceId: string, context: CommandContext) {
  const initialResource = await requireResource(resourceId, context);
  const resource = isLinkedResource(initialResource) ? await syncLinkedResource(initialResource, context) : initialResource;
  const activeWorkspace = await context.registry.resolve("workspaceService").getActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  if (isKaryaBookmark(resource)) {
    const url = readTaskString(resource, "bookmarkUrl");
    if (url) {
      await context.platform?.applications.openExternal(url);
    }
    await context.publish("ResourceSelected", { resourceId: resource.id });
    await context.publish("ResourceOpened", { resource, workspaceId });
    await recordResourceNavigation(resource, context, workspaceId);
    return resource;
  }
  const path = getResourcePath(resource);
  if (!path) {
    await context.publish("ResourceSelected", { resourceId: resource.id });
    await context.publish("ResourceOpened", { resource, workspaceId });
    await recordResourceNavigation(resource, context, workspaceId);
    return resource;
  }
  await assertPathAvailable(resource, path, context);
  const application = await resolvePreferredApplication(resource, workspaceId, context);
  if (application) {
    await context.registry.resolve("applicationRegistry").launchApplication({
      applicationId: application.metadata.id,
      workspaceId,
      profileId: resource.profileId,
      resourceIds: [resource.id],
      resourcePath: path,
    });
  } else {
    await context.platform?.fileSystem.openPath(path);
  }
  await context.publish("ResourceOpened", { resource, workspaceId, applicationId: application?.metadata.id });
  await recordResourceNavigation(resource, context, workspaceId);
  return markResourceHealth(resource.id, "available", context);
}

export async function openResourceWithApplication(resourceId: string, applicationId: string, requestedWorkspaceId: string | undefined, context: CommandContext) {
  const initialResource = await requireResource(resourceId, context);
  const resource = isLinkedResource(initialResource) ? await syncLinkedResource(initialResource, context) : initialResource;
  const activeWorkspace = await context.registry.resolve("workspaceService").getActiveWorkspace();
  const workspaceId = requestedWorkspaceId ?? activeWorkspace?.id ?? resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  const path = getResourcePath(resource);
  if (!path) {
    throw new Error(`Resource does not have a local filesystem location: ${resource.id}`);
  }

  await assertPathAvailable(resource, path, context);
  await context.registry.resolve("applicationRegistry").launchApplication({
    applicationId,
    workspaceId,
    profileId: resource.profileId,
    resourceIds: [resource.id],
    resourcePath: path,
  });
  await context.publish("ResourceOpened", { resource, workspaceId, applicationId });
  await recordResourceNavigation(resource, context, workspaceId);
  return markResourceHealth(resource.id, "available", context);
}

export async function resolvePreferredApplication(
  resource: Awaited<ReturnType<typeof requireResource>>,
  workspaceId: string | undefined,
  context: CommandContext,
) {
  const [applications, workspaces, profiles] = await Promise.all([
    context.registry.resolve("applicationRegistry").listInstalledApplications(),
    context.registry.resolve("workspaceService").listWorkspaces(),
    context.registry.resolve("profileService").listProfiles(),
  ]);
  const workspace = workspaceId ? workspaces.find((candidate) => candidate.id === workspaceId) : undefined;
  const profile = profiles.find((candidate) => candidate.id === resource.profileId);
  const orderedIds = [
    ...(workspace?.pinnedApplicationIds ?? []),
    ...(profile?.preferences?.defaultApplicationIds ?? []),
    ...applications.filter((application) => application.defaultApplication).map((application) => application.metadata.id),
  ];

  for (const applicationId of orderedIds) {
    const application = applications.find((candidate) => candidate.metadata.id === applicationId);
    if (application && applicationSupportsResource(application, resource)) return application;
  }

  return applications.find((application) => applicationSupportsResource(application, resource));
}

export function applicationSupportsResource(application: InstalledApplication, resource: Awaited<ReturnType<typeof requireResource>>): boolean {
  const supportedTypes = application.metadata.supportedFileTypes ?? [];
  if (!supportedTypes.length) return false;
  const extension = readFileExtension(resource);
  const mimeType = readStringAttribute(resource, "contentMimeType") ?? resource.type;
  const kind = resource.metadata.kind;
  return supportedTypes.some((supportedType: string) => {
    const normalized = supportedType.toLocaleLowerCase();
    return normalized === mimeType.toLocaleLowerCase()
      || normalized === kind.toLocaleLowerCase()
      || Boolean(extension && normalized === extension.toLocaleLowerCase())
      || Boolean(extension && normalized === `.${extension.toLocaleLowerCase()}`);
  });
}

export function readFileExtension(resource: Awaited<ReturnType<typeof requireResource>>): string | undefined {
  const explicit = readStringAttribute(resource, "contentExtension");
  if (explicit) return explicit.replace(/^\./, "");
  const title = resource.metadata.title;
  const match = /\.([^.]+)$/.exec(title);
  return match?.[1];
}

export async function recordResourceNavigation(
  resource: Awaited<ReturnType<typeof requireResource>>,
  context: CommandContext,
  preferredWorkspaceId?: string,
): Promise<void> {
  const workspaceId = preferredWorkspaceId ?? resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  if (!workspaceId) return;
  const folderId = readStringAttribute(resource, "folderParentId");
  await context.registry.resolve("continuityService").updateWorkspaceNavigation({
    surface: folderId ? "folder" : "workspace",
    workspaceId,
    profileId: resource.profileId,
    folderId,
    selectedResourceId: resource.id,
    capturedAt: new Date().toISOString(),
  });
}
