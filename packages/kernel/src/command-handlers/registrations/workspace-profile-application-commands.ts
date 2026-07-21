import { fileNameFromPath, parentPath, type Resource } from "@karya/types";
import type { CommandBus } from "../../command-bus";
import {
  assertPathAvailable,
  checkResourceAvailability,
  createIndexedNoteAttributes,
  createLinkedResourceAttributes,
  createNativeBookmark,
  createNativeCalendarEvent,
  createNativeNote,
  createNativeTask,
  createNoteContentAttributes,
  getResourcePath,
  isEditableKaryaNote,
  isKaryaBookmark,
  isKaryaCalendarEvent,
  isKaryaTask,
  isLinkedResource,
  isNoteFile,
  markResourceHealth,
  normalizeBookmarkUrl,
  openResourceById,
  openResourceWithApplication,
  rankSearchResultsByActivity,
  readStringAttribute,
  recordResourceNavigation,
  registryUpdateMetadata,
  requireResource,
  requireResourcePath,
  resolveImportDestination,
  summarizeNote,
  syncLinkedResource,
  updateNativeBookmark,
  updateNativeCalendarEvent,
  updateNativeTask,
} from "../helpers";
import {
  ACTIVE_PROFILE_REQUIRED_ERROR,
  PROFILE_NAME_REQUIRED_ERROR,
  DESKTOP_HOME_DEFAULT_SPACE_ID,
  WORKSPACE_NAME_REQUIRED_ERROR,
} from "../../constants";

export function registerWorkspaceProfileApplicationCommandHandlers(commandBus: CommandBus): void {
  commandBus.register("CreateWorkspaceCommand", async (command, { registry }) => {
    const name = command.payload.name.trim();
    if (!name) throw new Error(WORKSPACE_NAME_REQUIRED_ERROR);
    const profile = await requireActiveProfile(registry.resolve("profileService").getActiveProfile());
    const workspace = await registry.resolve("workspaceService").create({
      name,
      profileId: profile.id,
      owner: profile.id,
      description: command.payload.description,
      color: command.payload.color,
      icon: command.payload.icon,
      templateId: command.payload.templateId,
    });
    await registry.resolve("continuityService").openWorkspaceSession(workspace.id, profile.id);
    return workspace;
  });

  commandBus.register("OpenWorkspaceCommand", async (command, { registry }) => {
    const workspace = (await registry.resolve("workspaceService").listWorkspaces()).find(
      (candidate) => candidate.id === command.payload.workspaceId,
    );
    if (!workspace || workspace.lifecycleState === "archived" || workspace.lifecycleState === "deleted") {
      throw new Error(`Workspace is not available: ${command.payload.workspaceId}`);
    }
    const activeProfile = await requireActiveProfile(registry.resolve("profileService").getActiveProfile());
    const isDesktopHomeDefaultSpace = workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID;
    if (!isDesktopHomeDefaultSpace && workspace.profileId !== activeProfile.id) {
      throw new Error(`Workspace does not belong to the active profile: ${command.payload.workspaceId}`);
    }
    const opened = await registry.resolve("workspaceService").open(command.payload.workspaceId);
    return opened;
  });

  commandBus.register("CloseWorkspaceCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").close(command.payload.workspaceId);
  });

  commandBus.register("RenameWorkspaceCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").rename(command.payload.workspaceId, command.payload.name);
  });

  commandBus.register("ArchiveWorkspaceCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").archive(command.payload.workspaceId);
  });

  commandBus.register("RestoreWorkspaceCommand", async (command, { registry }) => {
    const workspace = (await registry.resolve("workspaceService").listWorkspaces()).find(
      (candidate) => candidate.id === command.payload.workspaceId,
    );
    const activeProfile = await requireActiveProfile(registry.resolve("profileService").getActiveProfile());
    if (!workspace || workspace.profileId !== activeProfile.id) {
      throw new Error(`Workspace does not belong to the active profile: ${command.payload.workspaceId}`);
    }
    return registry.resolve("workspaceService").restore(command.payload.workspaceId);
  });

  commandBus.register("DeleteWorkspaceCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").delete(command.payload.workspaceId);
  });

  commandBus.register("PinWorkspaceCommand", async (command, { registry }) => {
    return command.payload.pinned
      ? registry.resolve("workspaceService").pin(command.payload.workspaceId)
      : registry.resolve("workspaceService").unpin(command.payload.workspaceId);
  });

  commandBus.register("UpdateWorkspaceLaunchSetCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").updateLaunchSet(command.payload.workspaceId, command.payload.launchSet);
  });

  commandBus.register("UpdateWorkspaceSettingsCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").updateSettings(command.payload.workspaceId, command.payload.update);
  });

  commandBus.register("CreateProfileCommand", async (command, { registry }) => {
    if (!command.payload.name.trim()) throw new Error(PROFILE_NAME_REQUIRED_ERROR);
    const profile = await registry.resolve("profileService").create(command.payload);
    return registry.resolve("profileService").activateProfile(profile.id, false);
  });

  commandBus.register("OpenProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").activateProfile(command.payload.profileId, false);
  });

  commandBus.register("ViewProfileCommand", async (command, { registry, publish }) => {
    const profile = (await registry.resolve("profileService").listProfiles()).find(
      (candidate) => candidate.id === command.payload.profileId,
    );
    if (!profile || profile.lifecycleState === "deleted") {
      throw new Error(`Profile not found: ${command.payload.profileId}`);
    }
    await publish("ProfileViewed", { profile, profileId: profile.id });
    return profile;
  });

  commandBus.register("RenameProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").rename(command.payload.profileId, command.payload.name);
  });

  commandBus.register("UpdateProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").update({ id: command.payload.profileId, ...command.payload });
  });

  commandBus.register("ArchiveProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").archive(command.payload.profileId);
  });

  commandBus.register("RestoreProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").restore(command.payload.profileId);
  });

  commandBus.register("DeleteProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").delete(command.payload.profileId);
  });

  commandBus.register("SwitchProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").switchProfile(command.payload.profileId);
  });

  commandBus.register("DiscoverApplicationsCommand", async (_command, { registry }) => {
    return registry.resolve("applicationRegistry").discoverApplications();
  });

  commandBus.register("RefreshApplicationsCommand", async (_command, { registry }) => {
    return registry.resolve("applicationRegistry").refreshApplications();
  });

  commandBus.register("LaunchApplicationCommand", async (command, { registry }) => {
    const [profileResult, workspace] = await Promise.all([
      registry.resolve("profileService").getActiveProfile(),
      registry.resolve("workspaceService").getActiveWorkspace(),
    ]);
    const profile = await requireActiveProfile(Promise.resolve(profileResult));

    return registry.resolve("applicationRegistry").launchApplication({
      applicationId: command.payload.applicationId,
      launchArguments: command.payload.launchArguments,
      workingDirectory: command.payload.workingDirectory,
      resourceIds: command.payload.resourceIds,
      profileId: command.payload.profileId ?? profile.id,
      workspaceId: command.payload.workspaceId ?? workspace?.id,
    });
  });

  commandBus.register("OpenApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").launchApplication({ applicationId: command.payload.applicationId });
  });

  commandBus.register("PinApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").pinApplication(command.payload.applicationId);
  });

  commandBus.register("UnpinApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").unpinApplication(command.payload.applicationId);
  });

  commandBus.register("FavoriteApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").favoriteApplication(command.payload.applicationId);
  });

  commandBus.register("UnfavoriteApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").unfavoriteApplication(command.payload.applicationId);
  });

  commandBus.register("HideApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").hideApplication(command.payload.applicationId);
  });

  commandBus.register("ShowApplicationCommand", async (command, { registry }) => {
    return registry.resolve("applicationRegistry").showApplication(command.payload.applicationId);
  });

  commandBus.register("SetDefaultApplicationCommand", async (command, { registry }) => {
    return registry
      .resolve("applicationRegistry")
      .setDefaultApplication(command.payload.applicationId, command.payload.isDefault);
  });

  commandBus.register("SetWorkspacePreferredApplicationCommand", async (command, { registry }) => {
    return registry
      .resolve("workspaceService")
      .setPreferredApplication(command.payload.workspaceId, command.payload.applicationId, command.payload.preferred);
  });
}

async function requireActiveProfile(profile: Promise<import("@karya/types").Profile | undefined>) {
  const activeProfile = await profile;
  if (!activeProfile) throw new Error(ACTIVE_PROFILE_REQUIRED_ERROR);
  return activeProfile;
}
