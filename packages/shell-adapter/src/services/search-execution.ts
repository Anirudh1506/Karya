import type { KaryaCommand } from "@karya/core";
import type { CommandRegistry } from "@karya/command-registry";
import type { EntityId, ImportDestination, Resource, SearchResult } from "@karya/types";
import type { ShellAdapter } from "../contracts";

export async function executeSearchResult(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  result: SearchResult,
  commandRegistry?: CommandRegistry,
): Promise<void> {
  const sourceId = result.document.sourceId;

  switch (result.document.type) {
    case "resource":
      if (await isFolderResource(getSnapshot, sourceId)) {
        await execute({
          id: crypto.randomUUID(),
          type: "OpenFolderResourceCommand",
          payload: { resourceId: sourceId },
        });
        return;
      }
      await execute<void>({
        id: crypto.randomUUID(),
        type: "SelectResourceCommand",
        payload: { resourceId: sourceId },
      });
      return;
    case "event": {
      const workspaceId = await getEventWorkspaceId(getSnapshot, sourceId);
      if (workspaceId) {
        await execute({
          id: crypto.randomUUID(),
          type: "OpenWorkspaceCommand",
          payload: { workspaceId },
        });
      }
      await execute<void>({
        id: crypto.randomUUID(),
        type: "SelectCalendarEventCommand",
        payload: { eventId: sourceId },
      });
      return;
    }
    case "notification":
      await execute<void>({
        id: crypto.randomUUID(),
        type: "MarkNotificationReadCommand",
        payload: { notificationId: sourceId },
      });
      return;
    case "activity":
      await executeActivityResult(getSnapshot, execute, sourceId);
      return;
    case "workspace":
      await execute({
        id: crypto.randomUUID(),
        type: "OpenWorkspaceCommand",
        payload: { workspaceId: sourceId },
      });
      return;
    case "profile":
      if (await isArchivedProfile(getSnapshot, sourceId)) {
        await execute({
          id: crypto.randomUUID(),
          type: "ViewProfileCommand",
          payload: { profileId: sourceId },
        });
        return;
      }
      await execute({
        id: crypto.randomUUID(),
        type: "OpenProfileCommand",
        payload: { profileId: sourceId },
      });
      return;
    case "application":
      await execute({
        id: crypto.randomUUID(),
        type: "LaunchApplicationCommand",
        payload: { applicationId: sourceId },
      });
      return;
    case "setting":
      await execute({
        id: crypto.randomUUID(),
        type: "OpenSettingCommand",
        payload: { settingId: sourceId },
      });
      return;
    case "command":
      await executeNamedCommand(getSnapshot, execute, sourceId, commandRegistry);
      return;
  }
}

async function executeActivityResult(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  activityId: EntityId,
): Promise<void> {
  const snapshot = await getSnapshot();
  const activity = snapshot.activity.items.find((item) => item.id === activityId);
  if (!activity) return;
  if (activity.object.type === "resource") {
    await execute<void>({
      id: crypto.randomUUID(),
      type: "SelectResourceCommand",
      payload: { resourceId: activity.object.id },
    });
    return;
  }
  if (activity.object.type === "event") {
    await execute<void>({
      id: crypto.randomUUID(),
      type: "SelectCalendarEventCommand",
      payload: { eventId: activity.object.id },
    });
    return;
  }
  if (activity.workspaceId) {
    await execute({
      id: crypto.randomUUID(),
      type: "OpenWorkspaceCommand",
      payload: { workspaceId: activity.workspaceId },
    });
  }
}

async function getEventWorkspaceId(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  eventId: EntityId,
): Promise<EntityId | undefined> {
  const snapshot = await getSnapshot();
  const event = snapshot.events.all.find((item) => item.id === eventId);
  return event?.primaryWorkspaceId ?? event?.workspaceRefs[0];
}

async function isArchivedProfile(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  profileId: EntityId,
): Promise<boolean> {
  const snapshot = await getSnapshot();
  const profile = snapshot.profiles.all.find((item) => item.id === profileId);
  return profile?.lifecycleState === "archived";
}

async function isFolderResource(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  resourceId: EntityId,
): Promise<boolean> {
  const snapshot = await getSnapshot();
  const resource = snapshot.resources.all.find((item) => item.id === resourceId);
  return resource?.type === "inode/directory" || resource?.metadata.kind === "folder";
}

async function executeNamedCommand(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  commandId: EntityId,
  commandRegistry?: CommandRegistry,
): Promise<void> {
  if (commandId.startsWith("recent-search:")) {
    await execute({
      id: crypto.randomUUID(),
      type: "SearchCommand",
      payload: { term: commandId.replace("recent-search:", "") },
    });
    return;
  }

  if (commandId.startsWith("quick-create-note:")) {
    await createNoteFromQuery(getSnapshot, execute, commandId, "quick-create-note:");
    return;
  }

  if (commandId.startsWith("quick-create-task:")) {
    await createTaskFromQuery(getSnapshot, execute, commandId, "quick-create-task:");
    return;
  }

  if (commandId.startsWith("quick-create-document:")) {
    await createResourceFromQuery(execute, commandId, "quick-create-document:", "document", ["document", "created"]);
    return;
  }

  if (commandId.startsWith("quick-capture:")) {
    await createResourceFromQuery(execute, commandId, "quick-capture:", "capture", ["capture", "created"]);
    return;
  }

  if (commandId.startsWith("quick-create-workspace:")) {
    await execute({
      id: crypto.randomUUID(),
      type: "CreateWorkspaceCommand",
      payload: { name: commandId.replace("quick-create-workspace:", "") },
    });
    return;
  }

  if (commandId.startsWith("preview-archive-resource:")) {
    await execute({
      id: crypto.randomUUID(),
      type: "ArchiveResourceCommand",
      payload: { resourceId: commandId.replace("preview-archive-resource:", "") },
    });
    return;
  }

  if (commandId.startsWith("preview-duplicate-resource:")) {
    await execute({
      id: crypto.randomUUID(),
      type: "DuplicateResourceCommand",
      payload: { resourceId: commandId.replace("preview-duplicate-resource:", "") },
    });
    return;
  }

  if (commandId.startsWith("preview-delete-resource:")) {
    await execute({
      id: crypto.randomUUID(),
      type: "DeleteResourceCommand",
      payload: { resourceId: commandId.replace("preview-delete-resource:", "") },
    });
    return;
  }

  if (commandRegistry) {
    await commandRegistry.execute(commandId, {
      execute: (command) => execute(command as KaryaCommand),
      getSnapshot,
    });
    return;
  }

  switch (commandId) {
    case "create-resource":
      await execute({
        id: crypto.randomUUID(),
        type: "CreateResourceCommand",
        payload: { displayTitle: "Untitled Resource", resourceType: "resource", tags: ["created"] },
      });
      return;
    case "create-task": {
      const task = await execute<Resource>({
        id: crypto.randomUUID(),
        type: "CreateTaskCommand",
        payload: {
          title: "Untitled Task",
          destination: resolveSnapshotCreateDestination(await getSnapshot()),
        },
      });
      await execute({
        id: crypto.randomUUID(),
        type: "SelectResourceCommand",
        payload: { resourceId: task.id },
      });
      return;
    }
    case "resume-last-workspace": {
      const snapshot = await getSnapshot();
      await execute({
        id: crypto.randomUUID(),
        type: "ResumeContextCommand",
        payload: {
          resourceIds: snapshot.resources.recent.map((resource) => resource.id),
          workspaceId: snapshot.workspaces.active?.id,
        },
      });
      return;
    }
    case "open-downloads":
      await openApplicationIfAvailable(getSnapshot, execute, "app-downloads");
      return;
    case "open-files":
      await openApplicationIfAvailable(getSnapshot, execute, "app-files");
      return;
    case "open-notes":
      await openApplicationIfAvailable(getSnapshot, execute, "app-notes");
      return;
    case "archive-resource": {
      const snapshot = await getSnapshot();
      const resourceId = snapshot.resources.selectedId;
      if (!resourceId) return;
      await execute({
        id: crypto.randomUUID(),
        type: "ArchiveResourceCommand",
        payload: { resourceId },
      });
      return;
    }
    case "switch-profile": {
      const snapshot = await getSnapshot();
      const nextProfile =
        snapshot.profiles.all.find((profile) => profile.id !== snapshot.profiles.active?.id) ??
        snapshot.profiles.active;
      if (!nextProfile) return;
      await execute({
        id: crypto.randomUUID(),
        type: "OpenProfileCommand",
        payload: { profileId: nextProfile.id },
      });
      return;
    }
    case "open-clipboard":
      await execute({
        id: crypto.randomUUID(),
        type: "OpenSettingCommand",
        payload: { settingId: "setting-clipboard" },
      });
      return;
  }
}

async function createResourceFromQuery(
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  commandId: EntityId,
  prefix: string,
  resourceType: string,
  tags: string[],
): Promise<void> {
  const displayTitle = commandId.replace(prefix, "").trim() || "Untitled Resource";
  await execute({
    id: crypto.randomUUID(),
    type: "CreateResourceCommand",
    payload: { displayTitle, resourceType, tags },
  });
}

async function createNoteFromQuery(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  commandId: EntityId,
  prefix: string,
): Promise<void> {
  const title = commandId.replace(prefix, "").trim() || "Untitled Note";
  const note = await execute<Resource>({
    id: crypto.randomUUID(),
    type: "CreateNoteCommand",
    payload: {
      title,
      content: "",
      destination: resolveSnapshotCreateDestination(await getSnapshot()),
    },
  });
  await execute({
    id: crypto.randomUUID(),
    type: "SelectResourceCommand",
    payload: { resourceId: note.id },
  });
}

async function createTaskFromQuery(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  commandId: EntityId,
  prefix: string,
): Promise<void> {
  const title = commandId.replace(prefix, "").trim() || "Untitled Task";
  const task = await execute<Resource>({
    id: crypto.randomUUID(),
    type: "CreateTaskCommand",
    payload: {
      title,
      destination: resolveSnapshotCreateDestination(await getSnapshot()),
    },
  });
  await execute({
    id: crypto.randomUUID(),
    type: "SelectResourceCommand",
    payload: { resourceId: task.id },
  });
}

type ShellSnapshot = Awaited<ReturnType<ShellAdapter["getSnapshot"]>>;

function resolveSnapshotCreateDestination(snapshot: ShellSnapshot): ImportDestination | undefined {
  const activeSurface = snapshot.shell.activeSurface;
  if (activeSurface.type === "workspace") {
    return destinationForSnapshotWorkspace(snapshot, activeSurface.workspaceId);
  }
  if (activeSurface.type === "profile") {
    const profile = snapshot.profiles.all.find((candidate) => candidate.id === activeSurface.profileId);
    return profile
      ? { profileId: profile.id, workspaceId: profile.defaultSpaceId, defaultSpace: "profile" }
      : undefined;
  }
  if (activeSurface.type === "folder") {
    const folder = snapshot.resources.all.find((resource) => resource.id === activeSurface.resourceId);
    const workspaceId = folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
    return workspaceId ? destinationForSnapshotWorkspace(snapshot, workspaceId) : undefined;
  }
  const desktopDefaultSpace = snapshot.workspaces.all.find(
    (workspace) => workspace.id === "workspace-desktop-home-default-space",
  );
  return desktopDefaultSpace ? { workspaceId: desktopDefaultSpace.id, defaultSpace: "user" } : undefined;
}

function destinationForSnapshotWorkspace(
  snapshot: ShellSnapshot,
  workspaceId: EntityId,
): ImportDestination | undefined {
  const workspace = snapshot.workspaces.all.find((candidate) => candidate.id === workspaceId);
  if (!workspace || workspace.lifecycleState === "deleted") return undefined;
  if (workspace.id === "workspace-desktop-home-default-space") {
    return { workspaceId: workspace.id, defaultSpace: "user" };
  }
  const ownerProfile = snapshot.profiles.all.find((profile) => profile.id === workspace.profileId);
  return {
    profileId: workspace.profileId,
    workspaceId: workspace.id,
    defaultSpace: ownerProfile?.defaultSpaceId === workspace.id ? "profile" : "none",
  };
}

async function openApplicationIfAvailable(
  getSnapshot: () => ReturnType<ShellAdapter["getSnapshot"]>,
  execute: <TResult = unknown>(command: KaryaCommand) => Promise<TResult>,
  applicationId: EntityId,
): Promise<void> {
  const snapshot = await getSnapshot();
  const application = snapshot.applications.installed.find((item) => item.metadata.id === applicationId);
  if (!application) return;

  await execute({
    id: crypto.randomUUID(),
    type: "LaunchApplicationCommand",
    payload: { applicationId },
  });
}
