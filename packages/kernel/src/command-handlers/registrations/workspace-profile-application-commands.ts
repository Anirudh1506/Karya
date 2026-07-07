import type { Resource } from "@karya/types";
import type { CommandBus } from "../../command-bus";
import { basename, dirname } from "node:path";
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

export function registerWorkspaceProfileApplicationCommandHandlers(commandBus: CommandBus): void {
commandBus.register("CreateWorkspaceCommand", async (command, { registry }) => {
    const profile = await registry.resolve("profileService").getActiveProfile();
    return registry.resolve("workspaceService").create({
      name: command.payload.name,
      profileId: profile.id,
      owner: profile.id,
      description: command.payload.description,
      templateId: command.payload.templateId,
    });
  });

  commandBus.register("OpenWorkspaceCommand", async (command, { registry }) => {
    const workspace = (await registry.resolve("workspaceService").listWorkspaces())
      .find((candidate) => candidate.id === command.payload.workspaceId);
    if (!workspace || workspace.lifecycleState === "deleted") {
      throw new Error(`Workspace is not available: ${command.payload.workspaceId}`);
    }
    const opened = await registry.resolve("workspaceService").open(command.payload.workspaceId);
    await registry.resolve("continuityService").openWorkspaceSession(opened.id, opened.profileId);
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

  commandBus.register("CreateProfileCommand", async (command, { registry }) => {
    const profile = await registry.resolve("profileService").create(command.payload);
    const defaultSpace = await registry.resolve("workspaceService").create({
      name: "Default Space",
      profileId: profile.id,
      owner: profile.id,
      description: `Default space for ${profile.name}`,
    });
    await registry.resolve("profileService").update({
      id: profile.id,
      defaultSpaceId: defaultSpace.id,
      spaceIds: [defaultSpace.id],
    });
    return registry.resolve("profileService").activateProfile(profile.id);
  });

  commandBus.register("OpenProfileCommand", async (command, { registry }) => {
    return registry.resolve("profileService").activateProfile(command.payload.profileId);
  });

  commandBus.register("ViewProfileCommand", async (command, { registry, publish }) => {
    const profile = (await registry.resolve("profileService").listProfiles()).find((candidate) => candidate.id === command.payload.profileId);
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
    const [profile, workspace] = await Promise.all([
      registry.resolve("profileService").getActiveProfile(),
      registry.resolve("workspaceService").getActiveWorkspace(),
    ]);

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
    return registry.resolve("applicationRegistry").setDefaultApplication(command.payload.applicationId, command.payload.isDefault);
  });

  commandBus.register("SetWorkspacePreferredApplicationCommand", async (command, { registry }) => {
    return registry.resolve("workspaceService").setPreferredApplication(
      command.payload.workspaceId,
      command.payload.applicationId,
      command.payload.preferred,
    );
  });
}
