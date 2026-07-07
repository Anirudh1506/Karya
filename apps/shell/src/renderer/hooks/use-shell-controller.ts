import { useCallback } from "react";
import type { ImportDestination, WorkspaceLaunchSet } from "@karya/types";
import type { KernelSnapshot } from "@karya/shell-adapter";
import { bootShellAdapter, getShellAdapter } from "../lib/runtime";
import { isFolderResource } from "../resources/resource-utils";
import { useShellStore } from "./shell-store";

const DESKTOP_HOME_DEFAULT_SPACE_ID = "workspace-desktop-home-default-space";

export function useShellController() {
  const shell = getShellAdapter();
  const { isReady, setReady, setSnapshot, snapshot } = useShellStore();

  const boot = useCallback(async () => {
    await bootShellAdapter();
    setSnapshot(await shell.getSnapshot());
    setReady(true);

    return shell.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });
  }, [setReady, setSnapshot, shell]);

  const search = useCallback(
    async (term: string) => {
      await shell.search(term);
    },
    [shell],
  );

  const createResource = useCallback(async () => {
    await shell.createResource(resolveCreateDestination(snapshot));
  }, [shell, snapshot]);

  const createNote = useCallback(async (title?: string, content?: string, destination?: ImportDestination) => {
    const note = await shell.createNote(destination ?? resolveCreateDestination(snapshot), title, content);
    await shell.selectResource(note.id);
    return note;
  }, [shell, snapshot]);

  const updateNoteContent = useCallback(async (resourceId: string, content: string) => {
    await shell.updateNoteContent(resourceId, content);
  }, [shell]);

  const createTask = useCallback(async (title?: string, destination?: ImportDestination) => {
    const task = await shell.createTask(destination ?? resolveCreateDestination(snapshot), title);
    if (!destination) {
      await shell.selectResource(task.id);
    }
    return task;
  }, [shell, snapshot]);

  const updateTask = useCallback(async (resourceId: string, patch: Parameters<typeof shell.updateTask>[1]) => {
    await shell.updateTask(resourceId, patch);
  }, [shell]);

  const completeTask = useCallback(async (resourceId: string) => {
    await shell.completeTask(resourceId);
  }, [shell]);

  const reopenTask = useCallback(async (resourceId: string) => {
    await shell.reopenTask(resourceId);
  }, [shell]);

  const createBookmark = useCallback(async (url: string, destination?: ImportDestination, options?: Parameters<typeof shell.createBookmark>[2]) => {
    const bookmark = await shell.createBookmark(destination ?? resolveCreateDestination(snapshot), url, options);
    if (!destination) {
      await shell.selectResource(bookmark.id);
    }
    return bookmark;
  }, [shell, snapshot]);

  const updateBookmark = useCallback(async (resourceId: string, patch: Parameters<typeof shell.updateBookmark>[1]) => {
    await shell.updateBookmark(resourceId, patch);
  }, [shell]);

  const createCalendarEvent = useCallback(async (title?: string, destination?: ImportDestination, options?: Parameters<typeof shell.createCalendarEvent>[2]) => {
    const event = await shell.createCalendarEvent(destination ?? resolveCreateDestination(snapshot), title, options);
    return event;
  }, [shell, snapshot]);

  const updateCalendarEvent = useCallback(async (resourceId: string, patch: Parameters<typeof shell.updateCalendarEvent>[1]) => {
    await shell.updateCalendarEvent(resourceId, patch);
  }, [shell]);

  const createRelationship = useCallback(async (...args: Parameters<typeof shell.createRelationship>) => {
    await shell.createRelationship(...args);
  }, [shell]);

  const removeRelationship = useCallback(async (...args: Parameters<typeof shell.removeRelationship>) => {
    await shell.removeRelationship(...args);
  }, [shell]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    await shell.markNotificationRead(notificationId);
  }, [shell]);

  const archiveNotification = useCallback(async (notificationId: string) => {
    await shell.archiveNotification(notificationId);
  }, [shell]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await shell.deleteNotification(notificationId);
  }, [shell]);

  const archiveCalendarEvent = useCallback(async (eventId: string) => {
    await shell.archiveCalendarEvent(eventId);
  }, [shell]);

  const deleteCalendarEvent = useCallback(async (eventId: string) => {
    await shell.deleteCalendarEvent(eventId);
  }, [shell]);

  const importFile = useCallback(async (destination?: ImportDestination) => {
    await shell.importFileFromPicker(destination);
  }, [shell]);

  const importDirectory = useCallback(async (destination?: ImportDestination) => {
    await shell.importDirectoryFromPicker(destination);
  }, [shell]);

  const linkFile = useCallback(async (destination?: ImportDestination) => {
    await shell.linkFileFromPicker(destination);
  }, [shell]);

  const linkDirectory = useCallback(async (destination?: ImportDestination) => {
    await shell.linkDirectoryFromPicker(destination);
  }, [shell]);

  const executeSearchResult = useCallback(
    async (result: NonNullable<typeof snapshot>["search"]["results"][number]) => {
      await shell.executeSearchResult(result);
    },
    [shell],
  );

  const activateWorkspace = useCallback(
    async (workspaceId: string) => {
      await shell.openWorkspace(workspaceId);
    },
    [shell],
  );

  const selectResource = useCallback(
    async (resourceId?: string) => {
      await shell.selectResource(resourceId);
    },
    [shell],
  );

  const openResource = useCallback(async (resourceId: string) => {
    await shell.openResource(resourceId);
  }, [shell]);

  const resumeResource = useCallback(async (resourceId: string, workspaceId?: string) => {
    const resource = snapshot?.resources.all.find((candidate) => candidate.id === resourceId);
    if (resource && isFolderResource(resource)) {
      await shell.openFolderResource(resourceId, workspaceId ?? resource.primaryWorkspaceId ?? resource.workspaceRefs[0]);
      return;
    }
    await shell.resumeContext([resourceId], workspaceId);
  }, [shell, snapshot]);

  const resumeWorkspace = useCallback(async (workspaceId: string) => {
    if (!snapshot) {
      await shell.resumeContext([], workspaceId);
      return;
    }
    const workspace = snapshot?.workspaces.all.find((candidate) => candidate.id === workspaceId);
    const launchSet = workspace?.launchSet;
    if (!workspace || !launchSet?.enabled || launchSet.items.length === 0) {
      await shell.resumeContext([], workspaceId);
      return;
    }

    await shell.openWorkspace(workspaceId);

    const runningApplicationIds = new Set(snapshot.applications.running.map((application) => application.metadata.id));
    const notifyLaunchSkipped = async (title: string, description: string) => {
      try {
        await shell.createNotification({
          title,
          description,
          category: "workspace",
          source: "continue-working",
          workspaceId,
          profileId: workspace.profileId,
          priority: "low",
        });
      } catch {
        // Continue Working should keep restoring even if notification delivery fails.
      }
    };

    for (const item of launchSet.items) {
      if (item.delayMs && item.delayMs > 0) {
        await wait(item.delayMs);
      }

      try {
        if (item.kind === "application") {
          const application = snapshot.applications.installed.find((candidate) => candidate.metadata.id === item.applicationId);
          if (!application || application.lifecycleState === "unavailable" || application.lifecycleState === "removed") {
            await notifyLaunchSkipped("Launch item skipped", "A configured application is unavailable on this desktop.");
            continue;
          }
          if (item.behavior === "skip-if-running" && runningApplicationIds.has(item.applicationId)) continue;
          await shell.launchApplication(item.applicationId, { workspaceId, profileId: workspace.profileId });
          continue;
        }

        const resource = snapshot.resources.all.find((candidate) => candidate.id === item.resourceId);
        if (!resource || item.behavior === "skip") continue;
        if (item.behavior === "reveal") {
          await shell.revealResource(item.resourceId);
        } else if (item.applicationId) {
          await shell.openResourceWithApplication(item.resourceId, item.applicationId, workspaceId);
        } else if (isFolderResource(resource)) {
          await shell.openFolderResource(item.resourceId, workspaceId);
        } else {
          await shell.openResource(item.resourceId);
        }
      } catch (error) {
        console.warn("Launch set item failed", item, error);
        await notifyLaunchSkipped("Launch item skipped", "A configured Continue Working item could not be opened.");
      }
    }

    const focusItem = launchSet.items.find((item) => item.id === launchSet.focusItemId) ?? launchSet.items.find((item) => item.kind === "resource");
    if (focusItem?.kind === "resource") {
      await shell.selectResource(focusItem.resourceId);
    }
  }, [shell, snapshot]);

  const openFolderResource = useCallback(async (resourceId: string, workspaceId?: string) => {
    const folder = snapshot?.resources.all.find((resource) => resource.id === resourceId);
    const destinationWorkspaceId = workspaceId
      ?? folder?.primaryWorkspaceId
      ?? folder?.workspaceRefs[0]
      ?? currentWorkspaceIdForSurface(snapshot);
    await shell.openFolderResource(resourceId, destinationWorkspaceId);
  }, [shell, snapshot]);

  const openHomeSurface = useCallback(async () => {
    await shell.openHomeSurface();
  }, [shell]);

  const openProfile = useCallback(async (profileId: string) => {
    await shell.openProfile(profileId);
  }, [shell]);

  const viewProfile = useCallback(async (profileId: string) => {
    await shell.viewProfile(profileId);
  }, [shell]);

  const createProfile = useCallback(async () => {
    await shell.createProfile("New Profile", {
      description: "A focused responsibility inside Karya.",
      template: "custom",
    });
  }, [shell]);

  const renameProfile = useCallback(async (profileId: string, name: string) => {
    await shell.renameProfile(profileId, name);
  }, [shell]);

  const createWorkspace = useCallback(async (name = "Untitled Workspace") => {
    await shell.createWorkspace(name);
  }, [shell]);

  const createWorkspaceForProfile = useCallback(async (profileId: string, name = "Untitled Workspace") => {
    await shell.openProfile(profileId);
    await shell.createWorkspace(name);
  }, [shell]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    await shell.renameWorkspace(workspaceId, name);
  }, [shell]);

  const archiveWorkspace = useCallback(async (workspaceId: string) => {
    await shell.archiveWorkspace(workspaceId);
  }, [shell]);

  const restoreWorkspace = useCallback(async (workspaceId: string) => {
    await shell.restoreWorkspace(workspaceId);
  }, [shell]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    await shell.deleteWorkspace(workspaceId);
  }, [shell]);

  const pinWorkspace = useCallback(async (workspaceId: string, pinned: boolean) => {
    await shell.pinWorkspace(workspaceId, pinned);
  }, [shell]);

  const archiveProfile = useCallback(async (profileId: string) => {
    await shell.archiveProfile(profileId);
  }, [shell]);

  const restoreProfile = useCallback(async (profileId: string) => {
    await shell.restoreProfile(profileId);
  }, [shell]);

  const deleteProfile = useCallback(async (profileId: string) => {
    await shell.deleteProfile(profileId);
  }, [shell]);

  const revealResource = useCallback(async (resourceId: string) => {
    await shell.revealResource(resourceId);
  }, [shell]);

  const openContainingFolder = useCallback(async (resourceId: string) => {
    await shell.openContainingFolder(resourceId);
  }, [shell]);

  const copyResourcePath = useCallback(async (resourceId: string) => {
    await shell.copyResourcePath(resourceId);
  }, [shell]);

  const checkResourceHealth = useCallback(async (resourceId: string) => {
    await shell.checkResourceHealth(resourceId);
  }, [shell]);

  const syncLinkedResource = useCallback(async (resourceId: string) => {
    await shell.syncLinkedResource(resourceId);
  }, [shell]);

  const launchApplication = useCallback(async (
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ) => {
    await shell.launchApplication(applicationId, options);
  }, [shell]);

  const setWorkspacePreferredApplication = useCallback(async (workspaceId: string, applicationId: string, preferred = true) => {
    const workspace = await shell.setWorkspacePreferredApplication(workspaceId, applicationId, preferred);
    patchWorkspaceSnapshot(setSnapshot, workspace);
  }, [setSnapshot, shell]);

  const updateWorkspaceLaunchSet = useCallback(async (workspaceId: string, launchSet: WorkspaceLaunchSet | undefined) => {
    const workspace = await shell.updateWorkspaceLaunchSet(workspaceId, launchSet);
    patchWorkspaceSnapshot(setSnapshot, workspace);
  }, [setSnapshot, shell]);

  const openResourceWithApplication = useCallback(async (resourceId: string, applicationId: string, workspaceId?: string) => {
    await shell.openResourceWithApplication(resourceId, applicationId, workspaceId);
  }, [shell]);

  const addWorkspaceApplication = useCallback(async (workspaceId: string, applicationId: string, includeInLaunchSet = false) => {
    const workspace = await shell.setWorkspacePreferredApplication(workspaceId, applicationId, true);
    patchWorkspaceSnapshot(setSnapshot, workspace);
    if (!includeInLaunchSet) return;

    const currentLaunchSet = workspace.launchSet ?? createEmptyLaunchSet();
    const alreadyIncluded = currentLaunchSet.items.some((item) => item.kind === "application" && item.applicationId === applicationId);
    if (alreadyIncluded) return;

    const updatedWorkspace = await shell.updateWorkspaceLaunchSet(workspaceId, {
      ...currentLaunchSet,
      enabled: true,
      items: [
        ...currentLaunchSet.items,
        {
          id: createLaunchItemId(),
          kind: "application",
          applicationId,
          behavior: "launch",
          delayMs: 0,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    patchWorkspaceSnapshot(setSnapshot, updatedWorkspace);
  }, [setSnapshot, shell]);

  const removeWorkspaceApplication = useCallback(async (workspaceId: string, applicationId: string) => {
    const workspace = await shell.setWorkspacePreferredApplication(workspaceId, applicationId, false);
    patchWorkspaceSnapshot(setSnapshot, workspace);
  }, [setSnapshot, shell]);

  const pinApplication = useCallback(async (applicationId: string) => {
    await shell.pinApplication(applicationId);
  }, [shell]);

  const unpinApplication = useCallback(async (applicationId: string) => {
    await shell.unpinApplication(applicationId);
  }, [shell]);

  const favoriteApplication = useCallback(async (applicationId: string) => {
    await shell.favoriteApplication(applicationId);
  }, [shell]);

  const unfavoriteApplication = useCallback(async (applicationId: string) => {
    await shell.unfavoriteApplication(applicationId);
  }, [shell]);

  const renameResource = useCallback(async (resourceId: string, title: string) => {
    await shell.renameResource(resourceId, title);
  }, [shell]);

  const moveResource = useCallback(async (resourceId: string, destination: ImportDestination) => {
    await shell.moveResource(resourceId, destination);
  }, [shell]);

  const addWorkspaceReference = useCallback(async (resourceId: string, workspaceId: string) => {
    await shell.addWorkspaceReference(resourceId, workspaceId);
  }, [shell]);

  const duplicateResource = useCallback(async (resourceId: string) => {
    await shell.duplicateResource(resourceId, resolveDuplicateDestination(snapshot, resourceId));
  }, [shell, snapshot]);

  const archiveResource = useCallback(async (resourceId: string) => {
    await shell.archiveResource(resourceId);
  }, [shell]);

  const restoreResource = useCallback(async (resourceId: string) => {
    await shell.restoreResource(resourceId);
  }, [shell]);

  const deleteResource = useCallback(async (resourceId: string) => {
    await shell.deleteResource(resourceId);
  }, [shell]);

  return {
    activeProfile: snapshot?.profiles.active,
    activeWorkspace: snapshot?.workspaces.active,
    activateWorkspace,
    addWorkspaceReference,
    applications: snapshot?.applications.pinned ?? [],
    archiveProfile,
    archiveResource,
    archiveWorkspace,
    boot,
    checkResourceHealth,
    copyResourcePath,
    createProfile,
    createResource,
    createNote,
    createTask,
    createWorkspace,
    createWorkspaceForProfile,
    deleteProfile,
    deleteResource,
    deleteWorkspace,
    duplicateResource,
    executeSearchResult,
    favoriteApplication,
    importDirectory,
    importFile,
    isReady,
    launchApplication,
    linkDirectory,
    linkFile,
    openContainingFolder,
    openFolderResource,
    openHomeSurface,
    openProfile,
    openResource,
    openResourceWithApplication,
    revealResource,
    renameResource,
    renameProfile,
    renameWorkspace,
    resumeWorkspace,
    resumeResource,
    restoreProfile,
    restoreResource,
    restoreWorkspace,
    updateWorkspaceLaunchSet,
    moveResource,
    pinWorkspace,
    pinApplication,
    viewProfile,
    activeSurface: snapshot?.shell.activeSurface ?? { type: "home" as const },
    breadcrumbs: snapshot?.shell.breadcrumbs ?? [{ id: "surface:home", label: "Home" }],
    folderChildren: snapshot?.shell.activeSurface.type === "folder" ? snapshot.resources.childrenByFolder[snapshot.shell.activeSurface.resourceId] ?? [] : [],
    resources: snapshot?.shell.activeSurface.type === "folder"
      ? snapshot.resources.childrenByFolder[snapshot.shell.activeSurface.resourceId] ?? []
      : snapshot?.shell.activeSurface.type === "workspace"
        ? (snapshot.workspaces.resourceIdsByWorkspace[snapshot.shell.activeSurface.workspaceId] ?? [])
            .map((resourceId) => snapshot.resources.all.find((resource) => resource.id === resourceId))
            .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource))
        : snapshot?.resources.topLevel ?? [],
    search,
    searchResults: snapshot?.search.results ?? [],
    searchTerm: snapshot?.search.query ?? "",
    selectResource,
    selectedResource: snapshot?.resources.active,
    session: snapshot?.continuity.currentSession,
    setWorkspacePreferredApplication,
    syncLinkedResource,
    addWorkspaceApplication,
    removeWorkspaceApplication,
    unpinApplication,
    unfavoriteApplication,
    updateNoteContent,
    createBookmark,
    updateBookmark,
    createCalendarEvent,
    updateCalendarEvent,
    createRelationship,
    removeRelationship,
    markNotificationRead,
    archiveNotification,
    deleteNotification,
    archiveCalendarEvent,
    deleteCalendarEvent,
    updateTask,
    completeTask,
    reopenTask,
    snapshot,
  };
}

function resolveCreateDestination(snapshot: ReturnType<typeof useShellStore.getState>["snapshot"]): ImportDestination | undefined {
  if (!snapshot) return undefined;

  const activeSurface = snapshot.shell.activeSurface;
  if (activeSurface.type === "workspace") {
    return destinationForWorkspace(snapshot, activeSurface.workspaceId);
  }

  if (activeSurface.type === "profile") {
    const profile = snapshot.profiles.all.find((candidate) => candidate.id === activeSurface.profileId);
    return profile
      ? {
          profileId: profile.id,
          workspaceId: profile.defaultSpaceId,
          defaultSpace: "profile",
        }
      : undefined;
  }

  if (activeSurface.type === "folder") {
    const folder = snapshot.resources.all.find((resource) => resource.id === activeSurface.resourceId);
    const workspaceId = folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
    return workspaceId ? destinationForWorkspace(snapshot, workspaceId) : undefined;
  }

  const desktopDefaultSpace = snapshot.workspaces.all.find((workspace) => workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID);
  return desktopDefaultSpace
    ? {
        workspaceId: desktopDefaultSpace.id,
        defaultSpace: "user",
      }
    : undefined;
}

function currentWorkspaceIdForSurface(snapshot: ReturnType<typeof useShellStore.getState>["snapshot"]): string | undefined {
  if (!snapshot) return undefined;
  const activeSurface = snapshot.shell.activeSurface;
  if (activeSurface.type === "workspace") return activeSurface.workspaceId;
  if (activeSurface.type === "folder") {
    const breadcrumbWorkspace = [...snapshot.shell.breadcrumbs].reverse().find((breadcrumb) => breadcrumb.workspaceId)?.workspaceId;
    if (breadcrumbWorkspace) return breadcrumbWorkspace;
    const folder = snapshot.resources.all.find((resource) => resource.id === activeSurface.resourceId);
    return folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
  }
  return undefined;
}

function patchWorkspaceSnapshot(
  setSnapshot: (snapshot: KernelSnapshot) => void,
  workspace: KernelSnapshot["workspaces"]["all"][number],
): void {
  const current = useShellStore.getState().snapshot;
  if (!current) return;

  setSnapshot({
    ...current,
    workspaces: {
      ...current.workspaces,
      all: current.workspaces.all.map((candidate) => candidate.id === workspace.id ? workspace : candidate),
      active: current.workspaces.active?.id === workspace.id ? workspace : current.workspaces.active,
    },
    applications: {
      ...current.applications,
      preferredByWorkspace: {
        ...current.applications.preferredByWorkspace,
        [workspace.id]: workspace.pinnedApplicationIds,
      },
    },
  });
}

function createEmptyLaunchSet(): WorkspaceLaunchSet {
  return {
    enabled: true,
    items: [],
    restoreInspector: true,
    updatedAt: new Date().toISOString(),
  };
}

function createLaunchItemId(): string {
  return `launch-item-${crypto.randomUUID()}`;
}

function resolveDuplicateDestination(
  snapshot: ReturnType<typeof useShellStore.getState>["snapshot"],
  resourceId: string,
): ImportDestination | undefined {
  if (!snapshot) return undefined;
  const resource = snapshot.resources.all.find((candidate) => candidate.id === resourceId);
  if (!resource) return resolveCreateDestination(snapshot);
  const workspaceId = resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  if (workspaceId) return destinationForWorkspace(snapshot, workspaceId);
  if (resource.defaultSpace === "user") {
    return { workspaceId: DESKTOP_HOME_DEFAULT_SPACE_ID, defaultSpace: "user" };
  }
  return {
    profileId: resource.profileId,
    defaultSpace: resource.defaultSpace === "profile" ? "profile" : "none",
  };
}

function destinationForWorkspace(
  snapshot: NonNullable<ReturnType<typeof useShellStore.getState>["snapshot"]>,
  workspaceId: string,
): ImportDestination | undefined {
  const workspace = snapshot.workspaces.all.find((candidate) => candidate.id === workspaceId);
  if (!workspace || workspace.lifecycleState === "deleted") return undefined;

  const profile = snapshot.profiles.all.find((candidate) => candidate.id === workspace.profileId);
  return {
    profileId: workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID ? undefined : workspace.profileId,
    workspaceId: workspace.id,
    defaultSpace: workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID
      ? "user"
      : profile?.defaultSpaceId === workspace.id
        ? "profile"
      : "none",
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}
