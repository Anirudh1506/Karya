import {
  Archive,
  Bell,
  Bold,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Circle,
  Command,
  ExternalLink,
  Flag,
  FolderInput,
  FolderOpen,
  GitBranch,
  Heading2,
  Highlighter,
  Home,
  Inbox,
  Italic,
  Layers3,
  List,
  ListOrdered,
  Minus,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Strikethrough,
  Tag,
  Trash2,
  Underline,
  UserCircle,
  X,
} from "lucide-react";
import { Badge, Button, Surface, cn } from "@karya/ui";
import type { KernelSnapshot } from "@karya/core";
import type {
  ImportDestination,
  KaryaActivity,
  KaryaNotification,
  NotificationAction,
  RelationshipObjectType,
  RelationshipType,
  WorkspaceLaunchSet,
  WorkspaceLaunchSetItem,
  WorkspaceSettings,
  WorkspaceSettingsUpdate,
} from "@karya/types";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { UniversalSearchOverlay } from "../components/universal-search-overlay";
import {
  AddResourceReferenceDialog,
  AddWorkspaceApplicationDialog,
  ApplicationPropertiesDialog,
  CreateNamedEntityDialog,
  ImportDestinationDialog,
  MoveResourceDialog,
  OpenWithDialog,
  RenameProfileDialog,
  RenameResourceDialog,
  RenameWorkspaceDialog,
  ResourcePropertiesDialog,
} from "../components/dialogs";
import { NATIVE_COMMANDS } from "../../constants";
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_NAME_PLACEHOLDER,
  WORKSPACE_NAME_MAX_LENGTH,
  WORKSPACE_NAME_PLACEHOLDER,
  VISUAL_STUDIO_CODE_IDENTIFIERS,
} from "../constants";
import { htmlToPlainText, NativeNoteEditor, NativeTaskEditor } from "../components/editors/native-editors";
import { useShellController } from "../hooks/use-shell-controller";

import { DESKTOP_HOME_DEFAULT_SPACE_ID } from "../types";
import type {
  ImportMode,
  PlacementOperation,
  PendingPlacement,
  ResourceSnapshot,
  EventSnapshot,
  ApplicationSnapshot,
  ResourceContextAction,
  TaskStatus,
  TaskPriority,
  TaskView,
  TaskFilter,
  TaskPatch,
  BookmarkReadingStatus,
  BookmarkPatch,
  CalendarView,
  CalendarEventCategory,
  CalendarEventPatch,
} from "../types";
import {
  profileNameForWorkspace,
  resourceLocationLabel,
  workspaceNameForResource,
  displayWorkspaceName,
  currentSurfaceName,
  currentSurfaceWorkspaceId,
  currentSurfaceProfileId,
  getDesktopHomeDefaultSpace,
  getImportWorkspaceOptions,
  getMoveWorkspaceOptions,
  destinationFromWorkspace,
  formatShortDate,
  formatRelativeTime,
  formatDurationSince,
  uniqueIds,
  formatActivityType,
  formatInsightActivity,
  getResourceActivities,
  isFolderResource,
  isReferencedResource,
  isVisibleResource,
  isTaskResource,
  isBookmarkResource,
  isCalendarEvent,
  isEditableNativeNote,
  readTaskStatus,
  readTaskPriority,
  readTaskList,
  readTaskCompletedList,
  readTaskLabels,
  isTaskPinned,
  readBookmarkStatus,
  readBookmarkLabels,
  readBookmarkDomain,
  isBookmarkPinned,
  compareBookmarks,
  collectBookmarkLabels,
  formatBookmarkStatus,
  formatBookmarkFilter,
  countBookmarks,
  readCalendarStartDate,
  readCalendarEndDate,
  readCalendarLabels,
  readCalendarRelatedIds,
  readCalendarCategory,
  readCalendarColor,
  readCalendarTimeLabel,
  compareCalendarEvents,
  collectCalendarLabels,
  formatCalendarCategory,
  formatCalendarDateRange,
  calendarEventOccursOn,
  countCalendarEvents,
  todayDateKey,
  startOfWeek,
  addDays,
  addCalendarView,
  calendarColorForTitle,
  filterTasks,
  formatTaskFilter,
  collectTaskLabels,
  labelColor,
  taskTone,
  parseTaskDate,
  startOfLocalDay,
  startOfMonth,
  addMonths,
  buildCalendarDays,
  formatTaskDateKey,
  formatTaskDateLabel,
  formatTaskStatus,
  formatTaskPriority,
  compareTasks,
  isTaskDueToday,
  isTaskOverdue,
  countWords,
  applicationSupportsResource,
  readResourceExtension,
  runResourceAction,
  readStringAttribute,
  readBooleanAttribute,
  readNumberAttribute,
} from "../resources/resource-utils";
import {
  applyDesktopPreferences,
  DEFAULT_DESKTOP_PREFERENCES,
  readDesktopPreferences,
  sidebarWidthValue,
  type DesktopAccentColor,
  type DesktopPreferences,
  type DesktopSidebarWidth,
  type DesktopThemeMode,
} from "./shared/desktop-preferences";
import { FloatingApplicationDock } from "./shared/floating-application-dock";
import {
  ExplainMyWorkspaceButton,
  ExplainThisButton,
  ProgressiveDiscoveryButton,
  ProgressiveUnderstandingLayer,
  WorkspaceIntelligenceCard,
} from "./progressive-understanding";

function basenameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : value;
}

function displayResourceTitle(resource: ResourceSnapshot): string {
  const sourcePath = readStringAttribute(resource, "contentSourcePath");
  if (sourcePath) return basenameFromPath(sourcePath);
  if (
    (resource.metadata.kind === "content" || resource.metadata.kind === "folder") &&
    /[/\\]/.test(resource.metadata.title)
  ) {
    return basenameFromPath(resource.metadata.title);
  }
  return resource.metadata.title;
}

function isPinnedWorkspaceResource(resource: ResourceSnapshot): boolean {
  return (
    isTaskPinned(resource) ||
    isBookmarkPinned(resource) ||
    readBooleanAttribute(resource, "resourcePinned") === true ||
    resource.tags.includes("pinned")
  );
}

function displayKaryaObjectTitle(object: ResourceSnapshot | EventSnapshot): string {
  return "eventType" in object ? object.metadata.title : displayResourceTitle(object);
}

export function ShellScreen(): ReactElement {
  const shell = useShellController();
  const [searchOpen, setSearchOpen] = useState(false);
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [createProfileOpen, setCreateProfileOpen] = useState(false);
  const [createWorkspaceProfileId, setCreateWorkspaceProfileId] = useState<string | undefined>();
  const [renameProfile, setRenameProfile] = useState<KernelSnapshot["profiles"]["all"][number] | undefined>();
  const [renameWorkspace, setRenameWorkspace] = useState<KernelSnapshot["workspaces"]["all"][number] | undefined>();
  const [renameResource, setRenameResource] = useState<ResourceSnapshot | undefined>();
  const [moveResource, setMoveResource] = useState<ResourceSnapshot | undefined>();
  const [referenceResource, setReferenceResource] = useState<ResourceSnapshot | undefined>();
  const [propertiesResource, setPropertiesResource] = useState<ResourceSnapshot | undefined>();
  const [propertiesApplication, setPropertiesApplication] = useState<ApplicationSnapshot | undefined>();
  const [openWithResource, setOpenWithResource] = useState<ResourceSnapshot | undefined>();
  const [addApplicationWorkspace, setAddApplicationWorkspace] = useState<
    KernelSnapshot["workspaces"]["all"][number] | undefined
  >();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceDashboardId, setWorkspaceDashboardId] = useState<string | undefined>();
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | undefined>();
  const [dismissedInterruptedSessionId, setDismissedInterruptedSessionId] = useState<string | undefined>();
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopPreferences>(() => readDesktopPreferences());
  const editableNote = isEditableNativeNote(shell.selectedResource) ? shell.selectedResource : undefined;
  const editableTask = isTaskResource(shell.selectedResource) ? shell.selectedResource : undefined;

  const runPlacement = async (operation: PlacementOperation, mode: ImportMode, destination?: ImportDestination) => {
    if (operation !== "link") return;
    if (mode === "file") {
      await shell.linkFile(destination);
      return;
    }
    await shell.linkDirectory(destination);
  };

  const requestPlacement = async (operation: PlacementOperation, mode: ImportMode) => {
    const activeSurface = shell.activeSurface;
    if (activeSurface.type === "workspace") {
      const workspace = shell.snapshot?.workspaces.all.find((item) => item.id === activeSurface.workspaceId);
      await runPlacement(operation, mode, {
        profileId: workspace?.profileId,
        workspaceId: activeSurface.workspaceId,
        defaultSpace:
          workspace &&
          workspace.id ===
            shell.snapshot?.profiles.all.find((profile) => profile.id === workspace.profileId)?.defaultSpaceId
            ? "profile"
            : "none",
      });
      return;
    }

    setPendingPlacement({ operation, mode });
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void shell.boot().then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [shell.boot]);

  useEffect(() => {
    applyDesktopPreferences(desktopPreferences);
    if (desktopPreferences.appearance.theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDesktopPreferences(desktopPreferences);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [desktopPreferences]);

  useEffect(() => {
    return window.karyaShell?.subscribeNativeCommands?.((command) => {
      if (command === NATIVE_COMMANDS.openSettings) {
        setSettingsOpen(true);
      }
      if (command === NATIVE_COMMANDS.openSearch) {
        setSearchOpen(true);
      }
      if (command === NATIVE_COMMANDS.openKeyboardShortcuts) {
        setSettingsOpen(true);
      }
      if (command === NATIVE_COMMANDS.createWorkspace) {
        const profileId = currentSurfaceProfileId(shell.snapshot, shell.activeSurface, shell.activeProfile?.id);
        if (profileId) setCreateWorkspaceProfileId(profileId);
      }
    });
  }, [shell.activeProfile?.id, shell.activeSurface, shell.snapshot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        void shell.createNote();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const resource = shell.selectedResource;
      if (!resource) return;

      if (event.key === "F2") {
        event.preventDefault();
        setRenameResource(resource);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        void shell.deleteResource(resource.id);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "d") {
        event.preventDefault();
        void shell.duplicateResource(resource.id);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "i") {
        event.preventDefault();
        setPropertiesResource(resource);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void shell.openResource(resource.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shell]);

  const handleResourceContextMenu = async (event: MouseEvent, resource: ResourceSnapshot) => {
    event.preventDefault();
    await shell.selectResource(resource.id);
    const referencedFolder = isFolderResource(resource) && isReferencedResource(resource);
    const codeApplication = shell.snapshot?.applications.installed.find((application) => {
      const identity = `${application.metadata.id} ${application.metadata.name}`.toLocaleLowerCase();
      return VISUAL_STUDIO_CODE_IDENTIFIERS.some((identifier) => identity.includes(identifier));
    });
    const action = await window.karyaShell?.showResourceContextMenu?.({
      id: resource.id,
      title: displayResourceTitle(resource),
      archived: resource.lifecycleState === "archived",
      hasLocation: typeof resource.metadata.attributes?.contentSourcePath === "string",
      referencedFolder,
      canOpenInCode: Boolean(codeApplication),
    });
    if (!action) return;
    if (action === "open-with") {
      setOpenWithResource(resource);
      return;
    }
    if (action === "open-in-code") {
      if (codeApplication) {
        await shell.openResourceWithApplication(
          resource.id,
          codeApplication.metadata.id,
          currentSurfaceWorkspaceId(shell.snapshot, shell.activeSurface),
        );
      }
      return;
    }
    if (action === "copy-path") {
      await shell.copyResourcePath(resource.id);
      return;
    }
    if (action === "remove-reference") {
      await shell.deleteResource(resource.id);
      return;
    }
    if (action === "show-metadata") {
      setPropertiesResource(resource);
      return;
    }
    await runResourceAction(action, resource, {
      archive: shell.archiveResource,
      delete: shell.deleteResource,
      duplicate: shell.duplicateResource,
      addToWorkspace: setReferenceResource,
      move: setMoveResource,
      open: isFolderResource(resource) ? shell.openFolderResource : shell.openResource,
      properties: setPropertiesResource,
      rename: setRenameResource,
      restore: shell.restoreResource,
      reveal: shell.revealResource,
    });
  };

  const handleApplicationContextMenu = async (event: MouseEvent, application: ApplicationSnapshot) => {
    event.preventDefault();
    const activeWorkspaceId = currentSurfaceWorkspaceId(shell.snapshot, shell.activeSurface);
    const preferred = Boolean(
      activeWorkspaceId &&
      shell.snapshot?.applications.preferredByWorkspace[activeWorkspaceId]?.includes(application.metadata.id),
    );
    const action = await window.karyaShell?.showApplicationContextMenu?.({
      id: application.metadata.id,
      name: application.metadata.name,
      pinned: application.pinned,
      favorite: application.favorite,
      preferred,
      hasActiveWorkspace: Boolean(activeWorkspaceId),
    });
    if (!action) return;
    if (action === "launch") {
      const activeWorkspace = activeWorkspaceId
        ? shell.snapshot?.workspaces.all.find((workspace) => workspace.id === activeWorkspaceId)
        : undefined;
      await shell.launchApplication(application.metadata.id, {
        workspaceId: activeWorkspaceId,
        profileId: activeWorkspace?.profileId ?? shell.activeProfile?.id,
      });
    }
    if (action === "open-workspace" && activeWorkspaceId) await shell.activateWorkspace(activeWorkspaceId);
    if (action === "pin") await shell.pinApplication(application.metadata.id);
    if (action === "unpin") await shell.unpinApplication(application.metadata.id);
    if (action === "favorite") await shell.favoriteApplication(application.metadata.id);
    if (action === "unfavorite") await shell.unfavoriteApplication(application.metadata.id);
    if (action === "set-preferred" && activeWorkspaceId)
      await shell.setWorkspacePreferredApplication(activeWorkspaceId, application.metadata.id, true);
    if ((action === "unset-preferred" || action === "remove-from-workspace") && activeWorkspaceId)
      await shell.setWorkspacePreferredApplication(activeWorkspaceId, application.metadata.id, false);
    if (action === "properties") setPropertiesApplication(application);
  };

  return (
    <main className="karya-shell relative grid h-full min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[var(--karya-sidebar-width)_minmax(0,1fr)] 2xl:grid-cols-[var(--karya-sidebar-width)_minmax(0,1fr)_minmax(300px,360px)]">
      <Sidebar
        applications={shell.applications}
        activeSurface={shell.activeSurface}
        activeProfileId={currentSurfaceProfileId(shell.snapshot, shell.activeSurface, shell.activeProfile?.id)}
        activeWorkspaceId={currentSurfaceWorkspaceId(shell.snapshot, shell.activeSurface)}
        snapshot={shell.snapshot}
        onArchiveProfile={shell.archiveProfile}
        onArchiveWorkspace={shell.archiveWorkspace}
        onCreateWorkspace={setCreateWorkspaceProfileId}
        onDeleteProfile={shell.deleteProfile}
        onDeleteWorkspace={shell.deleteWorkspace}
        onCreateProfile={() => setCreateProfileOpen(true)}
        onNavigateHome={shell.openHomeSurface}
        onOpenProfile={shell.openProfile}
        onOpenWorkspace={async (workspaceId) => {
          setWorkspaceDashboardId(undefined);
          await shell.activateWorkspace(workspaceId);
        }}
        onOpenWorkspaceProperties={async (workspaceId) => {
          setWorkspaceDashboardId(workspaceId);
          await shell.activateWorkspace(workspaceId);
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onRenameProfile={setRenameProfile}
        onRenameWorkspace={setRenameWorkspace}
        onRestoreProfile={shell.restoreProfile}
        onRestoreWorkspace={shell.restoreWorkspace}
        onPinWorkspace={shell.pinWorkspace}
        onViewProfile={shell.viewProfile}
        onApplicationContextMenu={handleApplicationContextMenu}
        onLaunchApplication={shell.launchApplication}
      />
      <header className="karya-app-chrome relative z-40 flex min-w-0 flex-wrap items-center gap-3 border-b px-3 py-3 md:col-start-2 lg:px-4 2xl:col-span-2 2xl:flex-nowrap 2xl:px-6">
        <GlobalSearchTrigger
          searchTerm={shell.searchTerm}
          resultCount={shell.searchResults.length}
          onOpen={() => setSearchOpen(true)}
        />
        <StatusIndicators
          isReady={shell.isReady}
          workspaceName={currentSurfaceName(shell.snapshot, shell.activeSurface, shell.activeWorkspace)}
        />
        <AddResourceMenu
          open={addResourceOpen}
          onOpenChange={setAddResourceOpen}
          onPlacement={(operation, mode) => void requestPlacement(operation, mode)}
        />
        <ProgressiveDiscoveryButton />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative"
          onClick={() => setNotificationsOpen(true)}
        >
          <Bell className="h-5 w-5" />
          {shell.snapshot?.notifications.unreadCount ? (
            <span className="absolute -mr-5 -mt-5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-semibold text-white">
              {shell.snapshot.notifications.unreadCount}
            </span>
          ) : null}
        </Button>
        <Button size="sm" onClick={() => void shell.createNote()}>
          <Plus className="h-4 w-4" />
          Quick capture
        </Button>
      </header>
      <section className="min-w-0 overflow-hidden p-2 md:col-start-2 lg:p-3 2xl:p-4">
        {editableNote ? (
          <NativeNoteEditor
            key={editableNote.id}
            note={editableNote}
            snapshot={shell.snapshot}
            onArchive={shell.archiveResource}
            onClose={() => void shell.selectResource(undefined)}
            onRename={setRenameResource}
            onUpdateContent={shell.updateNoteContent}
          />
        ) : (
          <HomeSurface
            activeSurface={shell.activeSurface}
            breadcrumbs={shell.breadcrumbs}
            profileState={shell.snapshot?.profiles}
            resources={shell.resources}
            selectedResourceId={shell.selectedResource?.id}
            snapshot={shell.snapshot}
            workspaceDashboardId={workspaceDashboardId}
            workspaceName={currentSurfaceName(shell.snapshot, shell.activeSurface, shell.activeWorkspace) ?? "Home"}
            onArchiveProfile={shell.archiveProfile}
            onArchiveCalendarEvent={shell.archiveCalendarEvent}
            onArchiveResource={shell.archiveResource}
            onArchiveWorkspace={shell.archiveWorkspace}
            onCreateResource={shell.createResource}
            onCreateNote={shell.createNote}
            onCreateTask={shell.createTask}
            onCreateBookmark={shell.createBookmark}
            onCreateCalendarEvent={shell.createCalendarEvent}
            onCreateRelationship={shell.createRelationship}
            onCompleteTask={shell.completeTask}
            onCreateProfile={() => setCreateProfileOpen(true)}
            onDeleteProfile={shell.deleteProfile}
            onDeleteCalendarEvent={shell.deleteCalendarEvent}
            onDeleteResource={shell.deleteResource}
            onDeleteWorkspace={shell.deleteWorkspace}
            onDuplicateWorkspace={shell.duplicateWorkspace}
            onAddWorkspaceApplication={setAddApplicationWorkspace}
            onNavigateHome={shell.openHomeSurface}
            onOpenFolder={shell.openFolderResource}
            onLaunchApplication={shell.launchApplication}
            onApplicationContextMenu={handleApplicationContextMenu}
            onMoveResource={setMoveResource}
            onOpenProfile={shell.openProfile}
            onOpenResource={shell.openResource}
            onReferenceFile={() => requestPlacement("link", "file")}
            onReferenceFolder={() => requestPlacement("link", "directory")}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenWorkspace={async (workspaceId) => {
              setWorkspaceDashboardId(undefined);
              await shell.activateWorkspace(workspaceId);
            }}
            onDismissInterruptedSession={() =>
              setDismissedInterruptedSessionId(shell.snapshot?.continuity.interruptedSession?.workspaceId)
            }
            dismissedInterruptedSessionId={dismissedInterruptedSessionId}
            onOpenWorkspaceDashboard={setWorkspaceDashboardId}
            onPinWorkspace={shell.pinWorkspace}
            onRenameProfile={setRenameProfile}
            onRenameWorkspace={setRenameWorkspace}
            onResumeWorkspace={shell.resumeWorkspace}
            onResumeResource={shell.resumeResource}
            onReopenTask={shell.reopenTask}
            onRestoreProfile={shell.restoreProfile}
            onRestoreWorkspace={shell.restoreWorkspace}
            onResourceContextMenu={handleResourceContextMenu}
            onRemoveRelationship={shell.removeRelationship}
            onSelectResource={shell.selectResource}
            onUpdateWorkspaceLaunchSet={shell.updateWorkspaceLaunchSet}
            onUpdateWorkspaceSettings={shell.updateWorkspaceSettings}
            onUpdateTask={shell.updateTask}
            onUpdateBookmark={shell.updateBookmark}
            onUpdateCalendarEvent={shell.updateCalendarEvent}
          />
        )}
      </section>
      {editableTask ? (
        <TaskDetailPanel
          task={editableTask}
          onArchive={shell.archiveResource}
          onClose={() => void shell.selectResource(undefined)}
          onComplete={shell.completeTask}
          onCreateRelationship={shell.createRelationship}
          onDelete={shell.deleteResource}
          onNavigateRelationship={(target) => {
            if (target.type === "resource") void shell.selectResource(target.id);
          }}
          onRemoveRelationship={shell.removeRelationship}
          onReopen={shell.reopenTask}
          snapshot={shell.snapshot}
          onUpdateTask={shell.updateTask}
        />
      ) : (
        <ResourceInspector
          resource={shell.selectedResource}
          workspace={
            shell.snapshot && !shell.selectedResource
              ? shell.snapshot.workspaces.all.find(
                  (workspace) => workspace.id === currentSurfaceWorkspaceId(shell.snapshot, shell.activeSurface),
                )
              : undefined
          }
          onArchive={shell.archiveResource}
          onCheckHealth={shell.checkResourceHealth}
          onCopyPath={shell.copyResourcePath}
          onCreateRelationship={shell.createRelationship}
          onDelete={shell.deleteResource}
          onDuplicate={shell.duplicateResource}
          onMove={(resource) => setMoveResource(resource)}
          onOpen={shell.openResource}
          onOpenContainingFolder={shell.openContainingFolder}
          onOpenProfile={shell.openProfile}
          onProperties={(resource) => setPropertiesResource(resource)}
          onRename={(resource) => setRenameResource(resource)}
          onRemoveRelationship={shell.removeRelationship}
          onReveal={shell.revealResource}
          onRestore={shell.restoreResource}
          profiles={shell.snapshot?.profiles.all ?? []}
          snapshot={shell.snapshot}
        />
      )}
      <FloatingApplicationDock
        activeWorkspaceId={currentSurfaceWorkspaceId(shell.snapshot, shell.activeSurface)}
        snapshot={shell.snapshot}
        onLaunchApplication={shell.launchApplication}
      />
      <UniversalSearchOverlay
        isOpen={searchOpen}
        snapshot={shell.snapshot}
        onClose={() => setSearchOpen(false)}
        onExecute={shell.executeSearchResult}
        onSearch={shell.search}
      />
      {settingsOpen && shell.snapshot ? (
        <SettingsApplication
          preferences={desktopPreferences}
          snapshot={shell.snapshot}
          onClose={() => setSettingsOpen(false)}
          onPreferencesChange={setDesktopPreferences}
          onResumeWorkspace={shell.resumeWorkspace}
          onUpdateWorkspaceLaunchSet={shell.updateWorkspaceLaunchSet}
        />
      ) : null}
      {notificationsOpen && shell.snapshot ? (
        <NotificationCenter
          snapshot={shell.snapshot}
          onArchive={shell.archiveNotification}
          onClose={() => setNotificationsOpen(false)}
          onDelete={shell.deleteNotification}
          onMarkRead={shell.markNotificationRead}
          onCompleteTask={shell.completeTask}
          onOpenResource={(resourceId) => {
            setNotificationsOpen(false);
            void shell.selectResource(resourceId);
          }}
          onOpenWorkspace={(workspaceId) => {
            setNotificationsOpen(false);
            void shell.activateWorkspace(workspaceId);
          }}
        />
      ) : null}
      {renameProfile ? (
        <RenameProfileDialog
          profile={renameProfile}
          onClose={() => setRenameProfile(undefined)}
          onRename={async (name) => {
            await shell.renameProfile(renameProfile.id, name);
            setRenameProfile(undefined);
          }}
        />
      ) : null}
      {createProfileOpen ? (
        <CreateNamedEntityDialog
          entityLabel="Profile"
          maxLength={PROFILE_NAME_MAX_LENGTH}
          placeholder={PROFILE_NAME_PLACEHOLDER}
          onClose={() => setCreateProfileOpen(false)}
          onCreate={async (name) => {
            await shell.createProfile(name);
            setCreateProfileOpen(false);
          }}
        />
      ) : null}
      {createWorkspaceProfileId ? (
        <CreateNamedEntityDialog
          entityLabel="Workspace"
          maxLength={WORKSPACE_NAME_MAX_LENGTH}
          placeholder={WORKSPACE_NAME_PLACEHOLDER}
          onClose={() => setCreateWorkspaceProfileId(undefined)}
          onCreate={async (name) => {
            await shell.createWorkspaceForProfile(createWorkspaceProfileId, name);
            setCreateWorkspaceProfileId(undefined);
          }}
        />
      ) : null}
      {renameWorkspace ? (
        <RenameWorkspaceDialog
          workspace={renameWorkspace}
          onClose={() => setRenameWorkspace(undefined)}
          onRename={async (name) => {
            await shell.renameWorkspace(renameWorkspace.id, name);
            setRenameWorkspace(undefined);
          }}
        />
      ) : null}
      {renameResource ? (
        <RenameResourceDialog
          resource={renameResource}
          onClose={() => setRenameResource(undefined)}
          onRename={async (title) => {
            await shell.renameResource(renameResource.id, title);
            setRenameResource(undefined);
          }}
        />
      ) : null}
      {moveResource && shell.snapshot ? (
        <MoveResourceDialog
          resource={moveResource}
          snapshot={shell.snapshot}
          onClose={() => setMoveResource(undefined)}
          onMove={async (destination) => {
            await shell.moveResource(moveResource.id, destination);
            setMoveResource(undefined);
          }}
        />
      ) : null}
      {referenceResource && shell.snapshot ? (
        <AddResourceReferenceDialog
          resource={referenceResource}
          snapshot={shell.snapshot}
          onClose={() => setReferenceResource(undefined)}
          onAdd={async (workspaceId) => {
            await shell.addWorkspaceReference(referenceResource.id, workspaceId);
            setReferenceResource(undefined);
          }}
        />
      ) : null}
      {propertiesResource ? (
        <ResourcePropertiesDialog
          resource={propertiesResource}
          snapshot={shell.snapshot}
          onClose={() => setPropertiesResource(undefined)}
        />
      ) : null}
      {propertiesApplication ? (
        <ApplicationPropertiesDialog
          application={propertiesApplication}
          snapshot={shell.snapshot}
          onClose={() => setPropertiesApplication(undefined)}
        />
      ) : null}
      {openWithResource && shell.snapshot ? (
        <OpenWithDialog
          resource={openWithResource}
          snapshot={shell.snapshot}
          onClose={() => setOpenWithResource(undefined)}
          onOpen={async (applicationId, makePreferred) => {
            const workspaceId = openWithResource.primaryWorkspaceId ?? openWithResource.workspaceRefs[0];
            if (makePreferred && workspaceId) {
              await shell.setWorkspacePreferredApplication(workspaceId, applicationId, true);
            }
            await shell.openResourceWithApplication(openWithResource.id, applicationId, workspaceId);
            setOpenWithResource(undefined);
          }}
        />
      ) : null}
      {addApplicationWorkspace && shell.snapshot ? (
        <AddWorkspaceApplicationDialog
          workspace={
            shell.snapshot.workspaces.all.find((workspace) => workspace.id === addApplicationWorkspace.id) ??
            addApplicationWorkspace
          }
          snapshot={shell.snapshot}
          onClose={() => setAddApplicationWorkspace(undefined)}
          onAdd={async (applicationId, includeInLaunchSet) => {
            await shell.addWorkspaceApplication(addApplicationWorkspace.id, applicationId, includeInLaunchSet);
            setAddApplicationWorkspace(undefined);
          }}
        />
      ) : null}
      {pendingPlacement && shell.snapshot ? (
        <ImportDestinationDialog
          activeSurface={shell.activeSurface}
          mode={pendingPlacement.mode}
          operation={pendingPlacement.operation}
          snapshot={shell.snapshot}
          onClose={() => setPendingPlacement(undefined)}
          onImport={async (destination) => {
            await runPlacement(pendingPlacement.operation, pendingPlacement.mode, destination);
            setPendingPlacement(undefined);
          }}
        />
      ) : null}
      <ProgressiveUnderstandingLayer />
    </main>
  );
}

interface SidebarProps {
  applications: ApplicationSnapshot[];
  activeSurface: KernelSnapshot["shell"]["activeSurface"];
  activeProfileId?: string;
  activeWorkspaceId?: string;
  snapshot?: KernelSnapshot;
  onArchiveProfile(profileId: string): void;
  onArchiveWorkspace(workspaceId: string): void;
  onCreateProfile(): void;
  onCreateWorkspace(profileId: string): void;
  onDeleteProfile(profileId: string): void;
  onDeleteWorkspace(workspaceId: string): void;
  onNavigateHome(): void;
  onOpenProfile(profileId: string): void;
  onOpenSettings(): void;
  onOpenWorkspace(workspaceId: string): void;
  onOpenWorkspaceProperties(workspaceId: string): void;
  onPinWorkspace(workspaceId: string, pinned: boolean): void;
  onRenameProfile(profile: KernelSnapshot["profiles"]["all"][number]): void;
  onRenameWorkspace(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onRestoreProfile(profileId: string): void;
  onRestoreWorkspace(workspaceId: string): void;
  onViewProfile(profileId: string): void;
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
}

function Sidebar({
  activeSurface,
  activeProfileId,
  activeWorkspaceId,
  applications,
  onArchiveProfile,
  onArchiveWorkspace,
  onCreateProfile,
  onCreateWorkspace,
  onDeleteProfile,
  onDeleteWorkspace,
  onNavigateHome,
  onOpenProfile,
  onOpenSettings,
  onOpenWorkspace,
  onOpenWorkspaceProperties,
  onPinWorkspace,
  onRenameProfile,
  onRenameWorkspace,
  onRestoreProfile,
  onRestoreWorkspace,
  onViewProfile,
  onApplicationContextMenu,
  onLaunchApplication,
  snapshot,
}: SidebarProps): ReactElement {
  const profiles = snapshot?.profiles.all ?? [];
  const visibleProfiles = profiles.filter((profile) => (profile.lifecycleState ?? "active") === "active");
  const archivedProfiles = profiles.filter((profile) => profile.lifecycleState === "archived");
  const desktopDefaultSpace = snapshot?.workspaces.all.find(
    (workspace) => workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID && workspace.lifecycleState !== "deleted",
  );
  const currentProfile = activeProfileId
    ? visibleProfiles.find((profile) => profile.id === activeProfileId)
    : undefined;
  const currentProfileWorkspaces = currentProfile
    ? (snapshot?.profiles.workspaceIdsByProfile[currentProfile.id] ?? [])
        .map((workspaceId) => snapshot?.workspaces.all.find((workspace) => workspace.id === workspaceId))
        .filter((workspace): workspace is KernelSnapshot["workspaces"]["all"][number] => Boolean(workspace))
        .filter((workspace) => workspace.id !== DESKTOP_HOME_DEFAULT_SPACE_ID)
        .filter((workspace) => workspace.lifecycleState !== "deleted")
    : [];
  const defaultSpace = currentProfileWorkspaces.find((workspace) => workspace.id === currentProfile?.defaultSpaceId);
  const workspaces = currentProfileWorkspaces.filter(
    (workspace) => workspace.id !== currentProfile?.defaultSpaceId && workspace.lifecycleState !== "archived",
  );
  const archivedWorkspaces = currentProfileWorkspaces.filter((workspace) => workspace.lifecycleState === "archived");

  const handleContextMenu = async (event: MouseEvent, profile: KernelSnapshot["profiles"]["all"][number]) => {
    event.preventDefault();
    const action = await window.karyaShell?.showProfileContextMenu?.({
      id: profile.id,
      name: profile.name,
      archived: profile.lifecycleState === "archived",
    });
    if (!action) return;

    switch (action) {
      case "open":
      case "set-active":
        if (profile.lifecycleState === "archived") {
          onViewProfile(profile.id);
        } else {
          onOpenProfile(profile.id);
        }
        return;
      case "rename":
        onRenameProfile(profile);
        return;
      case "properties":
        if (profile.lifecycleState === "archived") {
          onViewProfile(profile.id);
        } else {
          onOpenProfile(profile.id);
        }
        return;
      case "create-workspace":
        onCreateWorkspace(profile.id);
        return;
      case "archive":
        onArchiveProfile(profile.id);
        return;
      case "restore":
        onRestoreProfile(profile.id);
        return;
      case "delete":
        if (window.confirm(`Delete ${profile.name} permanently?`)) {
          onDeleteProfile(profile.id);
        }
        return;
    }
  };

  return (
    <aside className="karya-sidebar row-span-2 m-2 mr-0 hidden min-w-0 flex-col rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] px-3 py-3 shadow-[var(--karya-shadow-panel)] backdrop-blur-2xl md:flex">
      <div className="mb-4 flex items-center gap-3 px-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--karya-surface-strong)] text-[var(--karya-text)] shadow-[var(--karya-shadow-button)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="karya-sidebar-text min-w-0">
          <p className="truncate text-sm font-semibold">Karya</p>
          <p className="truncate text-xs text-[var(--karya-subtle)]">Desktop Shell</p>
        </div>
      </div>

      {currentProfile ? (
        <div className="karya-sidebar-profile-card mb-3 rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--karya-surface-strong)] text-xs font-semibold text-[var(--karya-text)]">
              {currentProfile.name.slice(0, 2).toLocaleUpperCase()}
            </div>
            <div className="karya-sidebar-text min-w-0">
              <p className="truncate text-sm font-semibold">{currentProfile.name}</p>
              <p className="truncate text-xs text-[var(--karya-subtle)]">Profile</p>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="karya-sidebar-nav space-y-4 overflow-y-auto pr-1">
        <SidebarSection label="Operating System">
          <SidebarNavButton
            active={activeSurface.type === "home"}
            icon={<Home className="h-4 w-4" />}
            label="Home"
            onClick={onNavigateHome}
          />
        </SidebarSection>

        {desktopDefaultSpace ? (
          <SidebarSection label="Default Space">
            <WorkspaceSidebarButton
              defaultSpace
              active={activeWorkspaceId === desktopDefaultSpace.id && activeSurface.type === "workspace"}
              resourceCount={snapshot?.workspaces.resourceCountByWorkspace[desktopDefaultSpace.id] ?? 0}
              workspace={desktopDefaultSpace}
              onArchive={onArchiveWorkspace}
              onDelete={onDeleteWorkspace}
              onOpen={onOpenWorkspace}
              onOpenProperties={onOpenWorkspaceProperties}
              onPin={onPinWorkspace}
              onRename={onRenameWorkspace}
              onRestore={onRestoreWorkspace}
            />
          </SidebarSection>
        ) : null}

        <SidebarSection
          label="Profiles"
          action={
            <Button variant="ghost" size="icon" aria-label="Create profile" onClick={onCreateProfile}>
              <Plus className="h-4 w-4" />
            </Button>
          }
        >
          {visibleProfiles.map((profile) => (
            <ProfileSidebarButton
              key={profile.id}
              active={profile.id === activeProfileId}
              profile={profile}
              onClick={() => onOpenProfile(profile.id)}
              onContextMenu={(event) => handleContextMenu(event, profile)}
            />
          ))}
        </SidebarSection>

        {currentProfile ? (
          <SidebarSection
            label={`Work Contexts / ${currentProfile.name}`}
            action={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Create workspace"
                onClick={() => onCreateWorkspace(currentProfile.id)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            }
          >
            {defaultSpace ? (
              <WorkspaceSidebarButton
                defaultSpace
                active={activeWorkspaceId === defaultSpace.id && activeSurface.type === "workspace"}
                resourceCount={snapshot?.workspaces.resourceCountByWorkspace[defaultSpace.id] ?? 0}
                workspace={defaultSpace}
                onArchive={onArchiveWorkspace}
                onDelete={onDeleteWorkspace}
                onOpen={onOpenWorkspace}
                onOpenProperties={onOpenWorkspaceProperties}
                onPin={onPinWorkspace}
                onRename={onRenameWorkspace}
                onRestore={onRestoreWorkspace}
              />
            ) : null}
            {workspaces.map((workspace) => (
              <WorkspaceSidebarButton
                key={workspace.id}
                active={activeWorkspaceId === workspace.id && activeSurface.type === "workspace"}
                resourceCount={snapshot?.workspaces.resourceCountByWorkspace[workspace.id] ?? 0}
                workspace={workspace}
                onArchive={onArchiveWorkspace}
                onDelete={onDeleteWorkspace}
                onOpen={onOpenWorkspace}
                onOpenProperties={onOpenWorkspaceProperties}
                onPin={onPinWorkspace}
                onRename={onRenameWorkspace}
                onRestore={onRestoreWorkspace}
              />
            ))}
            {workspaces.length === 0 ? (
              <p className="karya-sidebar-empty rounded-lg border border-dashed border-[var(--karya-border)] px-3 py-2 text-xs text-[var(--karya-muted)]">
                No focused Workspaces yet.
              </p>
            ) : null}
            {archivedWorkspaces.length ? (
              <div className="pt-2">
                <p className="karya-sidebar-section-label mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--karya-subtle)]">
                  Archived Workspaces
                </p>
                <div className="space-y-1">
                  {archivedWorkspaces.map((workspace) => (
                    <WorkspaceSidebarButton
                      key={workspace.id}
                      archived
                      active={false}
                      resourceCount={snapshot?.workspaces.resourceCountByWorkspace[workspace.id] ?? 0}
                      workspace={workspace}
                      onArchive={onArchiveWorkspace}
                      onDelete={onDeleteWorkspace}
                      onOpen={onOpenWorkspace}
                      onOpenProperties={onOpenWorkspaceProperties}
                      onPin={onPinWorkspace}
                      onRename={onRenameWorkspace}
                      onRestore={onRestoreWorkspace}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </SidebarSection>
        ) : null}

        {applications.length ? (
          <SidebarSection label="Pinned Applications">
            {applications.map((application) => (
              <SidebarNavButton
                key={application.metadata.id}
                icon={<Layers3 className="h-4 w-4" />}
                label={application.metadata.name}
                onClick={() => onLaunchApplication(application.metadata.id)}
                onContextMenu={(event) => onApplicationContextMenu(event, application)}
              />
            ))}
          </SidebarSection>
        ) : null}

        {archivedProfiles.length ? (
          <SidebarSection label="Archived Profiles">
            {archivedProfiles.map((profile) => (
              <ProfileSidebarButton
                key={profile.id}
                archived
                active={false}
                profile={profile}
                onClick={() => onViewProfile(profile.id)}
                onContextMenu={(event) => handleContextMenu(event, profile)}
              />
            ))}
          </SidebarSection>
        ) : null}
      </nav>

      <div className="karya-sidebar-footer mt-auto border-t border-[var(--karya-border)] pt-3">
        <SidebarNavButton icon={<Settings className="h-4 w-4" />} label="Settings" onClick={onOpenSettings} />
      </div>
    </aside>
  );
}

function SidebarSection({
  action,
  children,
  label,
}: {
  action?: ReactElement;
  children: ReactNode;
  label: string;
}): ReactElement {
  return (
    <section className="karya-sidebar-section">
      <div className="karya-sidebar-section-header mb-2 flex items-center justify-between gap-2 px-1">
        <p className="karya-sidebar-section-label truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--karya-subtle)]">
          {label}
        </p>
        {action ? <span className="karya-sidebar-section-action">{action}</span> : null}
      </div>
      <div className="karya-sidebar-section-content space-y-1">{children}</div>
    </section>
  );
}

function SidebarNavButton({
  active = false,
  icon,
  label,
  onClick,
  onContextMenu,
}: {
  active?: boolean;
  icon: ReactElement;
  label: string;
  onClick?(): void;
  onContextMenu?(event: MouseEvent): void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "karya-sidebar-button karya-nav-item flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm",
        active ? "karya-nav-item-active" : undefined,
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="karya-sidebar-icon shrink-0">{icon}</span>
      <span className="karya-sidebar-text min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function ProfileSidebarButton({
  active,
  archived = false,
  onClick,
  onContextMenu,
  profile,
}: {
  active: boolean;
  archived?: boolean;
  onClick(): void;
  onContextMenu(event: MouseEvent): void;
  profile: { id: string; name: string; accentColor?: string };
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={archived ? `${profile.name} archived` : profile.name}
      title={archived ? `${profile.name} archived` : profile.name}
      className={cn(
        "karya-sidebar-button karya-nav-item flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm",
        active ? "karya-nav-item-active" : undefined,
        archived ? "opacity-55" : undefined,
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span
        className="karya-sidebar-icon relative flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold text-white shadow-[var(--karya-shadow-button)]"
        style={{ backgroundColor: profile.accentColor ?? "#2dd4bf" }}
      >
        {profile.name.slice(0, 1).toUpperCase()}
        {archived ? (
          <Archive className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[var(--karya-surface)] text-[var(--karya-muted)]" />
        ) : null}
      </span>
      <span className="karya-sidebar-text min-w-0 flex-1 truncate">{profile.name}</span>
    </button>
  );
}

function WorkspaceSidebarButton({
  active,
  archived = false,
  defaultSpace = false,
  onArchive,
  onDelete,
  onOpen,
  onOpenProperties,
  onPin,
  onRename,
  onRestore,
  resourceCount,
  workspace,
}: {
  active: boolean;
  archived?: boolean;
  defaultSpace?: boolean;
  onArchive(workspaceId: string): void;
  onDelete(workspaceId: string): void;
  onOpen(workspaceId: string): void;
  onOpenProperties(workspaceId: string): void;
  onPin(workspaceId: string, pinned: boolean): void;
  onRename(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onRestore(workspaceId: string): void;
  resourceCount: number;
  workspace: KernelSnapshot["workspaces"]["all"][number];
}): ReactElement {
  return (
    <div
      className={cn(
        "karya-sidebar-workspace karya-nav-item group flex items-center gap-2 rounded-lg px-2 py-1.5",
        active ? "karya-nav-item-active" : undefined,
        archived ? "opacity-55" : undefined,
      )}
      title={archived ? `${workspace.name} archived` : workspace.name}
    >
      <button
        type="button"
        aria-label={archived ? `${workspace.name} archived` : workspace.name}
        disabled={archived}
        className="karya-sidebar-workspace-button flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
        onClick={() => onOpen(workspace.id)}
      >
        <span className="karya-sidebar-icon shrink-0">
          {defaultSpace ? <Inbox className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
        </span>
        <span className="karya-sidebar-text min-w-0 flex-1 truncate text-sm">{workspace.name}</span>
        <span
          className={cn(
            "karya-sidebar-count text-xs",
            active ? "text-[var(--karya-accent)]" : "text-[var(--karya-subtle)]",
          )}
        >
          {resourceCount}
        </span>
      </button>
      {workspace.pinned ? <Pin className="karya-sidebar-pin h-3.5 w-3.5 shrink-0 text-[var(--karya-warning)]" /> : null}
      <div className="karya-sidebar-actions hidden shrink-0 items-center gap-1 group-hover:flex">
        {archived ? (
          <button type="button" aria-label="Restore workspace" onClick={() => onRestore(workspace.id)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <button type="button" aria-label="Rename workspace" onClick={() => onRename(workspace)}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Workspace properties" onClick={() => onOpenProperties(workspace.id)}>
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={workspace.pinned ? "Unpin workspace" : "Pin workspace"}
              onClick={() => onPin(workspace.id, !workspace.pinned)}
            >
              {workspace.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            {!defaultSpace ? (
              <button type="button" aria-label="Archive workspace" onClick={() => onArchive(workspace.id)}>
                <Archive className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        )}
        {!defaultSpace ? (
          <button
            type="button"
            aria-label="Delete workspace"
            onClick={() => {
              if (window.confirm(`Delete ${workspace.name} permanently?`)) {
                onDelete(workspace.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface GlobalSearchTriggerProps {
  resultCount: number;
  searchTerm: string;
  onOpen(): void;
}

function GlobalSearchTrigger({ resultCount, searchTerm, onOpen }: GlobalSearchTriggerProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="karya-glass-panel flex h-11 min-w-[180px] flex-1 items-center gap-2 rounded-xl px-3 text-left text-sm text-[var(--karya-muted)] transition hover:border-[var(--karya-border-strong)] lg:h-12 lg:min-w-[240px] lg:gap-3 lg:px-4 xl:max-w-5xl"
    >
      <Search className="h-5 w-5 text-[var(--karya-accent)]" />
      <span className="min-w-0 flex-1 truncate">
        {searchTerm ? searchTerm : "Search profiles, workspaces, resources, tasks, commands, apps..."}
      </span>
      <span className="hidden text-xs text-[var(--karya-subtle)] lg:inline">
        {resultCount > 0 ? `${resultCount} found` : "Universal Search"}
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--karya-border)] bg-[var(--karya-control)] px-1.5 py-0.5 text-xs text-[var(--karya-muted)]">
        <Command className="h-3 w-3" /> K
      </span>
    </button>
  );
}

function AddResourceMenu({
  onOpenChange,
  onPlacement,
  open,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onPlacement(operation: PlacementOperation, mode: ImportMode): void;
}): ReactElement {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actions: Array<{
    label: string;
    description: string;
    icon: ReactElement;
    operation: PlacementOperation;
    mode: ImportMode;
  }> = [
    {
      label: "Reference File",
      description: "Keep the file in place and associate it with this work",
      icon: <ExternalLink className="h-4 w-4" />,
      operation: "link",
      mode: "file",
    },
    {
      label: "Reference Folder",
      description: "Reference a folder, project, or repository in place",
      icon: <FolderOpen className="h-4 w-4" />,
      operation: "link",
      mode: "directory",
    },
  ];

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={menuRef} className="relative">
      <Button variant="secondary" size="sm" onClick={() => onOpenChange(!open)}>
        <ExternalLink className="h-4 w-4" />
        Reference
      </Button>
      {open ? (
        <div className="karya-scale-in absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-1 shadow-[var(--karya-shadow-panel)] backdrop-blur-xl">
          {actions.map((action) => (
            <button
              key={`${action.operation}:${action.mode}`}
              type="button"
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--karya-control)]"
              onClick={() => {
                onOpenChange(false);
                onPlacement(action.operation, action.mode);
              }}
            >
              <span className="mt-0.5 text-[var(--karya-accent)]">{action.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--karya-text)]">{action.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--karya-muted)]">{action.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface StatusIndicatorsProps {
  isReady: boolean;
  workspaceName?: string;
}

function StatusIndicators({ isReady, workspaceName }: StatusIndicatorsProps): ReactElement {
  return (
    <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-[var(--karya-muted)]">
      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3">
        <Circle
          className={cn(
            "h-2.5 w-2.5 fill-current",
            isReady ? "text-[var(--karya-success)]" : "text-[var(--karya-warning)]",
          )}
        />
        {isReady ? "Synced" : "Starting"}
      </span>
      <span className="hidden h-8 max-w-48 items-center gap-1.5 truncate rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 2xl:inline-flex">
        <Settings className="h-3.5 w-3.5 text-[var(--karya-accent)]" />
        Automatic placement
      </span>
      <span className="hidden max-w-40 truncate text-[var(--karya-subtle)] 2xl:inline">
        {workspaceName ?? "No workspace"}
      </span>
    </div>
  );
}

interface HomeSurfaceProps {
  activeSurface: KernelSnapshot["shell"]["activeSurface"];
  breadcrumbs: Array<{ id: string; label: string; profileId?: string; resourceId?: string; workspaceId?: string }>;
  profileState?: KernelSnapshot["profiles"];
  resources: ResourceSnapshot[];
  selectedResourceId?: string;
  snapshot?: KernelSnapshot;
  workspaceDashboardId?: string;
  workspaceName: string;
  dismissedInterruptedSessionId?: string;
  onAddWorkspaceApplication(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onArchiveProfile(profileId: string): void;
  onArchiveCalendarEvent(eventId: string): void;
  onArchiveResource(resourceId: string): void;
  onArchiveWorkspace(workspaceId: string): void;
  onCreateNote(title?: string, content?: string, destination?: ImportDestination): Promise<{ id: string }>;
  onCreateTask(title?: string, destination?: ImportDestination): Promise<{ id: string }>;
  onCreateBookmark(
    url: string,
    destination?: ImportDestination,
    options?: Omit<BookmarkPatch, "url">,
  ): Promise<{ id: string }>;
  onCreateCalendarEvent(
    title?: string,
    destination?: ImportDestination,
    options?: Omit<CalendarEventPatch, "title">,
  ): Promise<{ id: string }>;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onCompleteTask(resourceId: string): void;
  onCreateResource(): void;
  onCreateProfile(): void;
  onDeleteProfile(profileId: string): void;
  onDeleteCalendarEvent(eventId: string): void;
  onDeleteResource(resourceId: string): void;
  onDeleteWorkspace(workspaceId: string): void;
  onDuplicateWorkspace(workspaceId: string): void;
  onDismissInterruptedSession(): void;
  onNavigateHome(): void;
  onOpenFolder(resourceId: string): void;
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
  onMoveResource(resource: ResourceSnapshot): void;
  onOpenProfile(profileId: string): void;
  onOpenResource(resourceId: string): void;
  onReferenceFile(): Promise<void>;
  onReferenceFolder(): Promise<void>;
  onOpenSearch(): void;
  onOpenWorkspace(workspaceId: string): void;
  onOpenWorkspaceDashboard(workspaceId: string): void;
  onPinWorkspace(workspaceId: string, pinned: boolean): void;
  onRenameProfile(profile: KernelSnapshot["profiles"]["all"][number]): void;
  onRenameWorkspace(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  onRestoreProfile(profileId: string): void;
  onReopenTask(resourceId: string): void;
  onRestoreWorkspace(workspaceId: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  onSelectResource(resourceId: string): void;
  onUpdateWorkspaceLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
  onUpdateWorkspaceSettings(workspaceId: string, update: WorkspaceSettingsUpdate): void;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
  onUpdateBookmark(resourceId: string, patch: BookmarkPatch): Promise<void>;
  onUpdateCalendarEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
}

function HomeSurface({
  activeSurface,
  breadcrumbs,
  profileState,
  resources,
  selectedResourceId,
  snapshot,
  workspaceDashboardId,
  workspaceName,
  dismissedInterruptedSessionId,
  onAddWorkspaceApplication,
  onArchiveProfile,
  onArchiveResource,
  onArchiveWorkspace,
  onCreateNote,
  onCreateTask,
  onCreateBookmark,
  onCreateCalendarEvent,
  onCreateRelationship,
  onCompleteTask,
  onCreateResource,
  onCreateProfile,
  onDeleteProfile,
  onDeleteResource,
  onDeleteWorkspace,
  onDuplicateWorkspace,
  onDismissInterruptedSession,
  onNavigateHome,
  onOpenFolder,
  onApplicationContextMenu,
  onLaunchApplication,
  onMoveResource,
  onOpenProfile,
  onOpenResource,
  onReferenceFile,
  onReferenceFolder,
  onOpenSearch,
  onOpenWorkspace,
  onOpenWorkspaceDashboard,
  onPinWorkspace,
  onRenameProfile,
  onRenameWorkspace,
  onResumeWorkspace,
  onResumeResource,
  onRestoreProfile,
  onReopenTask,
  onRestoreWorkspace,
  onResourceContextMenu,
  onRemoveRelationship,
  onSelectResource,
  onUpdateWorkspaceLaunchSet,
  onUpdateWorkspaceSettings,
  onUpdateTask,
  onUpdateBookmark,
  onUpdateCalendarEvent,
  onArchiveCalendarEvent,
  onDeleteCalendarEvent,
}: HomeSurfaceProps): ReactElement {
  if (activeSurface.type === "home" && snapshot) {
    return (
      <DesktopHomeDashboard
        snapshot={snapshot}
        onCreateNote={onCreateNote}
        onCreateTask={onCreateTask}
        onCreateProfile={onCreateProfile}
        onCreateResource={onCreateResource}
        onOpenFolder={onOpenFolder}
        onApplicationContextMenu={onApplicationContextMenu}
        onLaunchApplication={onLaunchApplication}
        onOpenProfile={onOpenProfile}
        onOpenResource={onOpenResource}
        onOpenSearch={onOpenSearch}
        onOpenWorkspace={onOpenWorkspace}
        onDismissInterruptedSession={onDismissInterruptedSession}
        dismissedInterruptedSessionId={dismissedInterruptedSessionId}
        onResourceContextMenu={onResourceContextMenu}
        onResumeResource={onResumeResource}
      />
    );
  }

  if (activeSurface.type === "profile" && profileState && snapshot) {
    const profile = profileState.all.find((item) => item.id === activeSurface.profileId);
    if (profile) {
      return (
        <ProfileDashboard
          profile={profile}
          snapshot={snapshot}
          onArchive={onArchiveProfile}
          onDelete={onDeleteProfile}
          onOpenWorkspace={onOpenWorkspace}
          onRename={onRenameProfile}
          onResumeResource={onResumeResource}
          onRestore={onRestoreProfile}
        />
      );
    }
  }

  if (activeSurface.type === "workspace" && snapshot) {
    const workspace = snapshot.workspaces.all.find((item) => item.id === activeSurface.workspaceId);
    if (workspace) {
      const workspaceProps = {
        resources,
        selectedResourceId,
        snapshot,
        workspace,
        onArchive: onArchiveWorkspace,
        onArchiveCalendarEvent,
        onArchiveResource,
        onDelete: onDeleteWorkspace,
        onDuplicate: onDuplicateWorkspace,
        onDeleteCalendarEvent,
        onAddApplication: onAddWorkspaceApplication,
        onCreateNote,
        onCreateTask,
        onCreateBookmark,
        onCreateCalendarEvent,
        onCreateRelationship,
        onCompleteTask,
        onDeleteResource,
        onOpenFolder,
        onOpenResource,
        onReferenceFile,
        onReferenceFolder,
        onApplicationContextMenu,
        onLaunchApplication,
        onMoveResource,
        onAddWorkspaceApplication,
        onOpenProperties: onOpenWorkspaceDashboard,
        onPin: onPinWorkspace,
        onRename: onRenameWorkspace,
        onReopenTask,
        onRestore: onRestoreWorkspace,
        onResumeWorkspace,
        onResumeResource,
        onResourceContextMenu,
        onRemoveRelationship,
        onSelectResource,
        onUpdateWorkspaceLaunchSet,
        onUpdateWorkspaceSettings,
        onUpdateTask,
        onUpdateBookmark,
        onUpdateCalendarEvent,
      };

      return workspaceDashboardId === workspace.id ? (
        <WorkspaceDashboard {...workspaceProps} />
      ) : (
        <WorkspaceContents key={workspace.id} {...workspaceProps} />
      );
    }
  }

  const navigateBreadcrumb = (breadcrumb: (typeof breadcrumbs)[number]) => {
    if (breadcrumb.id === "surface:home") {
      onNavigateHome();
    } else if (breadcrumb.profileId) {
      onOpenProfile(breadcrumb.profileId);
    } else if (breadcrumb.workspaceId) {
      onOpenWorkspace(breadcrumb.workspaceId);
    } else if (breadcrumb.resourceId) {
      onOpenFolder(breadcrumb.resourceId);
    }
  };
  const currentBreadcrumbIndex =
    activeSurface.type === "folder"
      ? breadcrumbs.findIndex((breadcrumb) => breadcrumb.resourceId === activeSurface.resourceId)
      : -1;
  const parentBreadcrumb = currentBreadcrumbIndex > 0 ? breadcrumbs[currentBreadcrumbIndex - 1] : undefined;
  const workspaceBreadcrumb = [...breadcrumbs].reverse().find((breadcrumb) => breadcrumb.workspaceId);

  return (
    <div className="flex h-full min-w-0 flex-col gap-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--karya-muted)]">
            {breadcrumbs.map((breadcrumb, index) => (
              <span key={breadcrumb.id} className="inline-flex items-center gap-2">
                {index > 0 ? <span className="text-[var(--karya-subtle)]">/</span> : null}
                <button
                  type="button"
                  className="rounded px-1 hover:bg-[var(--karya-control)] hover:text-[var(--karya-text)]"
                  onClick={() => navigateBreadcrumb(breadcrumb)}
                >
                  {breadcrumb.label}
                </button>
              </span>
            ))}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[var(--karya-text)]">
            {activeSurface.type === "folder" || activeSurface.type === "workspace"
              ? (breadcrumbs.at(-1)?.label ?? "Workspace")
              : workspaceName}
          </h1>
        </div>
        {activeSurface.type === "folder" ? (
          <div className="flex flex-wrap gap-2">
            {parentBreadcrumb ? (
              <Button variant="ghost" size="sm" onClick={() => navigateBreadcrumb(parentBreadcrumb)}>
                <ChevronLeft className="h-4 w-4" />
                Up
              </Button>
            ) : null}
            {workspaceBreadcrumb ? (
              <Button size="sm" onClick={() => navigateBreadcrumb(workspaceBreadcrumb)}>
                Back to Workspace
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 overflow-y-auto pr-1">
        {resources.map((resource) => (
          <button
            key={resource.id}
            type="button"
            onClick={() => {
              if (isFolderResource(resource)) {
                onOpenFolder(resource.id);
                return;
              }
              onSelectResource(resource.id);
            }}
            onDoubleClick={() => {
              if (isFolderResource(resource)) {
                onOpenFolder(resource.id);
                return;
              }
              onOpenResource(resource.id);
            }}
            onContextMenu={(event) => onResourceContextMenu(event, resource)}
            className={cn(
              "karya-interactive h-44 rounded-xl border bg-[var(--karya-surface)] p-4 text-left shadow-[var(--karya-shadow-card)] backdrop-blur-xl transition-colors hover:border-[var(--karya-border-strong)]",
              selectedResourceId === resource.id
                ? "border-[var(--karya-border-strong)] bg-[var(--karya-surface-strong)]"
                : "border-[var(--karya-border)]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <Badge>{resource.metadata.kind}</Badge>
              <span className="text-xs text-[var(--karya-subtle)]">{resource.lifecycleState}</span>
            </div>
            <h2 className="mt-4 line-clamp-2 text-base font-semibold text-[var(--karya-text)]">
              {displayResourceTitle(resource)}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--karya-muted)]">{resource.metadata.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {resource.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-[var(--karya-control)] px-2 py-1 text-xs text-[var(--karya-muted)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface WorkspaceDashboardProps {
  resources: HomeSurfaceProps["resources"];
  selectedResourceId?: string;
  snapshot: KernelSnapshot;
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onAddApplication(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onArchive(workspaceId: string): void;
  onArchiveCalendarEvent(eventId: string): void;
  onArchiveResource(resourceId: string): void;
  onCreateNote(title?: string, content?: string, destination?: ImportDestination): Promise<{ id: string }>;
  onCreateTask(title?: string, destination?: ImportDestination): Promise<{ id: string }>;
  onCreateBookmark(
    url: string,
    destination?: ImportDestination,
    options?: Omit<BookmarkPatch, "url">,
  ): Promise<{ id: string }>;
  onCreateCalendarEvent(
    title?: string,
    destination?: ImportDestination,
    options?: Omit<CalendarEventPatch, "title">,
  ): Promise<{ id: string }>;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onCompleteTask(resourceId: string): void;
  onDelete(workspaceId: string): void;
  onDuplicate(workspaceId: string): void;
  onDeleteCalendarEvent(eventId: string): void;
  onDeleteResource(resourceId: string): void;
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
  onMoveResource(resource: ResourceSnapshot): void;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onReferenceFile(): Promise<void>;
  onReferenceFolder(): Promise<void>;
  onOpenProperties(workspaceId: string): void;
  onPin(workspaceId: string, pinned: boolean): void;
  onRename(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onReopenTask(resourceId: string): void;
  onRestore(workspaceId: string): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  onSelectResource(resourceId: string): void;
  onUpdateWorkspaceLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
  onUpdateWorkspaceSettings(workspaceId: string, update: WorkspaceSettingsUpdate): void;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
  onUpdateBookmark(resourceId: string, patch: BookmarkPatch): Promise<void>;
  onUpdateCalendarEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
}

type ResumeWorkspaceHandler = (workspaceId: string, options?: { launchOnly?: boolean }) => void;

type WorkspacePage =
  | "overview"
  | "resources"
  | "notes"
  | "tasks"
  | "calendar"
  | "bookmarks"
  | "applications"
  | "activity"
  | "relationships"
  | "settings";

function WorkspaceContents({
  onAddApplication,
  onArchive,
  onApplicationContextMenu,
  onCreateNote,
  onCreateTask,
  onCreateBookmark,
  onCreateCalendarEvent,
  onCreateRelationship,
  onCompleteTask,
  onArchiveResource,
  onDelete,
  onDuplicate,
  onDeleteResource,
  onOpenFolder,
  onLaunchApplication,
  onMoveResource,
  onOpenProperties,
  onOpenResource,
  onReferenceFile,
  onReferenceFolder,
  onPin,
  onRename,
  onReopenTask,
  onRestore,
  onResumeWorkspace,
  onResumeResource,
  onResourceContextMenu,
  onRemoveRelationship,
  onSelectResource,
  onUpdateWorkspaceLaunchSet,
  onUpdateWorkspaceSettings,
  onUpdateTask,
  onUpdateBookmark,
  onUpdateCalendarEvent,
  onArchiveCalendarEvent,
  onDeleteCalendarEvent,
  resources,
  selectedResourceId,
  snapshot,
  workspace,
}: WorkspaceDashboardProps): ReactElement {
  const workspaceSettings = resolveWorkspaceSettings(workspace.settings);
  const [activePage, setActivePage] = useState<WorkspacePage>(() =>
    workspaceLandingPage(workspaceSettings.experience.defaultLanding),
  );
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasksOpenTaskId, setTasksOpenTaskId] = useState<string | undefined>();
  const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState("");
  const workspaceScrollRef = useRef<HTMLDivElement | null>(null);
  const openTasks = (taskId?: string) => {
    setTasksOpenTaskId(taskId);
    setTasksOpen(true);
  };
  const isDesktopWorkspace = workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID;
  const ownerProfile = snapshot.profiles.all.find((profile) => profile.id === workspace.profileId);
  const isDefaultSpace = isDesktopWorkspace || ownerProfile?.defaultSpaceId === workspace.id;
  const workspaceSession = snapshot.continuity.currentSession?.workspaceSessions?.[workspace.id];
  const continueWorking = snapshot.continuity.continueWorkingByWorkspace[workspace.id];
  const workspaceInteractionActivities = snapshot.continuity.activityByWorkspace[workspace.id] ?? [];
  const recentResources = uniqueIds(
    workspaceInteractionActivities
      .filter(
        (activity) =>
          activity.resourceId &&
          ["resource-opened", "resource-resumed", "resource-viewed", "resource-edited"].includes(activity.type),
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .map((activity) => activity.resourceId)
      .filter((resourceId): resourceId is string => Boolean(resourceId)),
  )
    .map((resourceId) => snapshot.resources.all.find((resource) => resource.id === resourceId))
    .filter(isVisibleResource)
    .slice(0, 4);
  const pinnedResources = resources
    .filter(isPinnedWorkspaceResource)
    .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
    .slice(0, 6);
  const recentlyUpdatedResources = resources
    .filter(isVisibleResource)
    .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
    .slice(0, 6);
  const recentApplications = uniqueIds([
    ...workspaceInteractionActivities
      .filter((activity) => activity.type === "application-launched" && activity.applicationId)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .map((activity) => activity.applicationId)
      .filter((applicationId): applicationId is string => Boolean(applicationId)),
    ...(continueWorking?.applicationIds ?? []),
  ])
    .map((applicationId) =>
      snapshot.applications.installed.find((application) => application.metadata.id === applicationId),
    )
    .filter((application): application is ApplicationSnapshot => Boolean(application))
    .slice(0, 4);
  const preferredApplications = workspace.pinnedApplicationIds
    .map((applicationId) =>
      snapshot.applications.installed.find((application) => application.metadata.id === applicationId),
    )
    .filter((application): application is ApplicationSnapshot => Boolean(application));
  const workspaceInsights = snapshot.continuity.workspaceInsightsByWorkspace[workspace.id];
  const workspaceLaunchResources = snapshot.resources.all
    .filter(isVisibleResource)
    .filter(
      (resource) => resource.primaryWorkspaceId === workspace.id || resource.workspaceRefs.includes(workspace.id),
    );
  const workspaceTasks = snapshot.resources.all
    .filter(isVisibleResource)
    .filter(isTaskResource)
    .filter((resource) => resource.workspaceRefs.includes(workspace.id) || resource.primaryWorkspaceId === workspace.id)
    .sort(compareTasks);
  const workspaceBookmarks = snapshot.resources.all
    .filter(isVisibleResource)
    .filter(isBookmarkResource)
    .filter((resource) => resource.workspaceRefs.includes(workspace.id) || resource.primaryWorkspaceId === workspace.id)
    .sort(compareBookmarks);
  const workspaceEvents = snapshot.events.all
    .filter(isCalendarEvent)
    .filter((event) => event.lifecycleState !== "deleted")
    .filter((event) => event.workspaceRefs.includes(workspace.id) || event.primaryWorkspaceId === workspace.id)
    .sort(compareCalendarEvents);
  const workspaceNotifications = snapshot.notifications.items
    .filter((notification) => notification.status !== "archived" && notification.status !== "deleted")
    .filter(
      (notification) =>
        notification.workspaceId === workspace.id ||
        (!notification.workspaceId && notification.profileId === workspace.profileId),
    )
    .filter((notification) => {
      if (workspaceSettings.experience.notificationPreference === "none") return false;
      if (workspaceSettings.experience.notificationPreference === "all") return true;
      return notification.priority === "high" || notification.priority === "critical";
    })
    .slice(0, 5);
  const workspaceActivities = snapshot.activity.byWorkspace[workspace.id] ?? [];
  const dueTasks = workspaceTasks
    .filter((task) => readTaskStatus(task) !== "completed" && (isTaskDueToday(task) || isTaskOverdue(task)))
    .slice(0, 5);
  const upcomingTasks = workspaceTasks
    .filter(
      (task) =>
        !["completed", "archived"].includes(readTaskStatus(task)) && Boolean(readStringAttribute(task, "taskDueDate")),
    )
    .slice(0, 5);
  const upcomingEvents = workspaceEvents.filter((event) => readCalendarEndDate(event) >= todayDateKey()).slice(0, 5);
  const workspaceNotes = resources.filter(isEditableNativeNote);
  const searchResults = filterWorkspaceBriefingSearch(workspaceSearchTerm, resources, workspaceEvents).slice(0, 6);
  const createNoteInWorkspace = async (title?: string, content?: string) => {
    const destinationWorkspaceId =
      workspaceSettings.preferences.capturePreference === "profile-inbox"
        ? (snapshot.profiles.all.find((profile) => profile.id === workspace.profileId)?.defaultSpaceId ?? workspace.id)
        : workspace.id;
    const note = await onCreateNote(title, content, destinationFromWorkspace(snapshot, destinationWorkspaceId));
    return note;
  };
  const createTaskInWorkspace = async (title?: string) => {
    const task = await onCreateTask(title, destinationFromWorkspace(snapshot, workspace.id));
    openTasks(task.id);
    return task;
  };
  const createBookmarkInWorkspace = async (url: string, options?: Omit<BookmarkPatch, "url">) => {
    const bookmark = await onCreateBookmark(url, destinationFromWorkspace(snapshot, workspace.id), options);
    return bookmark;
  };
  const createCalendarEventInWorkspace = async (title?: string, options?: Omit<CalendarEventPatch, "title">) => {
    const event = await onCreateCalendarEvent(title, destinationFromWorkspace(snapshot, workspace.id), options);
    return event;
  };
  const workspaceApplicationList = [...preferredApplications, ...recentApplications].filter(
    (application, index, all) =>
      all.findIndex((candidate) => candidate.metadata.id === application.metadata.id) === index,
  );
  const baseNavigationItems: Array<{ page: WorkspacePage; label: string; count?: number }> = [
    { page: "overview", label: "Overview" },
    { page: "resources", label: isDefaultSpace ? "Inbox Items" : "Resources", count: resources.length },
    { page: "notes", label: "Notes", count: workspaceNotes.length },
    { page: "tasks", label: "Tasks", count: workspaceTasks.length },
    { page: "calendar", label: "Calendar", count: workspaceEvents.length },
    { page: "bookmarks", label: "Bookmarks", count: workspaceBookmarks.length },
    { page: "applications", label: "Applications", count: workspaceApplicationList.length },
    { page: "activity", label: "Activity", count: workspaceActivities.length },
    { page: "relationships", label: "Relationships", count: countWorkspaceRelationships(resources, workspaceEvents) },
    { page: "settings", label: "Settings" },
  ];
  const navigationItems = baseNavigationItems.filter(
    (item) => !isDefaultSpace || !["applications", "activity", "relationships"].includes(item.page),
  );

  useEffect(() => {
    workspaceScrollRef.current?.scrollTo({ top: 0 });
  }, [activePage, workspace.id]);

  useEffect(() => {
    setActivePage(workspaceLandingPage(resolveWorkspaceSettings(workspace.settings).experience.defaultLanding));
  }, [workspace.id]);

  return (
    <div
      ref={workspaceScrollRef}
      className={cn(
        "flex h-full min-w-0 flex-col gap-4 overflow-y-auto pr-1",
        workspaceSettings.appearance.theme === "dark" ? "dark" : undefined,
      )}
      style={{ "--karya-accent": workspaceSettings.appearance.accentColor } as CSSProperties}
    >
      <section
        className={cn(
          "relative min-h-[156px] overflow-hidden rounded-xl border border-[var(--karya-border)] p-4 shadow-[var(--karya-shadow-panel)] lg:min-h-[176px] lg:p-6",
          workspaceSettings.appearance.banner === "none"
            ? "bg-[var(--karya-surface)]"
            : workspaceSettings.appearance.banner === "solid"
              ? "bg-[var(--karya-accent)]"
              : "bg-[linear-gradient(135deg,rgba(38,178,166,0.32),rgba(42,59,39,0.38)_50%,rgba(210,176,60,0.12))]",
        )}
        style={{
          backdropFilter:
            workspaceSettings.appearance.backgroundBlur === "strong"
              ? "blur(24px)"
              : workspaceSettings.appearance.backgroundBlur === "subtle"
                ? "blur(10px)"
                : undefined,
          backgroundImage:
            workspaceSettings.appearance.wallpaper === "grid"
              ? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
              : workspaceSettings.appearance.wallpaper === "ambient"
                ? `radial-gradient(circle at 18% 40%, ${workspaceSettings.appearance.accentColor}44, transparent 60%)`
                : undefined,
          backgroundSize: workspaceSettings.appearance.wallpaper === "grid" ? "64px 64px" : undefined,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_40%,rgba(139,233,244,0.15),transparent_26rem)]" />
        <div className="relative flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{isDesktopWorkspace ? "Desktop Inbox" : isDefaultSpace ? "Inbox" : "Project Briefing"}</Badge>
              <Badge>{isDesktopWorkspace ? "Desktop" : (ownerProfile?.name ?? workspace.profileId)}</Badge>
              {workspace.pinned ? <Badge>Pinned</Badge> : null}
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-[var(--karya-text)] 2xl:mt-5 2xl:text-5xl">
              {displayWorkspaceName(workspace)}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--karya-muted)]">
              {workspace.metadata.description ??
                (isDefaultSpace
                  ? "An inbox for imports, captures, unsorted resources, and notes waiting to be placed."
                  : "A project briefing for what changed, what needs attention, and where to continue.")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => (isDefaultSpace ? onOpenProperties(workspace.id) : onResumeWorkspace(workspace.id))}
          >
            {isDefaultSpace ? "Inbox settings" : "Continue working"}
            <ExternalLink className="h-4 w-4" />
          </Button>
          {!isDefaultSpace ? <ExplainThisButton capability="continue-working" /> : null}
          <ExplainMyWorkspaceButton
            snapshot={snapshot}
            workspace={workspace}
            onConfigureLaunchSet={() => setActivePage("settings")}
          />
        </div>
      </section>

      <WorkspaceNavigation items={navigationItems} activePage={activePage} onChange={setActivePage} />

      {activePage === "overview" ? (
        isDefaultSpace ? (
          <DefaultSpaceInboxOverview
            resources={resources}
            workspace={workspace}
            selectedResourceId={selectedResourceId}
            onCreateNote={createNoteInWorkspace}
            onCreateTask={createTaskInWorkspace}
            onMoveResource={onMoveResource}
            onOpenFolder={onOpenFolder}
            onOpenResource={onOpenResource}
            onResourceContextMenu={onResourceContextMenu}
            onResumeResource={onResumeResource}
            onSelectResource={onSelectResource}
          />
        ) : (
          <section className="space-y-4">
            <WorkspaceIntelligenceCard
              resources={workspaceLaunchResources}
              snapshot={snapshot}
              workspace={workspace}
              onOpenLaunchSet={() => setActivePage("settings")}
              onOpenRelationships={() => setActivePage("relationships")}
            />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
              <BriefingResumePanel
                applications={recentApplications}
                resources={recentResources}
                session={workspaceSession}
                workspace={workspace}
                onResourceContextMenu={onResourceContextMenu}
                onResumeResource={onResumeResource}
                onResumeWorkspace={onResumeWorkspace}
              />
              <TodaysFocusPanel
                dueTasks={dueTasks}
                notifications={workspaceNotifications}
                upcomingEvents={upcomingEvents}
                onCompleteTask={onCompleteTask}
                onOpenTasks={openTasks}
              />
            </div>

            <PinnedResourcesBriefing
              resources={pinnedResources}
              selectedResourceId={selectedResourceId}
              onOpenFolder={onOpenFolder}
              onOpenResource={onOpenResource}
              onResourceContextMenu={onResourceContextMenu}
              onSelectResource={onSelectResource}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <RecentResourcesPanel
                resources={recentlyUpdatedResources}
                workspace={workspace}
                onResourceContextMenu={onResourceContextMenu}
                onResumeResource={onResumeResource}
              />
              <UpcomingTasksPanel tasks={upcomingTasks} onCompleteTask={onCompleteTask} onOpenTasks={openTasks} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <UpcomingScheduleBriefing events={upcomingEvents} />
              <ConnectedWorkBriefing snapshot={snapshot} workspaceId={workspace.id} onOpenResource={onSelectResource} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <WorkspaceScopedSearch
                events={workspaceEvents}
                onOpenEvent={() => undefined}
                onOpenFolder={onOpenFolder}
                onOpenResource={onOpenResource}
                onSelectResource={onSelectResource}
                query={workspaceSearchTerm}
                resources={resources}
                results={searchResults}
                onQueryChange={setWorkspaceSearchTerm}
              />
              <WorkspaceBriefingInsights
                activities={workspaceActivities}
                events={workspaceEvents}
                resources={resources}
                tasks={workspaceTasks}
              />
            </div>
          </section>
        )
      ) : null}

      {activePage === "resources" ? (
        <WorkspaceResourceExplorer
          resources={resources}
          selectedResourceId={selectedResourceId}
          title={isDefaultSpace ? "Inbox Items" : "Workspace Resources"}
          description={
            isDefaultSpace
              ? "Captured, imported, and unsorted Resources waiting for placement."
              : "Every Resource attached to this Workspace."
          }
          onOpenFolder={onOpenFolder}
          onOpenResource={onOpenResource}
          onReferenceFile={onReferenceFile}
          onReferenceFolder={onReferenceFolder}
          onResourceContextMenu={onResourceContextMenu}
          onSelectResource={onSelectResource}
          initialView={workspaceSettings.experience.resourceDisplay}
          initialSort={workspaceSettings.experience.resourceSort}
        />
      ) : null}

      {activePage === "notes" ? (
        <WorkspaceResourceExplorer
          resources={workspaceNotes}
          selectedResourceId={selectedResourceId}
          title="Workspace Notes"
          description="Notes belonging to this Workspace."
          fixedKind="note"
          onOpenFolder={onOpenFolder}
          onOpenResource={onOpenResource}
          onResourceContextMenu={onResourceContextMenu}
          onSelectResource={onSelectResource}
          action={
            <Button size="sm" onClick={() => void createNoteInWorkspace()}>
              <Plus className="h-4 w-4" /> New Note
            </Button>
          }
        />
      ) : null}

      {activePage === "tasks" ? (
        <WorkspaceTasksPage
          tasks={workspaceTasks}
          onComplete={onCompleteTask}
          onCreateTask={createTaskInWorkspace}
          onOpenTasks={openTasks}
          onReopen={onReopenTask}
        />
      ) : null}

      {activePage === "calendar" ? (
        <CalendarPanel
          events={workspaceEvents}
          onCreateEvent={createCalendarEventInWorkspace}
          onCreateRelationship={onCreateRelationship}
          onArchive={onArchiveCalendarEvent}
          onDelete={onDeleteCalendarEvent}
          onOpenEvent={() => undefined}
          onRemoveRelationship={onRemoveRelationship}
          snapshot={snapshot}
          onUpdateEvent={onUpdateCalendarEvent}
        />
      ) : null}

      {activePage === "bookmarks" ? (
        <BookmarksPanel
          bookmarks={workspaceBookmarks}
          onCreateBookmark={createBookmarkInWorkspace}
          onDelete={onDeleteResource}
          onOpenBookmark={onOpenResource}
          onUpdateBookmark={onUpdateBookmark}
        />
      ) : null}

      {activePage === "applications" ? (
        <WorkspaceApplicationsPage
          applications={workspaceApplicationList}
          installedApplications={snapshot.applications.installed}
          workspace={workspace}
          onAddApplication={onAddApplication}
          onApplicationContextMenu={onApplicationContextMenu}
          onLaunchApplication={onLaunchApplication}
        />
      ) : null}

      {activePage === "activity" ? (
        <ActivityCenterPanel snapshot={snapshot} workspaceId={workspace.id} title="Workspace Activity" />
      ) : null}

      {activePage === "relationships" ? (
        <WorkspaceRelationshipsPage
          snapshot={snapshot}
          workspace={workspace}
          workspaceId={workspace.id}
          onCreateRelationship={onCreateRelationship}
          onOpenResource={onOpenResource}
          onRemoveRelationship={onRemoveRelationship}
          onSelectResource={onSelectResource}
        />
      ) : null}

      {activePage === "settings" ? (
        <WorkspaceSettingsPage
          isArchived={workspace.lifecycleState === "archived"}
          isDefaultSpace={isDefaultSpace}
          applications={snapshot.applications.installed}
          resources={workspaceLaunchResources}
          workspace={workspace}
          onArchive={onArchive}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onPin={onPin}
          onResumeWorkspace={onResumeWorkspace}
          onRestore={onRestore}
          onUpdateLaunchSet={onUpdateWorkspaceLaunchSet}
          onUpdateSettings={onUpdateWorkspaceSettings}
        />
      ) : null}

      {tasksOpen ? (
        <TasksDialog
          tasks={workspaceTasks}
          selectedTaskId={tasksOpenTaskId}
          onClose={() => {
            setTasksOpen(false);
            setTasksOpenTaskId(undefined);
          }}
          onComplete={onCompleteTask}
          onCreateTask={createTaskInWorkspace}
          onDelete={onDeleteResource}
          onReopen={onReopenTask}
          onUpdateTask={onUpdateTask}
        />
      ) : null}
    </div>
  );
}

function WorkspaceNavigation({
  activePage,
  items,
  onChange,
}: {
  activePage: WorkspacePage;
  items: Array<{ page: WorkspacePage; label: string; count?: number }>;
  onChange(page: WorkspacePage): void;
}): ReactElement {
  return (
    <nav
      className="karya-glass-panel flex min-w-0 flex-wrap gap-1 overflow-visible rounded-xl p-1"
      aria-label="Workspace navigation"
    >
      {items.map((item) => (
        <button
          key={item.page}
          type="button"
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors lg:h-9 lg:gap-2 lg:px-3 lg:text-sm",
            activePage === item.page
              ? "bg-[var(--karya-control-hover)] text-[var(--karya-text)]"
              : "text-[var(--karya-muted)] hover:bg-[var(--karya-control)] hover:text-[var(--karya-text)]",
          )}
          onClick={() => onChange(item.page)}
        >
          <span>{item.label}</span>
          {typeof item.count === "number" ? (
            <span className="rounded bg-[var(--karya-surface)] px-1.5 py-0.5 text-[10px] text-[var(--karya-subtle)]">
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function WorkspaceResourceExplorer({
  action,
  description,
  fixedKind,
  initialSort = "updated",
  initialView = "grid",
  onOpenFolder,
  onOpenResource,
  onReferenceFile,
  onReferenceFolder,
  onResourceContextMenu,
  onSelectResource,
  resources,
  selectedResourceId,
  title,
}: {
  action?: ReactElement;
  description: string;
  fixedKind?: string;
  initialSort?: "updated" | "title" | "type";
  initialView?: "grid" | "list";
  resources: ResourceSnapshot[];
  selectedResourceId?: string;
  title: string;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onReferenceFile?(): Promise<void>;
  onReferenceFolder?(): Promise<void>;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onSelectResource(resourceId: string): void;
}): ReactElement {
  const [view, setView] = useState<"grid" | "list">(initialView);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState(fixedKind ?? "all");
  const [sort, setSort] = useState<"updated" | "title" | "type">(initialSort);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const kinds = Array.from(new Set(resources.map((resource) => resource.metadata.kind))).sort();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleResources = resources
    .filter((resource) =>
      fixedKind ? resource.metadata.kind === fixedKind : kind === "all" || resource.metadata.kind === kind,
    )
    .filter((resource) => {
      if (!normalizedQuery) return true;
      return [
        displayResourceTitle(resource),
        resource.metadata.title,
        resource.metadata.description ?? "",
        readStringAttribute(resource, "contentSourcePath") ?? "",
        resource.metadata.kind,
        ...resource.tags,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (sort === "title") return displayResourceTitle(left).localeCompare(displayResourceTitle(right));
      if (sort === "type")
        return (
          left.metadata.kind.localeCompare(right.metadata.kind) ||
          displayResourceTitle(left).localeCompare(displayResourceTitle(right))
        );
      return right.metadata.updatedAt.localeCompare(left.metadata.updatedAt);
    });
  const toggleSelected = (resourceId: string) => {
    setSelectedIds((current) =>
      current.includes(resourceId) ? current.filter((id) => id !== resourceId) : [...current, resourceId],
    );
  };

  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--karya-text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--karya-muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length ? <Badge>{selectedIds.length} selected</Badge> : null}
          {action}
          {onReferenceFile ? (
            <Button size="sm" onClick={() => void onReferenceFile()}>
              <ExternalLink className="h-4 w-4" /> Reference file
            </Button>
          ) : null}
          {onReferenceFolder ? (
            <Button variant="secondary" size="sm" onClick={() => void onReferenceFolder()}>
              <FolderOpen className="h-4 w-4" /> Reference folder
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--karya-subtle)]" />
          <input
            className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-strong)] py-2 pl-9 pr-3 text-sm text-[var(--karya-text)] outline-none focus:border-[var(--karya-border-strong)]"
            placeholder="Search resources..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-strong)] px-3 py-2 text-sm text-[var(--karya-text)]"
          value={kind}
          disabled={Boolean(fixedKind)}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">All types</option>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-strong)] px-3 py-2 text-sm text-[var(--karya-text)]"
          value={sort}
          onChange={(event) => setSort(event.target.value as "updated" | "title" | "type")}
        >
          <option value="updated">Recently updated</option>
          <option value="title">Title</option>
          <option value="type">Type</option>
        </select>
        <div className="flex rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-1">
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                view === mode
                  ? "bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
                  : "text-[var(--karya-muted)]",
              )}
              onClick={() => setView(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "mt-4 min-h-0",
          view === "grid" ? "grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3" : "space-y-2",
        )}
      >
        {visibleResources.map((resource) => (
          <button
            key={resource.id}
            type="button"
            className={cn(
              "karya-interactive w-full rounded-xl border bg-[var(--karya-control)] p-3 text-left",
              view === "list" ? "flex items-center gap-3" : "min-h-32",
              selectedResourceId === resource.id || selectedIds.includes(resource.id)
                ? "border-[var(--karya-border-strong)] bg-[var(--karya-surface-strong)]"
                : "border-[var(--karya-border)]",
            )}
            onClick={(event) => {
              if (event.shiftKey || event.metaKey || event.ctrlKey) {
                toggleSelected(resource.id);
                return;
              }
              onSelectResource(resource.id);
            }}
            onDoubleClick={() => (isFolderResource(resource) ? onOpenFolder(resource.id) : onOpenResource(resource.id))}
            onContextMenu={(event) => onResourceContextMenu(event, resource)}
          >
            <div
              className={cn("flex items-start justify-between gap-3", view === "list" ? "min-w-0 flex-1" : undefined)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--karya-text)]">
                  {displayResourceTitle(resource)}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--karya-muted)]">
                  {resource.metadata.description || resource.metadata.kind}
                </p>
              </div>
              <Badge>{resource.metadata.kind}</Badge>
            </div>
            <div className={cn("flex flex-wrap gap-2", view === "list" ? "ml-auto shrink-0" : "mt-4")}>
              <span className="text-xs text-[var(--karya-subtle)]">{formatShortDate(resource.metadata.updatedAt)}</span>
              {resource.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-[var(--karya-surface)] px-1.5 py-0.5 text-[10px] text-[var(--karya-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
        {!visibleResources.length ? (
          <div className="rounded-xl border border-dashed border-[var(--karya-border)] p-6">
            <p className="text-sm font-medium text-[var(--karya-text)]">
              {resources.length ? "No resources match this view." : "Reference work without moving or copying it."}
            </p>
            {!resources.length ? (
              <p className="mt-1 text-sm text-[var(--karya-muted)]">
                Files and folders stay in their current system location and open with their native applications.
              </p>
            ) : null}
            {!resources.length && (onReferenceFile || onReferenceFolder) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {onReferenceFile ? (
                  <Button size="sm" onClick={() => void onReferenceFile()}>
                    <ExternalLink className="h-4 w-4" /> Reference file
                  </Button>
                ) : null}
                {onReferenceFolder ? (
                  <Button variant="secondary" size="sm" onClick={() => void onReferenceFolder()}>
                    <FolderOpen className="h-4 w-4" /> Reference folder
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

function WorkspaceTasksPage({
  onComplete,
  onCreateTask,
  onOpenTasks,
  onReopen,
  tasks,
}: {
  onComplete(resourceId: string): void;
  onCreateTask(title?: string): void;
  onOpenTasks(taskId?: string): void;
  onReopen(resourceId: string): void;
  tasks: ResourceSnapshot[];
}): ReactElement {
  const [mode, setMode] = useState<"list" | "kanban" | "calendar">("list");
  const activeTasks = tasks.filter((task) => readTaskStatus(task) !== "archived");
  const statuses: TaskStatus[] = ["todo", "in-progress", "blocked", "completed"];

  return (
    <Surface className="min-w-0 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--karya-text)]">Workspace Tasks</h2>
          <p className="mt-1 text-sm text-[var(--karya-muted)]">Manage all tasks belonging to this Workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-1">
            {(["list", "kanban", "calendar"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                  mode === item
                    ? "bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
                    : "text-[var(--karya-muted)]",
                )}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => void onCreateTask()}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>
      {mode === "list" ? (
        <RecentTasksPanel
          tasks={tasks}
          onComplete={onComplete}
          onCreateTask={onCreateTask}
          onOpenTasks={onOpenTasks}
          onReopen={onReopen}
        />
      ) : null}
      {mode === "kanban" ? (
        <div className="grid gap-3 xl:grid-cols-4">
          {statuses.map((status) => {
            const columnTasks = activeTasks.filter((task) => readTaskStatus(task) === status);
            return (
              <div
                key={status}
                className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--karya-text)]">{formatTaskStatus(status)}</h3>
                  <Badge>{columnTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] p-3 text-left"
                      onClick={() => onOpenTasks(task.id)}
                    >
                      <p className="truncate text-sm font-medium text-[var(--karya-text)]">{task.metadata.title}</p>
                      <p className="mt-1 text-xs text-[var(--karya-muted)]">
                        {readStringAttribute(task, "taskDueDate") ?? "No due date"}
                      </p>
                    </button>
                  ))}
                  {!columnTasks.length ? <p className="text-xs text-[var(--karya-muted)]">No tasks.</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {mode === "calendar" ? (
        <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-4">
          <h3 className="text-sm font-semibold text-[var(--karya-text)]">Task Calendar</h3>
          <div className="mt-3 space-y-2">
            {activeTasks
              .filter((task) => readStringAttribute(task, "taskDueDate"))
              .map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--karya-surface)] p-3 text-left"
                  onClick={() => onOpenTasks(task.id)}
                >
                  <span className="truncate text-sm text-[var(--karya-text)]">{task.metadata.title}</span>
                  <span className="text-xs text-[var(--karya-muted)]">{readStringAttribute(task, "taskDueDate")}</span>
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

function WorkspaceApplicationsPage({
  applications,
  installedApplications,
  onAddApplication,
  onApplicationContextMenu,
  onLaunchApplication,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  installedApplications: ApplicationSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onAddApplication(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
}): ReactElement {
  const suggested = installedApplications
    .filter((application) => !applications.some((item) => item.metadata.id === application.metadata.id))
    .slice(0, 4);
  const pinned = applications.filter((application) => application.pinned);
  const workspacePreferred = applications.filter(
    (application) => !application.pinned && workspace.pinnedApplicationIds.includes(application.metadata.id),
  );
  const recentlyUsed = applications.filter(
    (application) => !application.pinned && !workspace.pinnedApplicationIds.includes(application.metadata.id),
  );

  return (
    <div className="space-y-4">
      <WorkspaceApplicationsBriefing
        applications={applications}
        workspace={workspace}
        onAddApplication={onAddApplication}
        onApplicationContextMenu={onApplicationContextMenu}
        onLaunchApplication={onLaunchApplication}
      />
      <section className="grid gap-4 xl:grid-cols-4">
        <ApplicationGroup
          title="Pinned"
          applications={pinned}
          workspace={workspace}
          onApplicationContextMenu={onApplicationContextMenu}
          onLaunchApplication={onLaunchApplication}
        />
        <ApplicationGroup
          title="Workspace Preferred"
          applications={workspacePreferred}
          workspace={workspace}
          onApplicationContextMenu={onApplicationContextMenu}
          onLaunchApplication={onLaunchApplication}
        />
        <ApplicationGroup
          title="Recently Used"
          applications={recentlyUsed}
          workspace={workspace}
          onApplicationContextMenu={onApplicationContextMenu}
          onLaunchApplication={onLaunchApplication}
        />
        <ApplicationGroup
          title="Suggested"
          applications={suggested}
          workspace={workspace}
          onApplicationContextMenu={onApplicationContextMenu}
          onLaunchApplication={onLaunchApplication}
        />
      </section>
    </div>
  );
}

function ApplicationGroup({
  applications,
  onApplicationContextMenu,
  onLaunchApplication,
  title,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  title: string;
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--karya-text)]">{title}</h3>
        <Badge>{applications.length}</Badge>
      </div>
      <div className="space-y-2">
        {applications.map((application) => (
          <button
            key={application.metadata.id}
            type="button"
            className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3 text-left"
            onClick={() =>
              onLaunchApplication(application.metadata.id, {
                workspaceId: workspace.id,
                profileId: workspace.profileId,
              })
            }
            onContextMenu={(event) => onApplicationContextMenu(event, application)}
          >
            <p className="truncate text-sm font-medium text-[var(--karya-text)]">{application.metadata.name}</p>
            <p className="mt-1 text-xs text-[var(--karya-muted)]">{application.metadata.category ?? "Application"}</p>
          </button>
        ))}
        {!applications.length ? <p className="text-sm text-[var(--karya-muted)]">No applications here yet.</p> : null}
      </div>
    </Surface>
  );
}

function WorkspaceSettingsPage({
  applications,
  isArchived,
  isDefaultSpace,
  onArchive,
  onDelete,
  onDuplicate,
  onPin,
  onResumeWorkspace,
  onRestore,
  onUpdateLaunchSet,
  onUpdateSettings,
  resources,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  isArchived: boolean;
  isDefaultSpace: boolean;
  resources: ResourceSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onArchive(workspaceId: string): void;
  onDelete(workspaceId: string): void;
  onDuplicate(workspaceId: string): void;
  onPin(workspaceId: string, pinned: boolean): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
  onRestore(workspaceId: string): void;
  onUpdateLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
  onUpdateSettings(workspaceId: string, update: WorkspaceSettingsUpdate): void;
}): ReactElement {
  const settings = resolveWorkspaceSettings(workspace.settings);
  const [identity, setIdentity] = useState({
    name: workspace.name,
    description: workspace.metadata.description ?? "",
    icon: workspace.metadata.icon ?? "",
    color: workspace.metadata.color ?? settings.appearance.accentColor,
  });
  const [saveError, setSaveError] = useState<string | undefined>();
  const [launchSetOpen, setLaunchSetOpen] = useState(false);
  const saveUpdate = (update: WorkspaceSettingsUpdate) => {
    setSaveError(undefined);
    void Promise.resolve(onUpdateSettings(workspace.id, update)).catch((error) => {
      setSaveError(error instanceof Error ? error.message : "Could not save Workspace settings.");
    });
  };
  const updateSettings = <TSection extends keyof WorkspaceSettings>(
    section: TSection,
    patch: Partial<WorkspaceSettings[TSection]>,
  ) => {
    saveUpdate({ settings: { ...settings, [section]: { ...settings[section], ...patch } } });
  };

  useEffect(() => {
    setIdentity({
      name: workspace.name,
      description: workspace.metadata.description ?? "",
      icon: workspace.metadata.icon ?? "",
      color: workspace.metadata.color ?? resolveWorkspaceSettings(workspace.settings).appearance.accentColor,
    });
  }, [
    workspace.id,
    workspace.metadata.color,
    workspace.metadata.description,
    workspace.metadata.icon,
    workspace.name,
    workspace.settings,
  ]);

  return (
    <div className="min-w-0 space-y-4 pb-8">
      <div className="px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--karya-muted)]">
          Workspace Settings
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--karya-text)]">
          Configure how this Workspace looks, behaves, launches, and continues.
        </h2>
      </div>

      <WorkspaceSettingsSection
        eyebrow="1. Workspace Identity"
        title="Identity"
        description="Define the Workspace's name, description, icon, and identity color."
      >
        <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div
            className="flex min-h-40 items-center justify-center rounded-xl text-4xl font-semibold text-white"
            style={{ backgroundColor: identity.color || "#18181b" }}
          >
            {(identity.icon || identity.name.slice(0, 1) || "W").toUpperCase()}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceSettingsField label="Workspace name">
              <input
                className={settingsInputClassName}
                maxLength={WORKSPACE_NAME_MAX_LENGTH}
                value={identity.name}
                onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))}
              />
            </WorkspaceSettingsField>
            <WorkspaceSettingsField label="Logo or icon">
              <input
                className={settingsInputClassName}
                maxLength={4}
                placeholder="W"
                value={identity.icon}
                onChange={(event) => setIdentity((current) => ({ ...current, icon: event.target.value }))}
              />
            </WorkspaceSettingsField>
            <WorkspaceSettingsField label="Description" className="sm:col-span-2">
              <textarea
                className={`${settingsInputClassName} min-h-24 resize-y`}
                placeholder="What belongs in this Workspace?"
                value={identity.description}
                onChange={(event) => setIdentity((current) => ({ ...current, description: event.target.value }))}
              />
            </WorkspaceSettingsField>
            <WorkspaceSettingsField label="Identity color">
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-1"
                  value={identity.color}
                  onChange={(event) => setIdentity((current) => ({ ...current, color: event.target.value }))}
                />
                <input
                  className={settingsInputClassName}
                  value={identity.color}
                  onChange={(event) => setIdentity((current) => ({ ...current, color: event.target.value }))}
                />
              </div>
            </WorkspaceSettingsField>
            <div className="flex items-end justify-end">
              <Button size="sm" disabled={isArchived || !identity.name.trim()} onClick={() => saveUpdate(identity)}>
                Save identity
              </Button>
            </div>
          </div>
        </div>
      </WorkspaceSettingsSection>

      <WorkspaceSettingsSection
        eyebrow="2. Appearance"
        title="Make the environment recognizable"
        description="Appearance is scoped to this Workspace and does not change global Karya preferences."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <WorkspaceSettingsField label="Workspace theme">
            <select
              className={settingsSelectClassName}
              value={settings.appearance.theme}
              onChange={(event) =>
                updateSettings("appearance", { theme: event.target.value as WorkspaceSettings["appearance"]["theme"] })
              }
            >
              <option value="inherit">Follow Karya</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="focus">Focus</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Accent color">
            <input
              type="color"
              className="h-10 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-1"
              value={settings.appearance.accentColor}
              onChange={(event) => updateSettings("appearance", { accentColor: event.target.value })}
            />
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Banner">
            <select
              className={settingsSelectClassName}
              value={settings.appearance.banner}
              onChange={(event) =>
                updateSettings("appearance", {
                  banner: event.target.value as WorkspaceSettings["appearance"]["banner"],
                })
              }
            >
              <option value="none">None</option>
              <option value="subtle">Subtle</option>
              <option value="solid">Solid accent</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Wallpaper">
            <select
              className={settingsSelectClassName}
              value={settings.appearance.wallpaper}
              onChange={(event) =>
                updateSettings("appearance", {
                  wallpaper: event.target.value as WorkspaceSettings["appearance"]["wallpaper"],
                })
              }
            >
              <option value="none">None</option>
              <option value="grid">Quiet grid</option>
              <option value="ambient">Ambient</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Icon pack">
            <select
              className={settingsSelectClassName}
              value={settings.appearance.iconPack}
              onChange={(event) =>
                updateSettings("appearance", {
                  iconPack: event.target.value as WorkspaceSettings["appearance"]["iconPack"],
                })
              }
            >
              <option value="system">System</option>
              <option value="minimal">Minimal</option>
              <option value="expressive">Expressive</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Background blur">
            <select
              className={settingsSelectClassName}
              value={settings.appearance.backgroundBlur}
              onChange={(event) =>
                updateSettings("appearance", {
                  backgroundBlur: event.target.value as WorkspaceSettings["appearance"]["backgroundBlur"],
                })
              }
            >
              <option value="off">Off</option>
              <option value="subtle">Subtle</option>
              <option value="strong">Strong</option>
            </select>
          </WorkspaceSettingsField>
        </div>
      </WorkspaceSettingsSection>

      <WorkspaceSettingsSection
        eyebrow="3. Workspace Experience"
        title="Choose how work is presented"
        description="Set the landing surface, Resource presentation, search scope, and attention level."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <WorkspaceSettingsField label="Default landing experience">
            <select
              className={settingsSelectClassName}
              value={settings.experience.defaultLanding}
              onChange={(event) =>
                updateSettings("experience", {
                  defaultLanding: event.target.value as WorkspaceSettings["experience"]["defaultLanding"],
                })
              }
            >
              <option value="overview">Overview</option>
              <option value="continue-working">Continue Working</option>
              <option value="resources">Resources</option>
              <option value="activity">Activity</option>
              <option value="relationships">Relationships</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Resource display">
            <select
              className={settingsSelectClassName}
              value={settings.experience.resourceDisplay}
              onChange={(event) =>
                updateSettings("experience", {
                  resourceDisplay: event.target.value as WorkspaceSettings["experience"]["resourceDisplay"],
                })
              }
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Default sorting">
            <select
              className={settingsSelectClassName}
              value={settings.experience.resourceSort}
              onChange={(event) =>
                updateSettings("experience", {
                  resourceSort: event.target.value as WorkspaceSettings["experience"]["resourceSort"],
                })
              }
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title</option>
              <option value="type">Resource type</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Notifications">
            <select
              className={settingsSelectClassName}
              value={settings.experience.notificationPreference}
              onChange={(event) =>
                updateSettings("experience", {
                  notificationPreference: event.target
                    .value as WorkspaceSettings["experience"]["notificationPreference"],
                })
              }
            >
              <option value="important">Important only</option>
              <option value="all">All Workspace notifications</option>
              <option value="none">Muted</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Search preference">
            <select
              className={settingsSelectClassName}
              value={settings.experience.searchPreference}
              onChange={(event) =>
                updateSettings("experience", {
                  searchPreference: event.target.value as WorkspaceSettings["experience"]["searchPreference"],
                })
              }
            >
              <option value="workspace">Workspace first</option>
              <option value="profile">Profile first</option>
              <option value="global">Global</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Opening behavior">
            <select
              className={settingsSelectClassName}
              value={settings.experience.openBehavior}
              onChange={(event) =>
                updateSettings("experience", {
                  openBehavior: event.target.value as WorkspaceSettings["experience"]["openBehavior"],
                })
              }
            >
              <option value="restore-context">Restore context</option>
              <option value="open-clean">Open clean</option>
            </select>
          </WorkspaceSettingsField>
        </div>
        <div className="mt-3">
          <WorkspaceSettingRow
            title="Pin in navigation"
            description="Keep this Workspace immediately available in the sidebar."
            action={
              <Button
                variant={workspace.pinned ? "secondary" : "ghost"}
                size="sm"
                disabled={isArchived}
                onClick={() => onPin(workspace.id, !workspace.pinned)}
              >
                {workspace.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {workspace.pinned ? "Unpin" : "Pin"}
              </Button>
            }
          />
        </div>
      </WorkspaceSettingsSection>

      <WorkspaceSettingsSection
        eyebrow="4. Continue Working"
        title="Configure continuity"
        description="Control what Karya restores and how resumable work is ranked. Launch Sets remain independent."
      >
        <ExplainThisButton capability="continue-working" className="mb-3" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceSettingsField label="Continuity">
            <Button
              className="w-full"
              variant={settings.continuity.enabled ? "secondary" : "ghost"}
              onClick={() => updateSettings("continuity", { enabled: !settings.continuity.enabled })}
            >
              {settings.continuity.enabled ? "Enabled" : "Disabled"}
            </Button>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Restore preference">
            <select
              className={settingsSelectClassName}
              value={settings.continuity.restorePreference}
              onChange={(event) =>
                updateSettings("continuity", {
                  restorePreference: event.target.value as WorkspaceSettings["continuity"]["restorePreference"],
                })
              }
            >
              <option value="full-context">Full context</option>
              <option value="last-resource">Last Resource</option>
              <option value="workspace-only">Workspace only</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Ranking preference">
            <select
              className={settingsSelectClassName}
              value={settings.continuity.rankingPreference}
              onChange={(event) =>
                updateSettings("continuity", {
                  rankingPreference: event.target.value as WorkspaceSettings["continuity"]["rankingPreference"],
                })
              }
            >
              <option value="balanced">Balanced</option>
              <option value="recency">Recent activity</option>
              <option value="modified">Recently modified</option>
              <option value="manual">Manual priority</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Resource priority">
            <select
              className={settingsSelectClassName}
              value={settings.continuity.resourcePriority}
              onChange={(event) =>
                updateSettings("continuity", {
                  resourcePriority: event.target.value as WorkspaceSettings["continuity"]["resourcePriority"],
                })
              }
            >
              <option value="active">Active Resource</option>
              <option value="pinned">Pinned Resources</option>
              <option value="recent">Recent Resources</option>
            </select>
          </WorkspaceSettingsField>
        </div>
        <div className="mt-3">
          <WorkspaceSettingRow
            title="Restore Workspace layout"
            description="Remember navigation, sidebar, and inspector state with the continuity context."
            action={
              <Button
                size="sm"
                variant={settings.continuity.restoreLayout ? "secondary" : "ghost"}
                onClick={() => updateSettings("continuity", { restoreLayout: !settings.continuity.restoreLayout })}
              >
                {settings.continuity.restoreLayout ? "Restore layout" : "Use default layout"}
              </Button>
            }
          />
        </div>
      </WorkspaceSettingsSection>

      <WorkspaceSettingsSection
        eyebrow="5. Launch Sets"
        title="Bring this Workspace to life"
        description="Launch configuration is managed in its own focused editor, independently from Continue Working."
      >
        <ExplainThisButton capability="launch-sets" className="mb-3" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceSettingSummary label="Status" value={workspace.launchSet?.enabled ? "Enabled" : "Disabled"} />
          <WorkspaceSettingSummary label="Launch Items" value={String(workspace.launchSet?.items.length ?? 0)} />
          <WorkspaceSettingSummary
            label="Startup"
            value={workspace.launchSet?.executionMode === "parallel" ? "Parallel" : "Sequential"}
          />
          <WorkspaceSettingSummary
            label="Restore"
            value={formatLaunchRestoreBehavior(workspace.launchSet?.restoreBehavior)}
          />
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant={workspace.launchSet?.enabled ? "secondary" : "ghost"}
            disabled={!workspace.launchSet}
            onClick={() =>
              workspace.launchSet &&
              onUpdateLaunchSet(workspace.id, {
                ...workspace.launchSet,
                enabled: !workspace.launchSet.enabled,
                updatedAt: new Date().toISOString(),
              })
            }
          >
            {workspace.launchSet?.enabled ? "Disable Launch Set" : "Enable Launch Set"}
          </Button>
          <Button size="sm" onClick={() => setLaunchSetOpen(true)}>
            Configure Launch Set
          </Button>
        </div>
      </WorkspaceSettingsSection>

      <WorkspaceSettingsSection
        eyebrow="6. Workspace Preferences"
        title="Preferences"
        description="Override platform behavior only where this Workspace needs a different rule."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <WorkspaceSettingsField label="Capture destination">
            <select
              className={settingsSelectClassName}
              value={settings.preferences.capturePreference}
              onChange={(event) =>
                updateSettings("preferences", {
                  capturePreference: event.target.value as WorkspaceSettings["preferences"]["capturePreference"],
                })
              }
            >
              <option value="workspace">This Workspace</option>
              <option value="profile-inbox">Profile inbox</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Relationships">
            <select
              className={settingsSelectClassName}
              value={settings.preferences.relationshipPreference}
              onChange={(event) =>
                updateSettings("preferences", {
                  relationshipPreference: event.target
                    .value as WorkspaceSettings["preferences"]["relationshipPreference"],
                })
              }
            >
              <option value="suggest">Suggest related work</option>
              <option value="manual">Manual only</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Activity detail">
            <select
              className={settingsSelectClassName}
              value={settings.preferences.activityPreference}
              onChange={(event) =>
                updateSettings("preferences", {
                  activityPreference: event.target.value as WorkspaceSettings["preferences"]["activityPreference"],
                })
              }
            >
              <option value="meaningful">Meaningful activity</option>
              <option value="all">All activity</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Search context boost">
            <select
              className={settingsSelectClassName}
              value={settings.preferences.searchContextBoost}
              onChange={(event) =>
                updateSettings("preferences", {
                  searchContextBoost: event.target.value as WorkspaceSettings["preferences"]["searchContextBoost"],
                })
              }
            >
              <option value="workspace">Boost Workspace results</option>
              <option value="profile">Boost Profile results</option>
              <option value="none">No context boost</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Synchronization">
            <select
              className={settingsSelectClassName}
              value={settings.preferences.synchronizationPreference}
              onChange={(event) =>
                updateSettings("preferences", {
                  synchronizationPreference: event.target
                    .value as WorkspaceSettings["preferences"]["synchronizationPreference"],
                })
              }
            >
              <option value="inherit">Follow Karya</option>
              <option value="local-only">Keep local only</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Offline behavior">
            <select
              className={settingsSelectClassName}
              value={settings.preferences.offlinePreference}
              onChange={(event) =>
                updateSettings("preferences", {
                  offlinePreference: event.target.value as WorkspaceSettings["preferences"]["offlinePreference"],
                })
              }
            >
              <option value="local-first">Local-first</option>
              <option value="online-when-available">Use connectivity when available</option>
            </select>
          </WorkspaceSettingsField>
        </div>
      </WorkspaceSettingsSection>

      <Surface className="min-w-0 border-red-500/20 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-400">7. Danger Zone</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--karya-text)]">Workspace lifecycle</h2>
          <p className="mt-1 text-sm text-[var(--karya-muted)]">Destructive actions remain visually separated.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {isArchived ? (
            <Button variant="secondary" size="sm" onClick={() => onRestore(workspace.id)}>
              <RotateCcw className="h-4 w-4" /> Restore Workspace
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={isDefaultSpace} onClick={() => onArchive(workspace.id)}>
              <Archive className="h-4 w-4" /> Archive Workspace
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={isDefaultSpace} onClick={() => onDuplicate(workspace.id)}>
            Duplicate Workspace
          </Button>
          <Button variant="ghost" size="sm" onClick={() => exportWorkspaceManifest(workspace)}>
            Export Workspace Manifest
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isDefaultSpace}
            onClick={() => {
              if (window.confirm(`Delete ${workspace.name} permanently?`)) onDelete(workspace.id);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete Workspace
          </Button>
        </div>
      </Surface>
      {launchSetOpen ? (
        <WorkspaceLaunchSetModal
          applications={applications}
          resources={resources}
          workspace={workspace}
          onClose={() => setLaunchSetOpen(false)}
          onResumeWorkspace={onResumeWorkspace}
          onUpdateLaunchSet={onUpdateLaunchSet}
        />
      ) : null}
      {saveError ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{saveError}</p> : null}
    </div>
  );
}

function WorkspaceSettingSummary({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-xl bg-[var(--karya-surface-muted)] p-3">
      <p className="text-xs font-medium text-[var(--karya-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--karya-text)]">{value}</p>
    </div>
  );
}

function WorkspaceLaunchSetModal({
  applications,
  onClose,
  onResumeWorkspace,
  onUpdateLaunchSet,
  resources,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  onClose(): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
  onUpdateLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
  resources: ResourceSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
}): ReactElement {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-zinc-950/65 p-3 backdrop-blur-md lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-launch-set-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--karya-border)] bg-[var(--karya-surface)] shadow-[var(--karya-shadow-panel)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--karya-border)] px-5 py-4 lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--karya-muted)]">Launch Set</p>
            <h1
              id="workspace-launch-set-title"
              className="mt-1 truncate text-xl font-semibold text-[var(--karya-text)]"
            >
              {displayWorkspaceName(workspace)}
            </h1>
            <ExplainThisButton capability="launch-sets" className="mt-1" />
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Close Launch Set editor" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-5">
          <WorkspaceLaunchSetSettings
            applications={applications}
            resources={resources}
            workspace={workspace}
            onResumeWorkspace={onResumeWorkspace}
            onUpdateLaunchSet={onUpdateLaunchSet}
          />
        </div>
      </div>
    </div>
  );
}

function WorkspaceSettingsField({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}): ReactElement {
  return (
    <label className={cn("block rounded-xl bg-[var(--karya-surface-muted)] p-3", className)}>
      <span className="mb-2 block text-xs font-medium text-[var(--karya-muted)]">{label}</span>
      {children}
    </label>
  );
}

function WorkspaceSettingsSection({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--karya-muted)]">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-[var(--karya-text)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--karya-muted)]">{description}</p>
      <div className="mt-4">{children}</div>
    </Surface>
  );
}

function WorkspaceSettingRow({
  action,
  description,
  title,
}: {
  action: ReactNode;
  description: string;
  title: string;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--karya-surface-muted)] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--karya-text)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--karya-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function WorkspaceLaunchSetSettings({
  applications,
  onResumeWorkspace,
  onUpdateLaunchSet,
  resources,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  resources: ResourceSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onResumeWorkspace: ResumeWorkspaceHandler;
  onUpdateLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
}): ReactElement {
  const availableApplications = applications.filter(
    (application) => application.lifecycleState !== "removed" && application.lifecycleState !== "unavailable",
  );
  const visibleResources = resources.filter(isVisibleResource);
  const [draftLaunchSet, setDraftLaunchSet] = useState<WorkspaceLaunchSet>(
    () => workspace.launchSet ?? createEmptyLaunchSet(),
  );
  const [selectedApplicationId, setSelectedApplicationId] = useState(availableApplications[0]?.metadata.id ?? "");
  const [selectedResourceId, setSelectedResourceId] = useState(visibleResources[0]?.id ?? "");
  const [selectedResourceApplicationId, setSelectedResourceApplicationId] = useState("");
  const [selectedLaunchItemKind, setSelectedLaunchItemKind] = useState<WorkspaceLaunchSetItem["kind"]>("application");
  const [launchSetError, setLaunchSetError] = useState<string | undefined>();
  const launchSet = draftLaunchSet;
  const applicationOptions = availableApplications.filter(
    (application) =>
      !launchSet.items.some((item) => item.kind === "application" && item.applicationId === application.metadata.id),
  );
  const resourceOptions = visibleResources.filter(
    (resource) => !launchSet.items.some((item) => item.kind === "resource" && item.resourceId === resource.id),
  );
  const selectedResource = resourceOptions.find((resource) => resource.id === selectedResourceId);
  const hasLaunchSet = Boolean(launchSet.enabled && launchSet.items.some((item) => item.enabled !== false));

  useEffect(() => {
    setDraftLaunchSet(workspace.launchSet ?? createEmptyLaunchSet());
    setLaunchSetError(undefined);
  }, [workspace.id, workspace.launchSet]);

  useEffect(() => {
    if (!applicationOptions.some((application) => application.metadata.id === selectedApplicationId)) {
      setSelectedApplicationId(applicationOptions[0]?.metadata.id ?? "");
    }
    if (!resourceOptions.some((resource) => resource.id === selectedResourceId)) {
      setSelectedResourceId(resourceOptions[0]?.id ?? "");
    }
  }, [applicationOptions, resourceOptions, selectedApplicationId, selectedResourceId]);

  const saveLaunchSet = (nextLaunchSet: WorkspaceLaunchSet) => {
    const next = { ...nextLaunchSet, updatedAt: new Date().toISOString() };
    setDraftLaunchSet(next);
    setLaunchSetError(undefined);
    void Promise.resolve(onUpdateLaunchSet(workspace.id, next)).catch((error) => {
      setLaunchSetError(error instanceof Error ? error.message : "Could not save the Launch Set.");
    });
  };
  const updateItem = (itemId: string, patch: Partial<WorkspaceLaunchSetItem>) => {
    saveLaunchSet({
      ...launchSet,
      items: launchSet.items.map((item) =>
        item.id === itemId ? ({ ...item, ...patch } as WorkspaceLaunchSetItem) : item,
      ),
    });
  };
  const moveItem = (itemId: string, direction: -1 | 1) => {
    const index = launchSet.items.findIndex((item) => item.id === itemId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= launchSet.items.length) return;
    const nextItems = [...launchSet.items];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, item);
    saveLaunchSet({ ...launchSet, items: nextItems });
  };
  const removeItem = (itemId: string) => {
    saveLaunchSet({
      ...launchSet,
      focusItemId: launchSet.focusItemId === itemId ? undefined : launchSet.focusItemId,
      items: launchSet.items.filter((item) => item.id !== itemId),
    });
  };
  const addApplication = () => {
    if (
      !selectedApplicationId ||
      launchSet.items.some((item) => item.kind === "application" && item.applicationId === selectedApplicationId)
    )
      return;
    saveLaunchSet({
      ...launchSet,
      enabled: true,
      items: [
        ...launchSet.items,
        {
          id: createLaunchItemId(),
          enabled: true,
          kind: "application",
          applicationId: selectedApplicationId,
          behavior: "launch",
          delayMs: 0,
        },
      ],
    });
  };
  const addResource = () => {
    if (
      !selectedResourceId ||
      launchSet.items.some((item) => item.kind === "resource" && item.resourceId === selectedResourceId)
    )
      return;
    const itemId = createLaunchItemId();
    saveLaunchSet({
      ...launchSet,
      enabled: true,
      focusItemId: launchSet.focusItemId ?? itemId,
      items: [
        ...launchSet.items,
        {
          id: itemId,
          enabled: true,
          kind: "resource",
          resourceId: selectedResourceId,
          behavior: "open",
          applicationId:
            selectedResource && !isFolderResource(selectedResource)
              ? selectedResourceApplicationId || undefined
              : undefined,
          delayMs: 0,
        },
      ],
    });
  };

  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--karya-muted)]">
            Launch Set Editor
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--karya-text)]">How should this Workspace come alive?</h2>
          <p className="mt-1 text-sm text-[var(--karya-muted)]">
            Configure an ordered startup sequence. Launch Sets remain independent from Continue Working.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant={launchSet.enabled ? "secondary" : "ghost"}
            onClick={() => saveLaunchSet({ ...launchSet, enabled: !launchSet.enabled })}
          >
            {launchSet.enabled ? "Launch Set enabled" : "Enable Launch Set"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!hasLaunchSet}
            onClick={() => onResumeWorkspace(workspace.id, { launchOnly: true })}
          >
            Test Launch Set
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!workspace.launchSet && !launchSet.items.length && !launchSet.enabled}
            onClick={() => {
              setDraftLaunchSet(createEmptyLaunchSet());
              setLaunchSetError(undefined);
              void Promise.resolve(onUpdateLaunchSet(workspace.id, undefined)).catch((error) => {
                setLaunchSetError(error instanceof Error ? error.message : "Could not reset the Launch Set.");
              });
            }}
          >
            Reset Launch Set
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 rounded-xl bg-[var(--karya-surface-muted)] p-4 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceSettingsField label="Startup mode">
            <select
              className={settingsSelectClassName}
              value={launchSet.executionMode ?? "sequential"}
              onChange={(event) =>
                saveLaunchSet({
                  ...launchSet,
                  executionMode: event.target.value as NonNullable<WorkspaceLaunchSet["executionMode"]>,
                })
              }
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Failure handling">
            <select
              className={settingsSelectClassName}
              value={launchSet.failureHandling ?? "notify"}
              onChange={(event) =>
                saveLaunchSet({
                  ...launchSet,
                  failureHandling: event.target.value as NonNullable<WorkspaceLaunchSet["failureHandling"]>,
                })
              }
            >
              <option value="continue">Continue quietly</option>
              <option value="notify">Continue and notify</option>
              <option value="stop">Stop sequence</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Restore behavior">
            <select
              className={settingsSelectClassName}
              value={launchSet.restoreBehavior ?? "continuity-then-launch"}
              onChange={(event) =>
                saveLaunchSet({
                  ...launchSet,
                  restoreBehavior: event.target.value as NonNullable<WorkspaceLaunchSet["restoreBehavior"]>,
                })
              }
            >
              <option value="continuity-then-launch">Continue, then launch</option>
              <option value="launch-only">Launch Set only</option>
              <option value="continuity-only">Continuity only</option>
            </select>
          </WorkspaceSettingsField>
          <WorkspaceSettingsField label="Workspace ready">
            <Button
              className="w-full"
              variant={launchSet.notifyWhenReady ? "secondary" : "ghost"}
              onClick={() => saveLaunchSet({ ...launchSet, notifyWhenReady: !launchSet.notifyWhenReady })}
            >
              {launchSet.notifyWhenReady ? "Notify when ready" : "No notification"}
            </Button>
          </WorkspaceSettingsField>
        </div>
        <div className="rounded-xl bg-[var(--karya-surface-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--karya-text)]">Add Launch Item</p>
              <p className="text-xs text-[var(--karya-muted)]">
                Applications and Workspace Resources share one ordered startup sequence.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge>{applicationOptions.length} applications</Badge>
              <Badge>{resourceOptions.length} resources</Badge>
            </div>
          </div>
          <div className="mt-3 flex w-fit rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-1">
            {(["application", "resource"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  selectedLaunchItemKind === kind
                    ? "bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
                    : "text-[var(--karya-muted)] hover:text-[var(--karya-text)]",
                )}
                onClick={() => setSelectedLaunchItemKind(kind)}
              >
                {kind === "application" ? "Applications" : "Resources"}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            {selectedLaunchItemKind === "application" ? (
              <select
                className={settingsSelectClassName}
                value={selectedApplicationId}
                onChange={(event) => setSelectedApplicationId(event.target.value)}
              >
                {!applicationOptions.length ? <option value="">No applications available to add</option> : null}
                {applicationOptions.map((application) => (
                  <option key={application.metadata.id} value={application.metadata.id}>
                    {application.metadata.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className={settingsSelectClassName}
                value={selectedResourceId}
                onChange={(event) => setSelectedResourceId(event.target.value)}
              >
                {!resourceOptions.length ? <option value="">No Workspace Resources available to add</option> : null}
                {resourceOptions.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {displayResourceTitle(resource)} · {isFolderResource(resource) ? "Folder" : resource.metadata.kind}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={selectedLaunchItemKind === "application" ? !selectedApplicationId : !selectedResourceId}
              onClick={selectedLaunchItemKind === "application" ? addApplication : addResource}
            >
              <Plus className="h-4 w-4" />
              {selectedLaunchItemKind === "application" ? "Add Application" : "Add Resource"}
            </Button>
          </div>
          {selectedLaunchItemKind === "resource" && selectedResource && !isFolderResource(selectedResource) ? (
            <div className="mt-2">
              <label className="text-xs font-medium text-[var(--karya-muted)]">
                Open with
                <select
                  className={`${settingsSelectClassName} mt-1`}
                  value={selectedResourceApplicationId}
                  onChange={(event) => setSelectedResourceApplicationId(event.target.value)}
                >
                  <option value="">Default application</option>
                  {availableApplications.map((application) => (
                    <option key={application.metadata.id} value={application.metadata.id}>
                      {application.metadata.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-[var(--karya-surface-muted)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--karya-text)]">Startup Sequence</p>
              <p className="text-xs text-[var(--karya-muted)]">
                {launchSet.executionMode === "parallel"
                  ? "Items launch independently; each delay is measured from startup."
                  : "Items launch top to bottom. Optional delays pace the sequence."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={launchSet.restoreInspector ? "secondary" : "ghost"}
                onClick={() => saveLaunchSet({ ...launchSet, restoreInspector: !launchSet.restoreInspector })}
              >
                {launchSet.restoreInspector ? "Restore inspector" : "Keep inspector closed"}
              </Button>
              <Badge>{launchSet.items.length} Launch Items</Badge>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {launchSet.items.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg bg-[var(--karya-control)] p-3",
                  item.enabled === false ? "opacity-60" : undefined,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--karya-text)]">
                      {launchItemTitle(item, resources, applications)}
                    </p>
                    <p className="text-xs text-[var(--karya-muted)]">
                      {item.kind === "application" ? "Application" : "Resource"} · {formatLaunchBehavior(item)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={item.enabled === false ? "ghost" : "secondary"}
                      onClick={() => updateItem(item.id, { enabled: item.enabled === false })}
                    >
                      {item.enabled === false ? "Enable" : "Enabled"}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label="Move earlier"
                      onClick={() => moveItem(item.id, -1)}
                    >
                      <ChevronLeft className="h-4 w-4 rotate-90" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === launchSet.items.length - 1}
                      aria-label="Move later"
                      onClick={() => moveItem(item.id, 1)}
                    >
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </Button>
                    {item.kind === "resource" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={launchSet.focusItemId === item.id ? "secondary" : "ghost"}
                        onClick={() => saveLaunchSet({ ...launchSet, focusItemId: item.id })}
                      >
                        Focus first
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove launch item"
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[var(--karya-muted)]">
                    Behavior
                    <select
                      className={`${settingsSelectClassName} mt-1`}
                      value={item.behavior}
                      onChange={(event) =>
                        updateItem(item.id, { behavior: event.target.value as WorkspaceLaunchSetItem["behavior"] })
                      }
                    >
                      {item.kind === "application" ? (
                        <>
                          <option value="launch">Launch normally</option>
                          <option value="reuse-existing">Reuse existing window</option>
                          <option value="skip-if-running">Skip if already running</option>
                        </>
                      ) : (
                        <>
                          <option value="open">Open</option>
                          <option value="reveal">Reveal only</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-[var(--karya-muted)]">
                    Delay
                    <select
                      className={`${settingsSelectClassName} mt-1`}
                      value={String(item.delayMs ?? 0)}
                      onChange={(event) => updateItem(item.id, { delayMs: Number(event.target.value) })}
                    >
                      <option value="0">No delay</option>
                      <option value="1000">Wait 1 second</option>
                      <option value="2000">Wait 2 seconds</option>
                      <option value="5000">Wait 5 seconds</option>
                    </select>
                  </label>
                  {item.kind === "resource" ? (
                    <label className="text-xs font-medium text-[var(--karya-muted)] sm:col-span-2">
                      Open with
                      <select
                        className={`${settingsSelectClassName} mt-1`}
                        value={item.applicationId ?? ""}
                        onChange={(event) => updateItem(item.id, { applicationId: event.target.value || undefined })}
                      >
                        <option value="">Default application</option>
                        {availableApplications.map((application) => (
                          <option key={application.metadata.id} value={application.metadata.id}>
                            {application.metadata.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
            {!launchSet.items.length ? (
              <p className="rounded-lg border border-dashed border-[var(--karya-border)] p-3 text-sm text-[var(--karya-muted)]">
                No Launch Items configured. Continue Working remains available independently.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {launchSetError ? (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{launchSetError}</p>
      ) : null}
    </Surface>
  );
}

const settingsSelectClassName =
  "min-h-9 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none transition focus:border-[var(--karya-accent)]";
const settingsInputClassName =
  "min-h-10 w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none transition placeholder:text-[var(--karya-subtle)] focus:border-[var(--karya-accent)]";

function createEmptyLaunchSet(): WorkspaceLaunchSet {
  return {
    enabled: false,
    items: [],
    restoreInspector: true,
    executionMode: "sequential",
    failureHandling: "notify",
    restoreBehavior: "continuity-then-launch",
    notifyWhenReady: false,
    updatedAt: new Date().toISOString(),
  };
}

function resolveWorkspaceSettings(settings?: WorkspaceSettings): WorkspaceSettings {
  return (
    settings ?? {
      appearance: {
        theme: "inherit",
        accentColor: "#2ab2a6",
        banner: "subtle",
        wallpaper: "grid",
        iconPack: "system",
        backgroundBlur: "subtle",
      },
      experience: {
        defaultLanding: "overview",
        resourceDisplay: "grid",
        resourceSort: "updated",
        notificationPreference: "important",
        searchPreference: "workspace",
        openBehavior: "restore-context",
      },
      continuity: {
        enabled: true,
        restorePreference: "full-context",
        rankingPreference: "balanced",
        resourcePriority: "active",
        restoreLayout: true,
      },
      preferences: {
        capturePreference: "workspace",
        relationshipPreference: "suggest",
        activityPreference: "meaningful",
        searchContextBoost: "workspace",
        synchronizationPreference: "inherit",
        offlinePreference: "local-first",
      },
    }
  );
}

function workspaceLandingPage(landing: WorkspaceSettings["experience"]["defaultLanding"]): WorkspacePage {
  return landing === "continue-working" ? "overview" : landing;
}

function exportWorkspaceManifest(workspace: KernelSnapshot["workspaces"]["all"][number]): void {
  const manifest = {
    format: "karya-workspace-manifest",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      name: workspace.name,
      metadata: workspace.metadata,
      settings: resolveWorkspaceSettings(workspace.settings),
      launchSet: workspace.launchSet,
      resourceRefs: workspace.resourceRefs,
      pinnedApplicationIds: workspace.pinnedApplicationIds,
    },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    workspace.name
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase() || "workspace"
  }.karya.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createLaunchItemId(): string {
  return `launch-item-${crypto.randomUUID()}`;
}

function launchItemTitle(
  item: WorkspaceLaunchSetItem,
  resources: ResourceSnapshot[],
  applications: ApplicationSnapshot[],
): string {
  if (item.kind === "application") {
    return (
      applications.find((application) => application.metadata.id === item.applicationId)?.metadata.name ??
      "Unavailable application"
    );
  }
  return resources.find((resource) => resource.id === item.resourceId)
    ? displayResourceTitle(resources.find((resource) => resource.id === item.resourceId)!)
    : "Unavailable resource";
}

function formatLaunchBehavior(item: WorkspaceLaunchSetItem): string {
  if (item.kind === "application") {
    if (item.behavior === "skip-if-running") return "Skip if already running";
    if (item.behavior === "reuse-existing") return "Reuse existing window";
    return "Launch normally";
  }
  if (item.behavior === "reveal") return "Reveal only";
  if (item.behavior === "skip") return "Do not auto-open";
  return item.behavior
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLaunchRestoreBehavior(behavior?: WorkspaceLaunchSet["restoreBehavior"]): string {
  if (behavior === "launch-only") return "Launch only";
  if (behavior === "continuity-only") return "Continuity only";
  return "Continue, then launch";
}

type SettingsPageKey = "appearance" | "sidebar" | "continue-working" | "about";

interface SettingsPageDefinition {
  key: SettingsPageKey;
  label: string;
  description: string;
  keywords: string[];
}

const SETTINGS_GROUPS: Array<{ label: string; pages: SettingsPageDefinition[] }> = [
  {
    label: "Desktop",
    pages: [
      {
        key: "appearance",
        label: "Appearance",
        description: "Theme, accent, typography, and motion for the desktop shell.",
        keywords: ["dark mode", "light mode", "accent", "font", "motion"],
      },
      {
        key: "sidebar",
        label: "Sidebar",
        description: "Navigation width for the desktop shell.",
        keywords: ["navigation", "width", "rail"],
      },
    ],
  },
  {
    label: "Productivity",
    pages: [
      {
        key: "continue-working",
        label: "Continue Working",
        description: "Configure the active Workspace launch configuration.",
        keywords: ["resume", "launch", "workspace", "applications", "resources"],
      },
    ],
  },
  {
    label: "About",
    pages: [
      {
        key: "about",
        label: "About Karya",
        description: "Desktop version and local shell status.",
        keywords: ["version", "desktop", "diagnostics"],
      },
    ],
  },
];

function SettingsApplication({
  onClose,
  onPreferencesChange,
  onResumeWorkspace,
  onUpdateWorkspaceLaunchSet,
  preferences,
  snapshot,
}: {
  onClose(): void;
  onPreferencesChange(preferences: DesktopPreferences): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
  onUpdateWorkspaceLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
  preferences: DesktopPreferences;
  snapshot: KernelSnapshot;
}): ReactElement {
  const allPages = SETTINGS_GROUPS.flatMap((group) => group.pages);
  const [activePage, setActivePage] = useState<SettingsPageKey>(() => {
    const saved = window.localStorage.getItem("karya.settings.activePage") as SettingsPageKey | null;
    return saved && allPages.some((page) => page.key === saved) ? saved : "appearance";
  });
  const [query, setQuery] = useState("");
  const active = allPages.find((page) => page.key === activePage) ?? allPages[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = normalizedQuery
    ? SETTINGS_GROUPS.map((group) => ({
        ...group,
        pages: group.pages.filter((page) =>
          [page.label, page.description, ...page.keywords].join(" ").toLowerCase().includes(normalizedQuery),
        ),
      })).filter((group) => group.pages.length > 0)
    : SETTINGS_GROUPS;

  useEffect(() => {
    window.localStorage.setItem("karya.settings.activePage", activePage);
  }, [activePage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-zinc-950/35 p-3 backdrop-blur-md md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="mx-auto grid h-full max-w-[1380px] overflow-hidden rounded-2xl border border-[var(--karya-border)] bg-[var(--karya-page)] shadow-[var(--karya-shadow-panel)] md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r border-[var(--karya-border)] bg-[var(--karya-surface)] p-4 md:flex md:flex-col">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="karya-section-label">Control Center</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--karya-text)]">Settings</h2>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close settings" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 text-sm text-[var(--karya-muted)]">
            <Search className="h-4 w-4" />
            <input
              className="min-w-0 flex-1 bg-transparent text-[var(--karya-text)] outline-none placeholder:text-[var(--karya-subtle)]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search settings..."
            />
          </label>
          <nav className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {visibleGroups.map((group) => (
              <section key={group.label}>
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--karya-subtle)]">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.pages.map((page) => (
                    <button
                      key={page.key}
                      type="button"
                      className={cn(
                        "karya-nav-item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                        activePage === page.key ? "karya-nav-item-active" : undefined,
                      )}
                      onClick={() => setActivePage(page.key)}
                    >
                      <SettingsPageIcon page={page.key} />
                      <span className="min-w-0 flex-1 truncate">{page.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <main className="min-h-0 overflow-y-auto p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--karya-muted)]">
                <span>Settings</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>
                  {SETTINGS_GROUPS.find((group) => group.pages.some((page) => page.key === active.key))?.label}
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[var(--karya-text)]">{active.label}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--karya-muted)]">{active.description}</p>
            </div>
            <div className="flex gap-2">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 text-sm text-[var(--karya-muted)] md:hidden">
                <Search className="h-4 w-4" />
                <input
                  className="w-36 bg-transparent text-[var(--karya-text)] outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                />
              </label>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          <SettingsPageContent
            page={activePage}
            preferences={preferences}
            snapshot={snapshot}
            onPreferencesChange={onPreferencesChange}
            onResumeWorkspace={onResumeWorkspace}
            onUpdateWorkspaceLaunchSet={onUpdateWorkspaceLaunchSet}
          />
        </main>
      </div>
    </div>
  );
}

function SettingsPageIcon({ page }: { page: SettingsPageKey }): ReactElement {
  if (page === "appearance") return <Sparkles className="h-4 w-4" />;
  if (page === "sidebar") return <List className="h-4 w-4" />;
  if (page === "continue-working") return <Command className="h-4 w-4" />;
  return <Settings className="h-4 w-4" />;
}

function SettingsPageContent({
  onPreferencesChange,
  onResumeWorkspace,
  onUpdateWorkspaceLaunchSet,
  page,
  preferences,
  snapshot,
}: {
  onPreferencesChange(preferences: DesktopPreferences): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
  onUpdateWorkspaceLaunchSet(workspaceId: string, launchSet: WorkspaceLaunchSet | undefined): void;
  page: SettingsPageKey;
  preferences: DesktopPreferences;
  snapshot: KernelSnapshot;
}): ReactElement {
  const updatePreferences = (updater: (current: DesktopPreferences) => DesktopPreferences) => {
    onPreferencesChange(updater(preferences));
  };

  if (page === "appearance") {
    return (
      <SettingsPageGrid>
        <SettingsSection title="Theme" description="Control Karya's visual mode and accent language.">
          <SettingsSegment
            label="Mode"
            options={["Light", "Dark", "System"]}
            value={capitalizeSettingValue(preferences.appearance.theme)}
            onChange={(value) =>
              updatePreferences((current) => ({
                ...current,
                appearance: { ...current.appearance, theme: value.toLowerCase() as DesktopThemeMode },
              }))
            }
          />
          <SettingsSegment
            label="Accent color"
            options={["Teal", "Graphite", "Blue", "Violet", "Amber"]}
            value={capitalizeSettingValue(preferences.appearance.accent)}
            onChange={(value) =>
              updatePreferences((current) => ({
                ...current,
                appearance: { ...current.appearance, accent: value.toLowerCase() as DesktopAccentColor },
              }))
            }
          />
        </SettingsSection>
        <SettingsSection
          title="Typography and Motion"
          description="These controls apply immediately across the desktop shell."
        >
          <SettingsRange
            label="Font scaling"
            max={1.16}
            min={0.9}
            step={0.02}
            value={preferences.appearance.fontScale}
            valueLabel={`${Math.round(preferences.appearance.fontScale * 100)}%`}
            onChange={(value) =>
              updatePreferences((current) => ({
                ...current,
                appearance: { ...current.appearance, fontScale: value },
              }))
            }
          />
          <SettingsToggle
            checked={preferences.appearance.reduceMotion}
            description="Remove page transitions, hover transitions, panel animation, and non-essential motion."
            label="Reduce motion"
            onChange={(checked) =>
              updatePreferences((current) => ({
                ...current,
                appearance: { ...current.appearance, reduceMotion: checked },
              }))
            }
          />
        </SettingsSection>
      </SettingsPageGrid>
    );
  }

  if (page === "sidebar") {
    return (
      <SettingsPageGrid>
        <SettingsSection title="Navigation" description="Control the main desktop navigation width.">
          <SettingsSegment
            label="Sidebar width"
            options={["Compact", "Standard", "Wide"]}
            value={capitalizeSettingValue(preferences.sidebar.width)}
            onChange={(value) =>
              updatePreferences((current) => ({
                ...current,
                sidebar: { ...current.sidebar, width: value.toLowerCase() as DesktopSidebarWidth },
              }))
            }
          />
          <SettingsValue label="Current width" value={sidebarWidthValue(preferences.sidebar.width)} />
        </SettingsSection>
      </SettingsPageGrid>
    );
  }

  if (page === "continue-working") {
    const activeWorkspace = snapshot.workspaces.active ?? snapshot.workspaces.all[0];
    const workspaceResources = activeWorkspace
      ? snapshot.resources.all.filter(
          (resource) =>
            isVisibleResource(resource) &&
            (resource.primaryWorkspaceId === activeWorkspace.id || resource.workspaceRefs.includes(activeWorkspace.id)),
        )
      : [];
    if (!activeWorkspace) {
      return (
        <SettingsPageGrid>
          <SettingsSection
            title="No Workspace Open"
            description="Open a Workspace before configuring Continue Working."
          >
            <SettingsValue label="Status" value="No active Workspace" />
          </SettingsSection>
        </SettingsPageGrid>
      );
    }
    return (
      <div className="space-y-4">
        <SettingsSection
          title="Continue Working"
          description="Restore the active Workspace's saved continuity independently from its Launch Set."
        >
          <Button variant="secondary" size="sm" onClick={() => onResumeWorkspace(activeWorkspace.id)}>
            Resume {displayWorkspaceName(activeWorkspace)}
          </Button>
        </SettingsSection>
        <WorkspaceLaunchSetSettings
          applications={snapshot.applications.installed}
          resources={workspaceResources}
          workspace={activeWorkspace}
          onResumeWorkspace={onResumeWorkspace}
          onUpdateLaunchSet={onUpdateWorkspaceLaunchSet}
        />
      </div>
    );
  }

  return (
    <SettingsPageGrid>
      <SettingsSection title="About Karya" description="Local desktop shell status.">
        <SettingsValue label="Version" value="0.1.0" />
        <SettingsValue label="Build" value="Desktop Shell" />
        <SettingsValue label="Profiles" value={String(snapshot.profiles.all.length)} />
        <SettingsValue label="Workspaces" value={String(snapshot.workspaces.all.length)} />
        <SettingsValue label="Resources indexed" value={String(snapshot.resources.activeCount)} />
        <SettingsValue label="Installed applications" value={String(snapshot.applications.installed.length)} />
      </SettingsSection>
    </SettingsPageGrid>
  );
}

function capitalizeSettingValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SettingsPageGrid({ children }: { children: ReactNode }): ReactElement {
  return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
}

function SettingsSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <h2 className="text-base font-semibold text-[var(--karya-text)]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--karya-muted)]">{description}</p>
      <div className="mt-5 divide-y divide-[var(--karya-border)]">{children}</div>
    </Surface>
  );
}

function SettingsToggle({
  checked: controlledChecked,
  description,
  enabled = false,
  label,
  onChange,
}: {
  checked?: boolean;
  description: string;
  enabled?: boolean;
  label: string;
  onChange?(checked: boolean): void;
}): ReactElement {
  const [internalChecked, setInternalChecked] = useState(enabled);
  const checked = controlledChecked ?? internalChecked;
  const handleChange = (next: boolean) => {
    if (controlledChecked === undefined) setInternalChecked(next);
    onChange?.(next);
  };
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--karya-text)]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--karya-muted)]">{description}</span>
      </span>
      <input
        className="sr-only"
        type="checkbox"
        checked={checked}
        onChange={(event) => handleChange(event.target.checked)}
      />
      <span
        className={cn(
          "flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition",
          checked
            ? "border-[var(--karya-accent)] bg-[var(--karya-accent)]/45"
            : "border-[var(--karya-border)] bg-[var(--karya-control)]",
        )}
      >
        <span
          className={cn(
            "h-4.5 w-4.5 h-4 w-4 rounded-full bg-[var(--karya-text)] shadow-[var(--karya-shadow-button)] transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </label>
  );
}

function SettingsSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange?(value: string): void;
  options: string[];
  value: string;
}): ReactElement {
  const [internalSelected, setInternalSelected] = useState(value);
  const selected = onChange ? value : internalSelected;
  return (
    <label className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm font-medium text-[var(--karya-text)]">{label}</span>
      <select
        className="min-w-44 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none"
        value={selected}
        onChange={(event) => {
          if (!onChange) setInternalSelected(event.target.value);
          onChange?.(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SettingsSegment({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange?(value: string): void;
  options: string[];
  value: string;
}): ReactElement {
  const [internalSelected, setInternalSelected] = useState(value);
  const selected = onChange ? value : internalSelected;
  return (
    <div className="py-3">
      <p className="mb-2 text-sm font-medium text-[var(--karya-text)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition",
              selected === option
                ? "border-[var(--karya-border-strong)] bg-[var(--karya-control-hover)] text-[var(--karya-text)]"
                : "border-[var(--karya-border)] bg-[var(--karya-control)] text-[var(--karya-muted)]",
            )}
            onClick={() => {
              if (!onChange) setInternalSelected(option);
              onChange?.(option);
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsSlider({ label, value }: { label: string; value: string }): ReactElement {
  const [amount, setAmount] = useState(value === "Medium" || value === "Comfortable" ? 55 : 35);
  return (
    <label className="block py-3">
      <span className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[var(--karya-text)]">{label}</span>
        <span className="text-xs text-[var(--karya-muted)]">{value}</span>
      </span>
      <input
        className="mt-3 w-full accent-[var(--karya-accent)]"
        type="range"
        min={0}
        max={100}
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
      />
    </label>
  );
}

function SettingsRange({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueLabel,
}: {
  label: string;
  max: number;
  min: number;
  onChange(value: number): void;
  step: number;
  value: number;
  valueLabel: string;
}): ReactElement {
  return (
    <label className="block py-3">
      <span className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[var(--karya-text)]">{label}</span>
        <span className="text-xs text-[var(--karya-muted)]">{valueLabel}</span>
      </span>
      <input
        className="mt-3 w-full accent-[var(--karya-accent)]"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function SettingsValue({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm font-medium text-[var(--karya-text)]">{label}</span>
      <span className="max-w-md text-right text-sm text-[var(--karya-muted)]">{value}</span>
    </div>
  );
}

function SettingsAction({ destructive = false, label }: { destructive?: boolean; label: string }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className={cn("text-sm font-medium", destructive ? "text-red-300" : "text-[var(--karya-text)]")}>
        {label}
      </span>
      <Button variant={destructive ? "ghost" : "secondary"} size="sm">
        {destructive ? "Review" : "Open"}
      </Button>
    </div>
  );
}

function SettingsShortcut({ label, shortcut }: { label: string; shortcut: string }): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm font-medium text-[var(--karya-text)]">{label}</span>
      <button
        type="button"
        className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-1.5 text-sm text-[var(--karya-text)]"
      >
        {shortcut}
      </button>
    </div>
  );
}

function SettingsIntegration({ label }: { label: string }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--karya-text)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--karya-muted)]">Not connected</p>
      </div>
      <Button variant="secondary" size="sm">
        Connect
      </Button>
    </div>
  );
}

function SettingsProfileCard({ snapshot }: { snapshot: KernelSnapshot }): ReactElement {
  const profile = snapshot.profiles.active ?? snapshot.profiles.all[0];
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--karya-surface-strong)] text-sm font-semibold text-[var(--karya-text)]">
        {profile?.name.slice(0, 1).toUpperCase() ?? "K"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--karya-text)]">{profile?.name ?? "Karya User"}</p>
        <p className="truncate text-xs text-[var(--karya-muted)]">{profile?.description ?? "Local account"}</p>
      </div>
    </div>
  );
}

function DefaultSpaceInboxOverview({
  onCreateNote,
  onCreateTask,
  onMoveResource,
  onOpenFolder,
  onOpenResource,
  onResourceContextMenu,
  onResumeResource,
  onSelectResource,
  resources,
  selectedResourceId,
  workspace,
}: {
  resources: ResourceSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  selectedResourceId?: string;
  onCreateNote(): void;
  onCreateTask(title?: string): Promise<{ id: string }>;
  onMoveResource(resource: ResourceSnapshot): void;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  onSelectResource(resourceId: string): void;
}): ReactElement {
  const inboxItems = resources.filter(isVisibleResource);
  const recentImports = inboxItems
    .filter((resource) => resource.tags.includes("imported") || readStringAttribute(resource, "contentSourcePath"))
    .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
    .slice(0, 5);
  const capturedItems = inboxItems
    .filter(
      (resource) =>
        resource.tags.some((tag) => ["capture", "captured", "intake", "temporary", "draft"].includes(tag)) ||
        resource.defaultSpace !== "none",
    )
    .sort((left, right) => right.metadata.createdAt.localeCompare(left.metadata.createdAt))
    .slice(0, 5);
  const unsortedResources = inboxItems
    .filter(
      (resource) =>
        !resource.primaryWorkspaceId ||
        resource.primaryWorkspaceId === workspace.id ||
        resource.workspaceRefs.length <= 1,
    )
    .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
    .slice(0, 6);
  const recentNotes = inboxItems
    .filter(isEditableNativeNote)
    .sort((left, right) => right.metadata.createdAt.localeCompare(left.metadata.createdAt))
    .slice(0, 4);

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface className="min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="karya-section-label">Inbox</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--karya-text)]">
                Unsorted work waiting for placement
              </h2>
              <p className="mt-1 text-sm text-[var(--karya-muted)]">
                Review captures, imports, and scratch notes before moving them into a Project.
              </p>
            </div>
            <Badge>{inboxItems.length} items</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InspectorRow label="Recent Imports" value={String(recentImports.length)} />
            <InspectorRow label="Captured Items" value={String(capturedItems.length)} />
            <InspectorRow label="Unsorted" value={String(unsortedResources.length)} />
          </div>
        </Surface>

        <Surface className="min-w-0 p-5">
          <p className="karya-section-label">Quick Capture</p>
          <div className="mt-4 grid gap-2">
            <Button className="justify-start" size="sm" onClick={() => void onCreateNote()}>
              <Pencil className="h-4 w-4" />
              Capture Note
            </Button>
            <Button
              className="justify-start"
              variant="secondary"
              size="sm"
              onClick={() => void onCreateTask("Inbox Task")}
            >
              <CheckSquare className="h-4 w-4" />
              Capture Task
            </Button>
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--karya-muted)]">
            New captures stay here until Karya or you place them into a Project.
          </p>
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InboxResourcePanel
          title="Recent Imports"
          description="Files and folders recently brought into Karya."
          empty="No recent imports in this inbox."
          resources={recentImports}
          workspace={workspace}
          onMoveResource={onMoveResource}
          onOpenFolder={onOpenFolder}
          onOpenResource={onOpenResource}
          onResourceContextMenu={onResourceContextMenu}
          onResumeResource={onResumeResource}
        />
        <InboxResourcePanel
          title="Captured Items"
          description="Scratch captures and temporary items that need review."
          empty="No captured items are waiting here."
          resources={capturedItems}
          workspace={workspace}
          onMoveResource={onMoveResource}
          onOpenFolder={onOpenFolder}
          onOpenResource={onOpenResource}
          onResourceContextMenu={onResourceContextMenu}
          onResumeResource={onResumeResource}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <InboxResourcePanel
          title="Move into Project"
          description="Unsorted Resources that should be assigned to a focused Project."
          empty="Everything in this inbox has been placed."
          resources={unsortedResources}
          workspace={workspace}
          selectedResourceId={selectedResourceId}
          showMoveAction
          onMoveResource={onMoveResource}
          onOpenFolder={onOpenFolder}
          onOpenResource={onOpenResource}
          onResourceContextMenu={onResourceContextMenu}
          onResumeResource={onResumeResource}
          onSelectResource={onSelectResource}
        />
        <InboxResourcePanel
          title="Recently Created Notes"
          description="Fresh notes captured before they have a permanent Project context."
          empty="No notes have been captured here yet."
          resources={recentNotes}
          workspace={workspace}
          onMoveResource={onMoveResource}
          onOpenFolder={onOpenFolder}
          onOpenResource={onOpenResource}
          onResourceContextMenu={onResourceContextMenu}
          onResumeResource={onResumeResource}
        />
      </div>
    </section>
  );
}

function InboxResourcePanel({
  description,
  empty,
  onMoveResource,
  onOpenFolder,
  onOpenResource,
  onResourceContextMenu,
  onResumeResource,
  onSelectResource,
  resources,
  selectedResourceId,
  showMoveAction = false,
  title,
  workspace,
}: {
  title: string;
  description: string;
  empty: string;
  resources: ResourceSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  selectedResourceId?: string;
  showMoveAction?: boolean;
  onMoveResource(resource: ResourceSnapshot): void;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  onSelectResource?(resourceId: string): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--karya-text)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--karya-muted)]">{description}</p>
        </div>
        <Badge>{resources.length}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {resources.map((resource) => (
          <div
            key={`${title}:${resource.id}`}
            className={cn(
              "rounded-lg bg-[var(--karya-control)] p-2 shadow-[var(--karya-shadow-button)]",
              selectedResourceId === resource.id ? "ring-1 ring-[var(--karya-ring)]" : undefined,
            )}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  onSelectResource ? onSelectResource(resource.id) : onResumeResource(resource.id, workspace.id)
                }
                onDoubleClick={() =>
                  isFolderResource(resource) ? onOpenFolder(resource.id) : onOpenResource(resource.id)
                }
                onContextMenu={(event) => onResourceContextMenu(event, resource)}
              >
                <p className="truncate text-sm font-medium text-[var(--karya-text)]">
                  {displayResourceTitle(resource)}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--karya-muted)]">
                  {resource.metadata.kind} · {formatShortDate(resource.metadata.updatedAt)}
                </p>
              </button>
              {showMoveAction ? (
                <Button size="sm" variant="secondary" onClick={() => onMoveResource(resource)}>
                  <FolderInput className="h-4 w-4" />
                  Move
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!resources.length ? <p className="text-sm text-[var(--karya-muted)]">{empty}</p> : null}
      </div>
    </Surface>
  );
}

function BriefingResumePanel({
  applications,
  onResourceContextMenu,
  onResumeResource,
  onResumeWorkspace,
  resources,
  session,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  resources: ResourceSnapshot[];
  session?: KernelSnapshot["continuity"]["activeWorkspaceSession"];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  onResumeWorkspace: ResumeWorkspaceHandler;
}): ReactElement {
  const lastEditedActivity = session?.activityTimeline.find((activity) => activity.type === "resource-edited");
  const lastResource =
    (lastEditedActivity?.resourceId
      ? resources.find((resource) => resource.id === lastEditedActivity.resourceId)
      : undefined) ?? resources[0];
  const lastActiveAt = session?.lastActiveAt ?? lastResource?.metadata.updatedAt;
  const estimatedDuration = session ? formatSessionDuration(session.startedAt, session.lastActiveAt) : "No session yet";
  const appNames = applications.map((application) => application.metadata.name).slice(0, 3);

  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Resume Working</h2>
          <p className="mt-1 text-xs text-zinc-500">Restore the last working state for this Workspace.</p>
        </div>
        <Badge>{session ? "Session saved" : `${resources.length} items`}</Badge>
      </div>

      <button
        type="button"
        className="karya-interactive mt-4 w-full rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-4 text-left transition-colors hover:border-[var(--karya-border-strong)] hover:bg-[var(--karya-control-hover)]"
        onClick={() => onResumeWorkspace(workspace.id)}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--karya-text)]">
              {lastResource ? displayResourceTitle(lastResource) : displayWorkspaceName(workspace)}
            </p>
            <p className="mt-1 text-xs text-[var(--karya-muted)]">
              {appNames.length ? `Apps: ${appNames.join(", ")}` : "No applications captured yet"}
            </p>
          </div>
          <Badge>{lastActiveAt ? formatRelativeTime(lastActiveAt) : "New"}</Badge>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-[var(--karya-muted)] sm:grid-cols-3">
          <span>Selected: {lastResource ? lastResource.metadata.kind : "Workspace overview"}</span>
          <span>Duration: {estimatedDuration}</span>
          <span>Open items: {session?.activeResourceIds.length ?? resources.length}</span>
        </div>
      </button>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {resources.map((resource) => (
          <BriefingResourceButton
            key={`recent:${resource.id}`}
            resource={resource}
            subtitle={`Updated ${formatShortDate(resource.metadata.updatedAt)}`}
            onClick={() => onResumeResource(resource.id, workspace.id)}
            onContextMenu={onResourceContextMenu}
          />
        ))}
      </div>
      {!resources.length ? (
        <p className="mt-4 text-sm text-zinc-500">
          No resumable resource interactions have been captured for this Workspace yet.
        </p>
      ) : null}
    </Surface>
  );
}

function RecentApplicationsPanel({
  applications,
  onApplicationContextMenu,
  onLaunchApplication,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recent Applications</h2>
          <p className="mt-1 text-xs text-zinc-500">Applications recently launched in this Workspace.</p>
        </div>
        <Badge>{applications.length}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {applications.map((application) => (
          <button
            key={application.metadata.id}
            type="button"
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
            onClick={() =>
              onLaunchApplication(application.metadata.id, {
                workspaceId: workspace.id,
                profileId: workspace.profileId,
              })
            }
            onContextMenu={(event) => onApplicationContextMenu(event, application)}
          >
            <p className="truncate text-sm font-medium">{application.metadata.name}</p>
            <p className="mt-1 truncate text-xs text-zinc-500">{application.metadata.category ?? "Application"}</p>
          </button>
        ))}
      </div>
      {!applications.length ? (
        <p className="mt-4 text-sm text-zinc-500">No applications have been launched from this Workspace yet.</p>
      ) : null}
    </Surface>
  );
}

function RecentResourcesPanel({
  onResourceContextMenu,
  onResumeResource,
  resources,
  workspace,
}: {
  resources: ResourceSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recent Resources</h2>
          <p className="mt-1 text-xs text-zinc-500">Recently updated work in this Workspace.</p>
        </div>
        <Badge>{resources.length}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {resources.map((resource) => (
          <BriefingResourceButton
            key={`updated:${resource.id}`}
            resource={resource}
            subtitle={`Updated ${formatShortDate(resource.metadata.updatedAt)}`}
            onClick={() => onResumeResource(resource.id, workspace.id)}
            onContextMenu={onResourceContextMenu}
          />
        ))}
        {!resources.length ? <p className="text-sm text-zinc-500">No recent resources in this Workspace yet.</p> : null}
      </div>
    </Surface>
  );
}

function UpcomingTasksPanel({
  onCompleteTask,
  onOpenTasks,
  tasks,
}: {
  tasks: ResourceSnapshot[];
  onCompleteTask(resourceId: string): void;
  onOpenTasks(taskId?: string): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Upcoming Tasks</h2>
          <p className="mt-1 text-xs text-zinc-500">Tasks with due dates that are still open.</p>
        </div>
        <Badge>{tasks.length}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {tasks.map((task) => {
          const dueDate = readStringAttribute(task, "taskDueDate");
          return (
            <div key={task.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenTasks(task.id)}>
                <p className="truncate text-sm font-medium">{task.metadata.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {dueDate ? formatTaskDateLabel(dueDate) : "No due date"} ·{" "}
                  {formatTaskPriority(readTaskPriority(task))}
                </p>
              </button>
              <Button size="sm" variant="ghost" onClick={() => onCompleteTask(task.id)}>
                Done
              </Button>
            </div>
          );
        })}
        {!tasks.length ? <p className="text-sm text-zinc-500">No upcoming tasks are scheduled.</p> : null}
      </div>
    </Surface>
  );
}

function BriefingResourceButton({
  onClick,
  onContextMenu,
  resource,
  subtitle,
}: {
  resource: ResourceSnapshot;
  subtitle: string;
  onClick(): void;
  onContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
}): ReactElement {
  return (
    <button
      type="button"
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
      onClick={onClick}
      onContextMenu={(event) => onContextMenu(event, resource)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">{displayResourceTitle(resource)}</p>
        <Badge>{resource.metadata.kind}</Badge>
      </div>
      <p className="mt-1 truncate text-xs text-zinc-500">{subtitle}</p>
    </button>
  );
}

function TodaysFocusPanel({
  dueTasks,
  notifications,
  onCompleteTask,
  onOpenTasks,
  upcomingEvents,
}: {
  dueTasks: ResourceSnapshot[];
  notifications: KaryaNotification[];
  upcomingEvents: EventSnapshot[];
  onCompleteTask(resourceId: string): void;
  onOpenTasks(taskId?: string): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Today's Focus</h2>
          <p className="mt-1 text-xs text-zinc-500">Due tasks, meetings, and notifications that need attention.</p>
        </div>
        <Badge>{dueTasks.length + upcomingEvents.length + notifications.length}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {dueTasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenTasks(task.id)}>
              <p className="truncate text-sm font-medium">{task.metadata.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{isTaskOverdue(task) ? "Overdue" : "Due today"}</p>
            </button>
            <Button size="sm" variant="ghost" onClick={() => onCompleteTask(task.id)}>
              Done
            </Button>
          </div>
        ))}
        {upcomingEvents.map((event) => (
          <div key={event.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="truncate text-sm font-medium">{event.metadata.title}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {readCalendarTimeLabel(event)} · {formatCalendarCategory(readCalendarCategory(event))}
            </p>
          </div>
        ))}
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="truncate text-sm font-medium">{notification.title}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {notification.category} · {notification.status}
            </p>
          </div>
        ))}
        {!dueTasks.length && !upcomingEvents.length && !notifications.length ? (
          <p className="text-sm text-zinc-500">No urgent Workspace items right now.</p>
        ) : null}
      </div>
    </Surface>
  );
}

function ConnectedWorkBriefing({
  onOpenResource,
  snapshot,
  workspaceId,
}: {
  snapshot: KernelSnapshot;
  workspaceId: string;
  onOpenResource(resourceId: string): void;
}): ReactElement {
  const connected = [
    ...snapshot.events.all.filter(
      (event) =>
        event.lifecycleState !== "deleted" &&
        (event.workspaceRefs.includes(workspaceId) || event.primaryWorkspaceId === workspaceId),
    ),
    ...snapshot.resources.all.filter(
      (resource) => resource.workspaceRefs.includes(workspaceId) || resource.primaryWorkspaceId === workspaceId,
    ),
  ]
    .flatMap((object) =>
      object.relationships.map((relationship) => ({ object, relationship, target: relationshipTarget(relationship) })),
    )
    .slice(0, 6);

  return (
    <Surface className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Connected Work</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Relationships across meetings, notes, tasks, files, and bookmarks.
          </p>
        </div>
        <Badge>{connected.length}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {connected.length ? (
          connected.map(({ object, relationship, target }) => (
            <button
              key={`${object.id}:${relationship.id}`}
              type="button"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
              onClick={() => {
                if (target.type === "resource") onOpenResource(target.id);
              }}
            >
              <p className="truncate text-sm font-medium">{displayKaryaObjectTitle(object)}</p>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {formatRelationshipType(relationship.type)} · {relationshipTargetTitle(snapshot, target)}
              </p>
            </button>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No relationship graph has formed in this Workspace yet.</p>
        )}
      </div>
    </Surface>
  );
}

function formatSessionDuration(startedAt: string, lastActiveAt: string): string {
  const durationMs = Math.max(0, new Date(lastActiveAt).getTime() - new Date(startedAt).getTime());
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function PinnedResourcesBriefing({
  onOpenFolder,
  onOpenResource,
  onResourceContextMenu,
  onSelectResource,
  resources,
  selectedResourceId,
}: {
  resources: ResourceSnapshot[];
  selectedResourceId?: string;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onSelectResource(resourceId: string): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Pinned Resources</h2>
        <Badge>{resources.length}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        {resources.length ? (
          resources.map((resource) => (
            <button
              key={resource.id}
              type="button"
              className={cn(
                "rounded-lg border bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300",
                selectedResourceId === resource.id ? "border-zinc-950" : "border-zinc-200",
              )}
              onClick={() => onSelectResource(resource.id)}
              onDoubleClick={() =>
                isFolderResource(resource) ? onOpenFolder(resource.id) : onOpenResource(resource.id)
              }
              onContextMenu={(event) => onResourceContextMenu(event, resource)}
            >
              <p className="truncate text-sm font-medium">{displayResourceTitle(resource)}</p>
              <p className="mt-1 text-xs text-zinc-500">{resource.metadata.kind}</p>
            </button>
          ))
        ) : (
          <p className="text-sm text-zinc-500">Pin notes, tasks, files, or bookmarks to keep them one click away.</p>
        )}
      </div>
    </Surface>
  );
}

function UpcomingScheduleBriefing({ events }: { events: EventSnapshot[] }): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Upcoming Meetings</h2>
        <Badge>{events.length}</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {events.map((event) => (
          <div key={event.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="truncate text-sm font-medium">{event.metadata.title}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatCalendarDateRange(event)} · {readCalendarTimeLabel(event)}
            </p>
          </div>
        ))}
        {!events.length ? <p className="text-sm text-zinc-500">No upcoming meetings are scheduled.</p> : null}
      </div>
    </Surface>
  );
}

function WorkspaceBriefingInsights({
  activities,
  events,
  resources,
  tasks,
}: {
  activities: KaryaActivity[];
  events: EventSnapshot[];
  resources: ResourceSnapshot[];
  tasks: ResourceSnapshot[];
}): ReactElement {
  const completedTasks = tasks.filter((task) => readTaskStatus(task) === "completed").length;
  const updatedResources = resources.filter(
    (resource) => resource.metadata.updatedAt.slice(0, 10) === todayDateKey(),
  ).length;
  const newBookmarks = resources
    .filter(isBookmarkResource)
    .filter((resource) => resource.metadata.createdAt.slice(0, 10) === todayDateKey()).length;
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Workspace Insights</h2>
        <Badge>{activities.length} events</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <InsightStat label="Tasks Done" value={completedTasks} />
        <InsightStat label="Meetings" value={events.length} />
        <InsightStat label="Updated" value={updatedResources} />
        <InsightStat label="Bookmarks" value={newBookmarks} />
      </div>
    </Surface>
  );
}

type WorkspaceBriefingSearchResult =
  | { id: string; type: "resource"; title: string; subtitle: string; resource: ResourceSnapshot }
  | { id: string; type: "event"; title: string; subtitle: string; event: EventSnapshot };

function WorkspaceScopedSearch({
  events,
  onOpenEvent,
  onOpenFolder,
  onOpenResource,
  onQueryChange,
  onSelectResource,
  query,
  resources,
  results,
}: {
  events: EventSnapshot[];
  resources: ResourceSnapshot[];
  results: WorkspaceBriefingSearchResult[];
  query: string;
  onOpenEvent(eventId: string): void;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onSelectResource(resourceId: string): void;
  onQueryChange(query: string): void;
}): ReactElement {
  const visible = query.trim()
    ? results
    : [
        ...resources.slice(0, 3).map((resource): WorkspaceBriefingSearchResult => ({
          id: `resource:${resource.id}`,
          type: "resource",
          title: displayResourceTitle(resource),
          subtitle: resource.metadata.kind,
          resource,
        })),
        ...events.slice(0, 2).map((event): WorkspaceBriefingSearchResult => ({
          id: `event:${event.id}`,
          type: "event",
          title: event.metadata.title,
          subtitle: "Calendar Event",
          event,
        })),
      ];

  return (
    <Surface className="min-w-0 p-5">
      <h2 className="text-sm font-semibold">Workspace Search</h2>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
          placeholder="Search this Workspace..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="mt-3 space-y-2">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
            onClick={() => {
              if (item.type === "resource") {
                onSelectResource(item.resource.id);
                if (isFolderResource(item.resource)) onOpenFolder(item.resource.id);
                return;
              }
              onOpenEvent(item.event.id);
            }}
            onDoubleClick={() => {
              if (item.type === "resource" && !isFolderResource(item.resource)) onOpenResource(item.resource.id);
            }}
          >
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{item.subtitle}</p>
          </button>
        ))}
        {!visible.length ? <p className="text-sm text-zinc-500">No Workspace results match this search.</p> : null}
      </div>
    </Surface>
  );
}

function WorkspaceApplicationsBriefing({
  applications,
  onAddApplication,
  onApplicationContextMenu,
  onLaunchApplication,
  workspace,
}: {
  applications: ApplicationSnapshot[];
  workspace: KernelSnapshot["workspaces"]["all"][number];
  onAddApplication(workspace: KernelSnapshot["workspaces"]["all"][number]): void;
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
}): ReactElement {
  return (
    <Surface className="min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Workspace Applications</h2>
        <Button variant="ghost" size="sm" onClick={() => onAddApplication(workspace)}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {applications.length ? (
          applications.map((application) => (
            <button
              key={application.metadata.id}
              type="button"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
              onClick={() =>
                onLaunchApplication(application.metadata.id, {
                  workspaceId: workspace.id,
                  profileId: workspace.profileId,
                })
              }
              onContextMenu={(event) => onApplicationContextMenu(event, application)}
            >
              <p className="truncate text-sm font-medium">{application.metadata.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{application.metadata.category ?? "Application"}</p>
            </button>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No applications are attached to this Workspace.</p>
        )}
      </div>
    </Surface>
  );
}

function filterWorkspaceBriefingSearch(
  query: string,
  resources: ResourceSnapshot[],
  events: EventSnapshot[],
): WorkspaceBriefingSearchResult[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  const resourceResults = resources
    .filter((resource) =>
      [
        displayResourceTitle(resource),
        resource.metadata.title,
        resource.metadata.description ?? "",
        readStringAttribute(resource, "contentSourcePath") ?? "",
        resource.metadata.kind,
        ...resource.tags,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    )
    .map((resource): WorkspaceBriefingSearchResult => ({
      id: `resource:${resource.id}`,
      type: "resource",
      title: displayResourceTitle(resource),
      subtitle: resource.metadata.kind,
      resource,
    }));
  const eventResults = events
    .filter((event) =>
      [event.metadata.title, event.metadata.description ?? "", readCalendarCategory(event), ...event.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term),
    )
    .map((event): WorkspaceBriefingSearchResult => ({
      id: `event:${event.id}`,
      type: "event",
      title: event.metadata.title,
      subtitle: "Calendar Event",
      event,
    }));
  return [...resourceResults, ...eventResults];
}

function WorkspaceDashboard({
  onArchive,
  onDelete,
  onOpenFolder,
  onOpenResource,
  onPin,
  onRename,
  onRestore,
  onResumeResource,
  onResourceContextMenu,
  onSelectResource,
  resources,
  selectedResourceId,
  snapshot,
  workspace,
}: WorkspaceDashboardProps): ReactElement {
  const isDesktopWorkspace = workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID;
  const ownerProfile = snapshot.profiles.all.find((profile) => profile.id === workspace.profileId);
  const isDefaultSpace = isDesktopWorkspace || ownerProfile?.defaultSpaceId === workspace.id;
  const isArchived = workspace.lifecycleState === "archived";
  const recentResources = snapshot.resources.recent
    .filter((resource) => resource.workspaceRefs.includes(workspace.id))
    .slice(0, 4);
  const timelineResources = [...resources]
    .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
    .slice(0, 5);
  const workspaceInsights = snapshot.continuity.workspaceInsightsByWorkspace[workspace.id];

  return (
    <div className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto pr-1">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                {isDesktopWorkspace ? "Desktop Default Space" : isDefaultSpace ? "Default Space" : "Workspace"}
              </Badge>
              <Badge>{isDesktopWorkspace ? "Desktop" : (ownerProfile?.name ?? workspace.profileId)}</Badge>
              <Badge>{workspace.lifecycleState}</Badge>
              {workspace.pinned ? <Badge>Pinned</Badge> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{displayWorkspaceName(workspace)}</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-500">
              {workspace.metadata.description ??
                (isDefaultSpace
                  ? "Profile inbox for temporary resources, captures, imports, and unorganized work."
                  : "Focused work environment for resources, notes, tasks, activity, and continuity.")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={isArchived} onClick={() => onRename(workspace)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isArchived}
              onClick={() => onPin(workspace.id, !workspace.pinned)}
            >
              {workspace.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
              {workspace.pinned ? "Unpin" : "Pin"}
            </Button>
            {isArchived ? (
              <Button variant="secondary" size="sm" onClick={() => onRestore(workspace.id)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </Button>
            ) : !isDefaultSpace ? (
              <Button variant="ghost" size="sm" onClick={() => onArchive(workspace.id)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            ) : null}
            {!isDefaultSpace ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Delete ${workspace.name} permanently?`)) {
                    onDelete(workspace.id);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <ProfileStat
          label="Active Resources"
          value={String(resources.filter((resource) => resource.lifecycleState === "active").length)}
        />
        <ProfileStat label="Recent Items" value={String(recentResources.length)} />
        <ProfileStat label="Pinned Apps" value={String(workspace.pinnedApplicationIds.length)} />
        <ProfileStat
          label="Last Opened"
          value={workspace.lastOpenedAt ? formatShortDate(workspace.lastOpenedAt) : "New"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Surface className="min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Active Resources</h2>
            <Badge>{resources.length} total</Badge>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {resources.length ? (
              resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => {
                    if (isFolderResource(resource)) {
                      onOpenFolder(resource.id);
                      return;
                    }
                    onSelectResource(resource.id);
                  }}
                  onDoubleClick={() => {
                    if (isFolderResource(resource)) {
                      onOpenFolder(resource.id);
                      return;
                    }
                    onOpenResource(resource.id);
                  }}
                  onContextMenu={(event) => onResourceContextMenu(event, resource)}
                  className={cn(
                    "min-h-28 rounded-lg border bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300",
                    selectedResourceId === resource.id ? "border-zinc-950" : "border-zinc-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge>{resource.metadata.kind}</Badge>
                    <span className="text-xs text-zinc-400">{formatShortDate(resource.metadata.updatedAt)}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 font-medium">{displayResourceTitle(resource)}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{resource.metadata.description}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No resources are referenced by this Workspace yet.</p>
            )}
          </div>
        </Surface>

        <div className="min-w-0 space-y-4">
          <NotificationSummaryPanel snapshot={snapshot} workspaceId={workspace.id} compact />
          <ActivityCenterPanel snapshot={snapshot} workspaceId={workspace.id} title="Workspace Activity" compact />

          <Surface className="min-w-0 p-5">
            <h2 className="text-sm font-semibold">Continue Working</h2>
            <div className="mt-4 space-y-2">
              {recentResources.length ? (
                recentResources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => onResumeResource(resource.id, workspace.id)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
                  >
                    <p className="truncate font-medium">{displayResourceTitle(resource)}</p>
                    <p className="mt-1 text-xs text-zinc-500">{resource.metadata.kind}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No recent resources in this Workspace.</p>
              )}
            </div>
          </Surface>

          <Surface className="min-w-0 p-5">
            <WorkspaceInsightsPanel insights={workspaceInsights} />
          </Surface>
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <p className="mt-3 text-sm text-zinc-500">Task modules will attach to this Workspace.</p>
        </Surface>
        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="mt-3 text-sm text-zinc-500">Notes will live inside this Workspace context.</p>
        </Surface>
        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Resource Timeline</h2>
          <p className="mt-3 text-sm text-zinc-500">
            {timelineResources.length} recent resource changes are visible above.
          </p>
        </Surface>
      </section>
    </div>
  );
}

interface DesktopHomeDashboardProps {
  dismissedInterruptedSessionId?: string;
  snapshot: KernelSnapshot;
  onApplicationContextMenu(event: MouseEvent, application: ApplicationSnapshot): void;
  onCreateNote(): void;
  onCreateTask(title?: string): void;
  onCreateProfile(): void;
  onCreateResource(): void;
  onDismissInterruptedSession(): void;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
  onOpenFolder(resourceId: string): void;
  onOpenProfile(profileId: string): void;
  onOpenResource(resourceId: string): void;
  onOpenSearch(): void;
  onOpenWorkspace(workspaceId: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
}

function DesktopHomeDashboard({
  dismissedInterruptedSessionId,
  onApplicationContextMenu,
  onCreateNote,
  onCreateProfile,
  onCreateResource,
  onDismissInterruptedSession,
  onLaunchApplication,
  onOpenFolder,
  onOpenProfile,
  onOpenResource,
  onOpenSearch,
  onOpenWorkspace,
  onResourceContextMenu,
  onResumeResource,
  snapshot,
}: DesktopHomeDashboardProps): ReactElement {
  const hasProfile = snapshot.profiles.all.some((profile) => (profile.lifecycleState ?? "active") === "active");
  const hasWorkspace = snapshot.workspaces.all.some(
    (workspace) => workspace.lifecycleState !== "archived" && workspace.lifecycleState !== "deleted",
  );
  const workspaceSessionEntries = Object.values(snapshot.continuity.currentSession?.workspaceSessions ?? {}).sort(
    (left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt),
  );
  const continueWorkingResources = snapshot.continuity.continueWorking
    .map((item) => snapshot.resources.all.find((resource) => resource.id === item.resourceId))
    .filter(isVisibleResource)
    .slice(0, 6);
  const recentImports = snapshot.resources.all
    .filter((resource) => resource.lifecycleState !== "deleted" && resource.tags.includes("imported"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 4);
  const recentProfiles = snapshot.profiles.recent.slice(0, 4);
  const desktopDefaultSpace = getDesktopHomeDefaultSpace(snapshot);
  const recentWorkspaces = workspaceSessionEntries
    .map((session) => snapshot.workspaces.all.find((workspace) => workspace.id === session.workspaceId))
    .filter((workspace): workspace is KernelSnapshot["workspaces"]["all"][number] => Boolean(workspace))
    .filter((workspace) => workspace.id !== DESKTOP_HOME_DEFAULT_SPACE_ID && workspace.lifecycleState !== "deleted")
    .slice(0, 4);
  const interruptedWorkspace =
    snapshot.continuity.interruptedSession?.workspaceId === dismissedInterruptedSessionId
      ? undefined
      : snapshot.workspaces.all.find(
          (workspace) => workspace.id === snapshot.continuity.interruptedSession?.workspaceId,
        );

  return (
    <div className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto pr-1">
      {interruptedWorkspace ? (
        <Surface className="min-w-0 border-zinc-300 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-400">Interrupted Session</p>
              <h2 className="mt-1 text-lg font-semibold">Resume {displayWorkspaceName(interruptedWorkspace)}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Restore the last active Workspace context, selected resource, and folder navigation.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onOpenWorkspace(interruptedWorkspace.id)}>
                Resume Previous Session
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismissInterruptedSession}>
                Dismiss
              </Button>
            </div>
          </div>
        </Surface>
      ) : null}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Your work</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Continue where you left off</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Resume focused work, capture what matters, or find anything without rebuilding your context.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!hasProfile ? (
              <Button size="sm" onClick={onCreateProfile}>
                <Plus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={onOpenSearch}>
                  <Search className="mr-2 h-4 w-4" />
                  Search work
                </Button>
                {hasWorkspace ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => void onCreateNote()}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Quick capture
                    </Button>
                    <Button variant="secondary" size="sm" onClick={onCreateResource}>
                      <Plus className="mr-2 h-4 w-4" />
                      More ways to create
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      <NotificationSummaryPanel snapshot={snapshot} />
      <ActivityCenterPanel snapshot={snapshot} />

      {desktopDefaultSpace ? (
        <Surface className="min-w-0 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Desktop Default Space</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Desktop-level inbox for imports that do not belong to a Profile yet.
              </p>
            </div>
            <Badge>{snapshot.workspaces.resourceCountByWorkspace[desktopDefaultSpace.id] ?? 0} resources</Badge>
          </div>
          <button
            type="button"
            onClick={() => onOpenWorkspace(desktopDefaultSpace.id)}
            className="mt-4 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition-colors hover:border-zinc-300"
          >
            <div className="flex items-center gap-3">
              <Inbox className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="font-medium">Default Space</p>
                <p className="mt-1 text-xs text-zinc-500">{desktopDefaultSpace.metadata.description}</p>
              </div>
            </div>
          </button>
        </Surface>
      ) : null}

      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Surface className="min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Continue Working</h2>
            <Badge>{snapshot.workspaces.active?.name ?? "Current context"}</Badge>
          </div>
          <div className="space-y-2">
            {continueWorkingResources.length ? (
              continueWorkingResources.map((resource) => (
                <ResourceActionRow
                  key={resource.id}
                  resource={resource}
                  snapshot={snapshot}
                  onOpenFolder={onOpenFolder}
                  onOpenResource={onOpenResource}
                  onResourceContextMenu={onResourceContextMenu}
                  onResumeResource={onResumeResource}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500">No recent resources yet.</p>
            )}
          </div>
        </Surface>

        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Pinned Applications</h2>
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
            {snapshot.applications.pinned.length ? (
              snapshot.applications.pinned.map((application) => (
                <button
                  key={application.metadata.id}
                  type="button"
                  onClick={() => onLaunchApplication(application.metadata.id)}
                  onContextMenu={(event) => onApplicationContextMenu(event, application)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
                >
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-zinc-500" />
                    <p className="font-medium">{application.metadata.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{application.metadata.category ?? "Application"}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No pinned applications.</p>
            )}
          </div>
        </Surface>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Recent Profiles</h2>
          <div className="mt-4 space-y-2">
            {recentProfiles.length ? (
              recentProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onOpenProfile(profile.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold text-white"
                    style={{ backgroundColor: profile.accentColor ?? "#18181b" }}
                  >
                    {profile.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{profile.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{profile.description ?? "Profile"}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No recent profiles.</p>
            )}
          </div>
        </Surface>

        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Recent Workspaces</h2>
          <div className="mt-4 space-y-2">
            {recentWorkspaces.length ? (
              recentWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => onOpenWorkspace(workspace.id)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{displayWorkspaceName(workspace)}</p>
                    <Badge>{workspace.lifecycleState}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {profileNameForWorkspace(snapshot, workspace.profileId)}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No recent workspaces.</p>
            )}
          </div>
        </Surface>

        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Recent Imports</h2>
          <div className="mt-4 space-y-2">
            {recentImports.length ? (
              recentImports.map((resource) => (
                <ResourceActionRow
                  key={resource.id}
                  compact
                  resource={resource}
                  snapshot={snapshot}
                  onOpenFolder={onOpenFolder}
                  onOpenResource={onOpenResource}
                  onResourceContextMenu={onResourceContextMenu}
                  onResumeResource={onResumeResource}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500">No imports yet.</p>
            )}
          </div>
        </Surface>
      </section>
    </div>
  );
}

function ResourceActionRow({
  compact = false,
  onOpenFolder,
  onOpenResource,
  onResourceContextMenu,
  onResumeResource,
  resource,
  snapshot,
}: {
  compact?: boolean;
  onOpenFolder(resourceId: string): void;
  onOpenResource(resourceId: string): void;
  onResourceContextMenu(event: MouseEvent, resource: ResourceSnapshot): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  resource: ResourceSnapshot;
  snapshot: KernelSnapshot;
}): ReactElement {
  const workspaceId = resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  const locationLabel = resourceLocationLabel(snapshot, resource, workspaceId);

  return (
    <button
      type="button"
      onClick={() => onResumeResource(resource.id, workspaceId)}
      onDoubleClick={() => {
        if (isFolderResource(resource)) {
          onOpenFolder(resource.id);
          return;
        }
        onOpenResource(resource.id);
      }}
      onContextMenu={(event) => onResourceContextMenu(event, resource)}
      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-medium">{displayResourceTitle(resource)}</p>
        <Badge>{resource.metadata.kind}</Badge>
      </div>
      <p className={cn("mt-1 truncate text-zinc-500", compact ? "text-xs" : "text-sm")}>{locationLabel}</p>
    </button>
  );
}

function NotificationCenter({
  onArchive,
  onClose,
  onCompleteTask,
  onDelete,
  onMarkRead,
  onOpenResource,
  onOpenWorkspace,
  snapshot,
}: {
  snapshot: KernelSnapshot;
  onArchive(notificationId: string): void;
  onClose(): void;
  onCompleteTask(resourceId: string): void;
  onDelete(notificationId: string): void;
  onMarkRead(notificationId: string): void;
  onOpenResource(resourceId: string): void;
  onOpenWorkspace(workspaceId: string): void;
}): ReactElement {
  const activeNotifications = notificationCenterItems(snapshot.notifications.items);
  const unreadCount = activeNotifications.filter((notification) => notification.status === "unread").length;

  const runAction = (notification: KaryaNotification, action: NotificationAction) => {
    if (notification.status === "unread") onMarkRead(notification.id);
    if (action.command === "openResource" || action.command === "openFolder" || action.command === "openEvent") {
      const targetId =
        action.targetId ??
        notification.references.find((reference) => reference.type === "resource" || reference.type === "event")?.id;
      if (targetId) onOpenResource(targetId);
      return;
    }
    if (action.command === "openWorkspace") {
      const targetId = action.targetId ?? notification.workspaceId;
      if (targetId) onOpenWorkspace(targetId);
      return;
    }
    if (action.command === "completeTask") {
      const targetId =
        action.targetId ?? notification.references.find((reference) => reference.type === "resource")?.id;
      if (targetId) onCompleteTask(targetId);
      return;
    }
    if (action.command === "archive" || action.command === "dismiss") {
      onArchive(notification.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-sm">
      <aside className="karya-slide-panel flex h-full w-full max-w-xl flex-col border-l border-[var(--karya-border)] bg-[rgba(7,18,15,0.94)] shadow-[var(--karya-shadow-panel)] backdrop-blur-2xl">
        <header className="border-b border-[var(--karya-border)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="karya-section-label">Attention Center</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--karya-text)]">Notifications</h2>
              <p className="mt-1 text-sm text-[var(--karya-muted)]">
                {unreadCount} unread · {activeNotifications.length} active
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close notifications" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--karya-subtle)]">Unread</p>
              <p className="mt-1 text-lg font-semibold text-[var(--karya-text)]">{unreadCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--karya-subtle)]">Active</p>
              <p className="mt-1 text-lg font-semibold text-[var(--karya-text)]">{activeNotifications.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--karya-subtle)]">Grouped</p>
              <p className="mt-1 text-lg font-semibold text-[var(--karya-text)]">
                {activeNotifications.filter((notification) => notification.groupCount > 1).length}
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {activeNotifications.length ? (
              activeNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  snapshot={snapshot}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onMarkRead={onMarkRead}
                  onRunAction={(action) => runAction(notification, action)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--karya-border)] bg-[var(--karya-control)] p-5 text-sm text-[var(--karya-muted)]">
                No notifications need attention.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function NotificationCard({
  notification,
  onArchive,
  onDelete,
  onMarkRead,
  onRunAction,
  snapshot,
}: {
  notification: KaryaNotification;
  snapshot: KernelSnapshot;
  onArchive(notificationId: string): void;
  onDelete(notificationId: string): void;
  onMarkRead(notificationId: string): void;
  onRunAction(action: NotificationAction): void;
}): ReactElement {
  const workspace = notification.workspaceId
    ? snapshot.workspaces.all.find((candidate) => candidate.id === notification.workspaceId)
    : undefined;
  const profile = notification.profileId
    ? snapshot.profiles.all.find((candidate) => candidate.id === notification.profileId)
    : undefined;
  const tone = notificationTone(notification);
  const primaryActions = notification.actions.slice(0, 2);
  const secondaryActions = notification.actions.slice(2);

  return (
    <article
      className={cn(
        "rounded-xl border p-4 shadow-[var(--karya-shadow-button)]",
        notification.status === "unread"
          ? "border-[var(--karya-border-strong)] bg-[var(--karya-surface)]"
          : "border-[var(--karya-border)] bg-[var(--karya-control)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--karya-border)] text-base shadow-[var(--karya-shadow-button)]"
          style={{ backgroundColor: tone.background, color: tone.color }}
        >
          {renderNotificationIcon(notification)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--karya-text)]">{notification.title}</p>
                {notification.groupCount > 1 ? <Badge>{notification.groupCount} grouped</Badge> : null}
              </div>
              {notification.description ? (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--karya-muted)]">
                  {notification.description}
                </p>
              ) : null}
            </div>
            <Badge
              className={
                notification.status === "unread"
                  ? "border-[var(--karya-border-strong)] text-[var(--karya-text)]"
                  : undefined
              }
            >
              {notification.status}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--karya-muted)]">
            <span className="rounded-md bg-[var(--karya-surface-strong)] px-2 py-1">
              {formatShortDate(notification.createdAt)}
            </span>
            <span className="rounded-md bg-[var(--karya-surface-strong)] px-2 py-1">{notification.category}</span>
            <span className="rounded-md bg-[var(--karya-surface-strong)] px-2 py-1">{notification.source}</span>
            {workspace ? (
              <span className="rounded-md bg-[var(--karya-surface-strong)] px-2 py-1">
                {displayWorkspaceName(workspace)}
              </span>
            ) : null}
            {profile ? (
              <span className="rounded-md bg-[var(--karya-surface-strong)] px-2 py-1">{profile.name}</span>
            ) : null}
            {notification.priority === "high" || notification.priority === "critical" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--karya-surface-strong)] px-2 py-1 text-[var(--karya-warning)]">
                <Flag className="h-3 w-3" />
                {notification.priority}
              </span>
            ) : null}
          </div>
          {notification.references.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {notification.references.slice(0, 4).map((reference) => (
                <Badge key={`${reference.type}:${reference.id}`}>{reference.title ?? reference.type}</Badge>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {primaryActions.map((action) => (
              <Button key={action.id} size="sm" variant="secondary" onClick={() => onRunAction(action)}>
                {action.label}
              </Button>
            ))}
            {secondaryActions.map((action) => (
              <Button key={action.id} size="sm" variant="ghost" onClick={() => onRunAction(action)}>
                {action.label}
              </Button>
            ))}
            {notification.status === "unread" ? (
              <Button size="sm" variant="ghost" onClick={() => onMarkRead(notification.id)}>
                Read
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onArchive(notification.id)}>
              Archive
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(notification.id)}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function notificationTone(notification: KaryaNotification): { background: string; color: string } {
  if (notification.priority === "critical")
    return { background: "rgba(255, 143, 135, 0.16)", color: "var(--karya-danger)" };
  if (notification.priority === "high")
    return { background: "rgba(247, 210, 122, 0.16)", color: "var(--karya-warning)" };
  if (notification.category === "calendar")
    return { background: "rgba(139, 233, 244, 0.14)", color: "var(--karya-accent)" };
  if (notification.category === "task")
    return { background: "rgba(116, 240, 178, 0.14)", color: "var(--karya-success)" };
  return { background: "rgba(166, 180, 173, 0.12)", color: "var(--karya-muted)" };
}

function renderNotificationIcon(notification: KaryaNotification, size: "sm" | "md" = "md"): ReactElement | string {
  const className = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const icon = notification.icon.trim().toLocaleLowerCase();
  if (icon === "briefcase" || notification.category === "workspace") return <Briefcase className={className} />;
  if (icon === "calendar" || notification.category === "calendar") return <CalendarDays className={className} />;
  if (icon === "task" || icon === "tasks" || notification.category === "task")
    return <CheckSquare className={className} />;
  if (icon === "import" || notification.category === "import") return <FolderInput className={className} />;
  if (icon === "system" || notification.category === "system") return <Settings className={className} />;
  if (icon === "notification" || icon === "bell") return <Bell className={className} />;
  return notification.icon.length <= 2 ? notification.icon : <Bell className={className} />;
}

function NotificationSummaryPanel({
  compact = false,
  snapshot,
  workspaceId,
}: {
  compact?: boolean;
  snapshot: KernelSnapshot;
  workspaceId?: string;
}): ReactElement {
  const notifications = notificationCenterItems(snapshot.notifications.items)
    .filter((notification) => !workspaceId || notification.workspaceId === workspaceId)
    .slice(0, compact ? 3 : 5);
  const unreadCount = notifications.filter((notification) => notification.status === "unread").length;

  return (
    <Surface className={cn("min-w-0 p-5", compact ? "rounded-lg shadow-none" : undefined)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--karya-text)]">Notifications</h2>
          <p className="mt-1 text-xs text-[var(--karya-muted)]">
            {workspaceId ? "Workspace attention queue" : "Attention across active Profiles and Workspaces"}
          </p>
        </div>
        <Badge>{unreadCount} unread</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {notifications.length ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--karya-surface)] text-[var(--karya-accent)]">
                  {renderNotificationIcon(notification, "sm")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--karya-text)]">{notification.title}</p>
                    {notification.groupCount > 1 ? (
                      <span className="shrink-0 text-xs text-[var(--karya-subtle)]">{notification.groupCount}x</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--karya-muted)]">
                    {notification.category} · {formatShortDate(notification.createdAt)} · {notification.status}
                  </p>
                </div>
                {notification.priority === "high" || notification.priority === "critical" ? (
                  <Flag className="h-4 w-4 text-[var(--karya-warning)]" />
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--karya-muted)]">No notifications for this context.</p>
        )}
      </div>
    </Surface>
  );
}

function notificationCenterItems(notifications: KaryaNotification[]): KaryaNotification[] {
  return notifications
    .filter((notification) => notification.status !== "archived" && notification.status !== "deleted")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function ActivityCenterPanel({
  compact = false,
  objectKey,
  profileId,
  snapshot,
  title = "Activity Center",
  workspaceId,
}: {
  compact?: boolean;
  objectKey?: string;
  profileId?: string;
  snapshot: KernelSnapshot;
  title?: string;
  workspaceId?: string;
}): ReactElement {
  const activities = objectKey
    ? (snapshot.activity.byObject[objectKey] ?? [])
    : workspaceId
      ? (snapshot.activity.byWorkspace[workspaceId] ?? [])
      : profileId
        ? (snapshot.activity.byProfile[profileId] ?? [])
        : snapshot.activity.recent;
  const visible = activities.slice(0, compact ? 5 : 12);
  const grouped = groupActivitiesByDay(visible);

  return (
    <Surface className={cn("min-w-0 p-5", compact ? "rounded-lg shadow-none" : undefined)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{activityScopeLabel({ objectKey, profileId, workspaceId })}</p>
        </div>
        <Badge>{activities.length}</Badge>
      </div>
      <div className="mt-4 space-y-4">
        {grouped.length ? (
          grouped.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-medium uppercase text-zinc-400">{group.label}</p>
              <div className="space-y-2">
                {group.items.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No activity has been recorded for this context yet.</p>
        )}
      </div>
    </Surface>
  );
}

function ActivityRow({ activity }: { activity: KaryaActivity }): ReactElement {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{activity.title}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {formatActivityCategory(activity.category)} · {formatShortDate(activity.occurredAt)}
            {activity.groupCount > 1 ? ` · ${activity.groupCount} grouped` : ""}
          </p>
        </div>
        <Badge>{formatActivityVerb(activity.verb)}</Badge>
      </div>
      {activity.description ? <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{activity.description}</p> : null}
    </div>
  );
}

function groupActivitiesByDay(activities: KaryaActivity[]): Array<{ label: string; items: KaryaActivity[] }> {
  const groups = new Map<string, KaryaActivity[]>();
  for (const activity of activities) {
    const key = activity.occurredAt.slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), activity]);
  }

  return [...groups.entries()].map(([dateKey, items]) => ({
    label: formatActivityDay(dateKey),
    items,
  }));
}

function formatActivityDay(dateKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return dateKey;
}

function activityScopeLabel({
  objectKey,
  profileId,
  workspaceId,
}: {
  objectKey?: string;
  profileId?: string;
  workspaceId?: string;
}): string {
  if (objectKey) return "Object history";
  if (workspaceId) return "Workspace timeline";
  if (profileId) return "Profile timeline";
  return "Timeline across Karya";
}

function formatActivityCategory(category: KaryaActivity["category"]): string {
  return category.slice(0, 1).toUpperCase() + category.slice(1);
}

function formatActivityVerb(verb: KaryaActivity["verb"]): string {
  return verb
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

interface ProfileDashboardProps {
  profile: KernelSnapshot["profiles"]["all"][number];
  snapshot: KernelSnapshot;
  onArchive(profileId: string): void;
  onDelete(profileId: string): void;
  onOpenWorkspace(workspaceId: string): void;
  onRename(profile: KernelSnapshot["profiles"]["all"][number]): void;
  onResumeResource(resourceId: string, workspaceId?: string): void;
  onRestore(profileId: string): void;
}

function ProfileDashboard({
  onArchive,
  onDelete,
  onOpenWorkspace,
  onRename,
  onResumeResource,
  onRestore,
  profile,
  snapshot,
}: ProfileDashboardProps): ReactElement {
  const statistics = snapshot.profiles.statisticsById[profile.id];
  const workspaceIds = snapshot.profiles.workspaceIdsByProfile[profile.id] ?? [];
  const workspaces = workspaceIds
    .map((workspaceId) => snapshot.workspaces.all.find((workspace) => workspace.id === workspaceId))
    .filter((workspace): workspace is KernelSnapshot["workspaces"]["all"][number] => Boolean(workspace))
    .filter((workspace) => workspace.id !== DESKTOP_HOME_DEFAULT_SPACE_ID)
    .filter((workspace) => workspace.lifecycleState !== "deleted");
  const recentResources = snapshot.resources.recent.filter((resource) => resource.profileId === profile.id).slice(0, 4);
  const defaultSpace = snapshot.workspaces.all.find((workspace) => workspace.id === profile.defaultSpaceId);
  const isArchived = profile.lifecycleState === "archived";

  return (
    <div className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto pr-1">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-lg text-lg font-semibold text-white"
              style={{ backgroundColor: profile.accentColor ?? "#18181b" }}
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-400">Profile Dashboard</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">{profile.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                {profile.description ?? "A focused responsibility inside Karya."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={isArchived} onClick={() => onRename(profile)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </Button>
            {isArchived ? (
              <Button variant="secondary" size="sm" onClick={() => onRestore(profile.id)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onArchive(profile.id)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm(`Delete ${profile.name} permanently?`)) {
                  onDelete(profile.id);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isArchived ? "Delete Permanently" : "Delete"}
            </Button>
          </div>
        </div>
      </section>
      <section
        className={cn(
          "grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3",
          isArchived ? "opacity-50" : undefined,
        )}
      >
        <ProfileStat label="Resources" value={String(statistics?.totalResources ?? 0)} />
        <ProfileStat label="Active" value={String(statistics?.activeResources ?? 0)} />
        <ProfileStat label="Workspaces" value={String(statistics?.workspaceCount ?? 0)} />
        <ProfileStat label="Imports" value={String(statistics?.importCount ?? 0)} />
      </section>
      <ActivityCenterPanel snapshot={snapshot} profileId={profile.id} title="Profile Activity" />
      <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Surface className="min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Default Space</h2>
            <Badge>Profile Inbox</Badge>
          </div>
          {defaultSpace ? (
            <button
              type="button"
              disabled={isArchived}
              onClick={() => onOpenWorkspace(defaultSpace.id)}
              className="mb-4 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition-colors hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{defaultSpace.name}</p>
                <Badge>{snapshot.workspaces.resourceCountByWorkspace[defaultSpace.id] ?? 0} resources</Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {defaultSpace.metadata.description ??
                  "Temporary resources, captures, imports, and unorganized work for this Profile."}
              </p>
            </button>
          ) : (
            <p className="mb-4 text-sm text-zinc-500">This profile does not have a default space yet.</p>
          )}
          <h3 className="mb-3 text-sm font-semibold">Profile Workspaces</h3>
          <div className="space-y-2">
            {workspaces.length ? (
              workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={isArchived}
                  onClick={() => onOpenWorkspace(workspace.id)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{displayWorkspaceName(workspace)}</p>
                    <Badge>{workspace.lifecycleState}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{workspace.metadata.description ?? "Workspace"}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No workspaces belong to this profile yet.</p>
            )}
          </div>
        </Surface>
        <Surface className="min-w-0 p-5">
          <h2 className="text-sm font-semibold">Continue Working</h2>
          <div className="mt-4 space-y-2">
            {recentResources.length ? (
              recentResources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  disabled={isArchived}
                  onClick={() =>
                    onResumeResource(resource.id, resource.primaryWorkspaceId ?? resource.workspaceRefs[0])
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="font-medium">{displayResourceTitle(resource)}</p>
                  <p className="mt-1 text-sm text-zinc-500">{resource.metadata.kind}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No recent resources for this profile.</p>
            )}
          </div>
        </Surface>
      </section>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Surface className="p-4">
      <p className="text-xs font-medium uppercase text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Surface>
  );
}

function WidgetPreview({ description, title }: { description: string; title: string }): ReactElement {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
    </div>
  );
}

function TaskLauncherPanel({
  onCreateTask,
  onOpenTasks,
  tasks,
}: {
  onCreateTask(title?: string): void;
  onOpenTasks(taskId?: string): void;
  tasks: ResourceSnapshot[];
}): ReactElement {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Tasks</p>
          <p className="mt-1 text-xs text-zinc-500">Open the task board when you need to plan or triage work.</p>
        </div>
        <Badge>{tasks.length}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <InsightStat label="Today" value={tasks.filter(isTaskDueToday).length} />
        <InsightStat label="Open" value={tasks.filter((task) => readTaskStatus(task) !== "completed").length} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onOpenTasks()}>
          <CheckSquare className="mr-2 h-4 w-4" />
          Open Tasks
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void onCreateTask()}>
          <Plus className="mr-2 h-4 w-4" />
          New
        </Button>
      </div>
    </div>
  );
}

function RecentTasksPanel({
  onComplete,
  onCreateTask,
  onOpenTasks,
  onReopen,
  tasks,
}: {
  onComplete(resourceId: string): void;
  onCreateTask(title?: string): void;
  onOpenTasks(taskId?: string): void;
  onReopen(resourceId: string): void;
  tasks: ResourceSnapshot[];
}): ReactElement {
  const recentTasks = tasks
    .filter((task) => readTaskStatus(task) !== "archived")
    .sort((left, right) => right.metadata.updatedAt.localeCompare(left.metadata.updatedAt))
    .slice(0, 4);

  return (
    <Surface className="min-w-0 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recent Tasks</h2>
          <p className="mt-1 text-xs text-zinc-500">A compact activity strip for recent task work.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void onCreateTask()}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
          <Button size="sm" onClick={() => onOpenTasks()}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Open Tasks
          </Button>
        </div>
      </div>
      {recentTasks.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
          {recentTasks.map((task, index) => (
            <RecentTaskItem
              key={task.id}
              task={task}
              tone={taskTone(task, index)}
              onComplete={onComplete}
              onOpenTasks={onOpenTasks}
              onReopen={onReopen}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No recent tasks yet.</p>
      )}
    </Surface>
  );
}

function RecentTaskItem({
  onComplete,
  onOpenTasks,
  onReopen,
  task,
  tone,
}: {
  onComplete(resourceId: string): void;
  onOpenTasks(taskId?: string): void;
  onReopen(resourceId: string): void;
  task: ResourceSnapshot;
  tone: { background: string; border: string };
}): ReactElement {
  const status = readTaskStatus(task);
  const labels = readTaskLabels(task).slice(0, 2);
  return (
    <div
      className={cn(
        "group karya-fade-up flex min-w-0 items-center gap-3 rounded-lg border bg-white/80 p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={{ backgroundColor: tone.background, borderColor: tone.border }}
    >
      <button
        type="button"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          status === "completed" ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white",
        )}
        onClick={() => (status === "completed" ? onReopen(task.id) : onComplete(task.id))}
        aria-label={status === "completed" ? "Reopen task" : "Complete task"}
      >
        {status === "completed" ? <CheckSquare className="h-3 w-3" /> : null}
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          onOpenTasks(task.id);
        }}
      >
        <p
          className={cn(
            "truncate text-sm font-medium",
            status === "completed" ? "text-zinc-400 line-through" : "text-zinc-900",
          )}
        >
          {task.metadata.title}
        </p>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {formatTaskStatus(status)}
          {readStringAttribute(task, "taskDueDate") ? ` / Due ${readStringAttribute(task, "taskDueDate")}` : ""}
        </p>
      </button>
      {labels.length ? (
        <div className="hidden shrink-0 gap-1 md:flex">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-800"
              style={{ backgroundColor: labelColor(label).background }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CalendarPanel({
  events,
  onArchive,
  onCreateEvent,
  onCreateRelationship,
  onDelete,
  onOpenEvent,
  onRemoveRelationship,
  snapshot,
  onUpdateEvent,
}: {
  events: EventSnapshot[];
  onArchive(eventId: string): void;
  onCreateEvent(title?: string, options?: Omit<CalendarEventPatch, "title">): Promise<{ id: string }>;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onDelete(eventId: string): void;
  onOpenEvent(resourceId: string): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  snapshot: KernelSnapshot;
  onUpdateEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
}): ReactElement {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const upcoming = [...events]
    .filter((event) => readCalendarEndDate(event) >= todayDateKey())
    .sort(compareCalendarEvents)
    .slice(0, 4);
  const openCalendar = (eventId?: string) => {
    setSelectedEventId(eventId);
    setCalendarOpen(true);
  };
  const createAndOpen = async () => {
    const event = await onCreateEvent("New Event", {
      startDate: todayDateKey(),
      endDate: todayDateKey(),
      category: "meeting",
      color: "#dbeafe",
    });
    openCalendar(event.id);
  };

  return (
    <Surface className="min-w-0 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Upcoming Events</h2>
          <p className="mt-1 text-xs text-zinc-500">Meetings, deadlines, and scheduled work in this Workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void createAndOpen()}>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
          <Button size="sm" onClick={() => openCalendar()}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Open Calendar
          </Button>
        </div>
      </div>
      {upcoming.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
          {upcoming.map((event) => (
            <button
              key={event.id}
              type="button"
              className="group min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              onClick={() => openCalendar(event.id)}
              onDoubleClick={() => onOpenEvent(event.id)}
            >
              <div className="mb-3 h-1.5 rounded-full" style={{ backgroundColor: readCalendarColor(event) }} />
              <p className="truncate font-medium">{event.metadata.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatCalendarDateRange(event)}</p>
              <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                {readStringAttribute(event, "calendarDescription") || event.metadata.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{formatCalendarCategory(readCalendarCategory(event))}</Badge>
                {readCalendarLabels(event)
                  .slice(0, 1)
                  .map((label) => (
                    <span
                      key={label}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-800"
                      style={{ backgroundColor: labelColor(label).background }}
                    >
                      {label}
                    </span>
                  ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No upcoming events in this Workspace yet.</p>
      )}
      {calendarOpen ? (
        <CalendarDialog
          events={events}
          selectedEventId={selectedEventId}
          onClose={() => {
            setCalendarOpen(false);
            setSelectedEventId(undefined);
          }}
          onCreateEvent={async (title, options) => {
            const event = await onCreateEvent(title, options);
            setSelectedEventId(event.id);
            return event;
          }}
          onCreateRelationship={onCreateRelationship}
          onDelete={(resourceId) => {
            onDelete(resourceId);
            if (selectedEventId === resourceId) setSelectedEventId(undefined);
          }}
          onArchive={(resourceId) => {
            onArchive(resourceId);
            if (selectedEventId === resourceId) setSelectedEventId(undefined);
          }}
          onSelectEvent={setSelectedEventId}
          onRemoveRelationship={onRemoveRelationship}
          snapshot={snapshot}
          onUpdateEvent={onUpdateEvent}
        />
      ) : null}
    </Surface>
  );
}

function CalendarDialog({
  events,
  onClose,
  onCreateEvent,
  onCreateRelationship,
  onDelete,
  onArchive,
  onSelectEvent,
  onRemoveRelationship,
  snapshot,
  onUpdateEvent,
  selectedEventId,
}: {
  events: EventSnapshot[];
  onClose(): void;
  onCreateEvent(title?: string, options?: Omit<CalendarEventPatch, "title">): Promise<{ id: string }>;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onDelete(eventId: string): void;
  onArchive(eventId: string): void;
  onSelectEvent(eventId: string): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  snapshot: KernelSnapshot;
  onUpdateEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
  selectedEventId?: string;
}): ReactElement {
  const today = startOfLocalDay(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [visibleDate, setVisibleDate] = useState(today);
  const [quickTitle, setQuickTitle] = useState("");
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const labels = collectCalendarLabels(events);

  const createQuickEvent = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    const event = await onCreateEvent(title, {
      startDate: formatTaskDateKey(visibleDate),
      endDate: formatTaskDateKey(visibleDate),
      category: "meeting",
      color: calendarColorForTitle(title),
    });
    setQuickTitle("");
    onSelectEvent(event.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--karya-bg)]">
      <div className="karya-scale-in flex h-screen w-screen min-w-0 flex-col overflow-hidden border border-[var(--karya-border)] bg-[var(--karya-bg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--karya-border)] bg-[var(--karya-surface)] px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Karya Calendar</p>
            <h2 className="text-lg font-semibold">Schedule</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close calendar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-5 overflow-hidden p-6",
            selectedEvent ? "xl:grid-cols-[220px_minmax(0,1fr)_380px]" : "xl:grid-cols-[220px_minmax(0,1fr)]",
          )}
        >
          <aside className="min-h-0 space-y-4 overflow-y-auto">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Views</p>
              {(["month", "week", "day", "agenda"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm capitalize",
                    view === mode ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-white",
                  )}
                  onClick={() => setView(mode)}
                >
                  <span>{mode}</span>
                  <span className="text-xs opacity-70">{countCalendarEvents(events, mode)}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Labels</p>
              {labels.length ? (
                labels.map(([label, count]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-600"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: labelColor(label).dot }} />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="text-xs text-zinc-400">{count}</span>
                  </div>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-zinc-500">No labels yet.</p>
              )}
            </div>
          </aside>

          <section className="min-w-0 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-normal">
                    {visibleDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </h2>
                  <Badge>{events.length}</Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">Plan meetings, deadlines, reminders, and focused work.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setVisibleDate(addCalendarView(visibleDate, view, -1))}
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setVisibleDate(today)}>
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setVisibleDate(addCalendarView(visibleDate, view, 1))}
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                  {(["month", "week", "day", "agenda"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                        view === mode ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-white",
                      )}
                      onClick={() => setView(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <form
              className="mt-5 flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void createQuickEvent();
              }}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-400"
                placeholder="Add an event..."
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={!quickTitle.trim()}>
                Add
              </Button>
            </form>
            <div className="mt-5">
              {view === "month" ? (
                <CalendarMonthView
                  events={events}
                  selectedDate={visibleDate}
                  onSelectDate={setVisibleDate}
                  onSelectEvent={onSelectEvent}
                />
              ) : view === "week" ? (
                <CalendarWeekView
                  events={events}
                  selectedDate={visibleDate}
                  onSelectDate={setVisibleDate}
                  onSelectEvent={onSelectEvent}
                />
              ) : view === "day" ? (
                <CalendarDayView events={events} selectedDate={visibleDate} onSelectEvent={onSelectEvent} />
              ) : (
                <CalendarAgendaView events={events} onSelectEvent={onSelectEvent} />
              )}
            </div>
          </section>

          {selectedEvent ? (
            <CalendarEventDetailPanel
              event={selectedEvent}
              onClose={() => onSelectEvent("")}
              onArchive={onArchive}
              onCreateRelationship={onCreateRelationship}
              onDelete={onDelete}
              onNavigateRelationship={(target) => {
                if (target.type === "event") onSelectEvent(target.id);
              }}
              onRemoveRelationship={onRemoveRelationship}
              snapshot={snapshot}
              onUpdateEvent={onUpdateEvent}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CalendarMonthView({
  events,
  onSelectDate,
  onSelectEvent,
  selectedDate,
}: {
  events: EventSnapshot[];
  onSelectDate(date: Date): void;
  onSelectEvent(eventId: string): void;
  selectedDate: Date;
}): ReactElement {
  const month = startOfMonth(selectedDate);
  const today = formatTaskDateKey(new Date());
  const days = buildCalendarDays(month);
  return (
    <div className="grid grid-cols-7 border-l border-t border-zinc-200 bg-white">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div
          key={day}
          className="border-b border-r border-zinc-200 px-2 py-2 text-center text-xs font-semibold uppercase text-zinc-400"
        >
          {day}
        </div>
      ))}
      {days.map((day) => {
        const key = formatTaskDateKey(day);
        const dayEvents = events.filter((event) => calendarEventOccursOn(event, key));
        const isCurrentMonth = day.getMonth() === month.getMonth();
        const isToday = key === today;
        return (
          <button
            key={key}
            type="button"
            className={cn(
              "min-h-32 border-b border-r border-zinc-200 p-2 text-left transition-colors hover:bg-zinc-50",
              isCurrentMonth ? "bg-white" : "bg-zinc-50 text-zinc-300",
              isToday ? "bg-cyan-50 ring-2 ring-inset ring-cyan-300" : "",
            )}
            onClick={() => onSelectDate(day)}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday ? "bg-cyan-500 text-white" : "text-zinc-500",
                )}
              >
                {day.getDate()}
              </span>
              {dayEvents.length ? <span className="text-[11px] text-zinc-400">{dayEvents.length}</span> : null}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  className="block w-full rounded-md border px-2 py-1 text-left text-[11px] font-medium text-zinc-800 transition hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ backgroundColor: readCalendarColor(event), borderColor: readCalendarColor(event) }}
                  onClick={(mouseEvent) => {
                    mouseEvent.stopPropagation();
                    onSelectEvent(event.id);
                  }}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter") onSelectEvent(event.id);
                  }}
                >
                  <span className="line-clamp-1">
                    {readCalendarTimeLabel(event)} {event.metadata.title}
                  </span>
                </span>
              ))}
              {dayEvents.length > 3 ? (
                <p className="px-2 text-[11px] text-zinc-400">+{dayEvents.length - 3} more</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CalendarWeekView({
  events,
  onSelectDate,
  onSelectEvent,
  selectedDate,
}: {
  events: EventSnapshot[];
  onSelectDate(date: Date): void;
  onSelectEvent(eventId: string): void;
  selectedDate: Date;
}): ReactElement {
  const today = formatTaskDateKey(new Date());
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const key = formatTaskDateKey(day);
        const dayEvents = events.filter((event) => calendarEventOccursOn(event, key)).sort(compareCalendarEvents);
        return (
          <div
            key={key}
            className={cn(
              "min-h-96 rounded-xl border p-3",
              key === today ? "border-cyan-300 bg-cyan-50" : "border-zinc-200 bg-zinc-50",
            )}
          >
            <button type="button" className="mb-3 text-left" onClick={() => onSelectDate(day)}>
              <p className="text-xs font-semibold uppercase text-zinc-400">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p className="text-lg font-semibold">{day.getDate()}</p>
            </button>
            <div className="space-y-2">
              {dayEvents.length ? (
                dayEvents.map((event) => (
                  <CalendarMiniEventCard key={event.id} event={event} onSelectEvent={onSelectEvent} />
                ))
              ) : (
                <p className="text-xs text-zinc-400">No events</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarDayView({
  events,
  onSelectEvent,
  selectedDate,
}: {
  events: EventSnapshot[];
  onSelectEvent(eventId: string): void;
  selectedDate: Date;
}): ReactElement {
  const key = formatTaskDateKey(selectedDate);
  const dayEvents = events.filter((event) => calendarEventOccursOn(event, key)).sort(compareCalendarEvents);
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-base font-semibold">
        {selectedDate.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </h3>
      <div className="mt-4 space-y-2">
        {dayEvents.length ? (
          dayEvents.map((event) => (
            <CalendarMiniEventCard key={event.id} event={event} onSelectEvent={onSelectEvent} large />
          ))
        ) : (
          <p className="text-sm text-zinc-500">No events scheduled for this day.</p>
        )}
      </div>
    </div>
  );
}

function CalendarAgendaView({
  events,
  onSelectEvent,
}: {
  events: EventSnapshot[];
  onSelectEvent(eventId: string): void;
}): ReactElement {
  const upcoming = [...events]
    .filter((event) => readCalendarEndDate(event) >= todayDateKey())
    .sort(compareCalendarEvents);
  return (
    <div className="space-y-2">
      {upcoming.length ? (
        upcoming.map((event) => (
          <CalendarMiniEventCard key={event.id} event={event} onSelectEvent={onSelectEvent} large />
        ))
      ) : (
        <p className="text-sm text-zinc-500">No upcoming events.</p>
      )}
    </div>
  );
}

function CalendarMiniEventCard({
  event,
  large = false,
  onSelectEvent,
}: {
  event: EventSnapshot;
  large?: boolean;
  onSelectEvent(eventId: string): void;
}): ReactElement {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
        large ? "grid grid-cols-[110px_minmax(0,1fr)] gap-4" : "",
      )}
      onClick={() => onSelectEvent(event.id)}
    >
      <div>
        <p className="text-xs font-semibold text-zinc-500">{formatCalendarDateRange(event)}</p>
        <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: readCalendarColor(event) }} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{event.metadata.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
          {readStringAttribute(event, "calendarDescription") || event.metadata.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{formatCalendarCategory(readCalendarCategory(event))}</Badge>
          {readStringAttribute(event, "calendarLocation") ? (
            <Badge>{readStringAttribute(event, "calendarLocation")}</Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function CalendarEventDetailPanel({
  event,
  onClose,
  onArchive,
  onCreateRelationship,
  onDelete,
  onNavigateRelationship,
  onRemoveRelationship,
  snapshot,
  onUpdateEvent,
}: {
  event: EventSnapshot;
  onClose(): void;
  onArchive(eventId: string): void;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onDelete(eventId: string): void;
  onNavigateRelationship?(target: { id: string; type: RelationshipObjectType }): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  snapshot: KernelSnapshot;
  onUpdateEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
}): ReactElement {
  const [title, setTitle] = useState(event.metadata.title);
  const [description, setDescription] = useState(readStringAttribute(event, "calendarDescription") ?? "");
  const [startDate, setStartDate] = useState(readCalendarStartDate(event));
  const [endDate, setEndDate] = useState(readCalendarEndDate(event));
  const [startTime, setStartTime] = useState(readStringAttribute(event, "calendarStartTime") ?? "");
  const [endTime, setEndTime] = useState(readStringAttribute(event, "calendarEndTime") ?? "");
  const [allDay, setAllDay] = useState(readBooleanAttribute(event, "calendarAllDay"));
  const [category, setCategory] = useState<CalendarEventCategory>(readCalendarCategory(event));
  const [color, setColor] = useState(readCalendarColor(event));
  const [labels, setLabels] = useState(readCalendarLabels(event).join(", "));
  const [reminder, setReminder] = useState(readStringAttribute(event, "calendarReminder") ?? "");
  const [recurrence, setRecurrence] = useState(readStringAttribute(event, "calendarRecurrence") ?? "none");
  const [repeatUntil, setRepeatUntil] = useState(readStringAttribute(event, "calendarRepeatUntil") ?? "");
  const [location, setLocation] = useState(readStringAttribute(event, "calendarLocation") ?? "");
  const [url, setUrl] = useState(readStringAttribute(event, "calendarUrl") ?? "");
  const [relatedResourceIds, setRelatedResourceIds] = useState(readCalendarRelatedIds(event).join(", "));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");

  useEffect(() => {
    setTitle(event.metadata.title);
    setDescription(readStringAttribute(event, "calendarDescription") ?? "");
    setStartDate(readCalendarStartDate(event));
    setEndDate(readCalendarEndDate(event));
    setStartTime(readStringAttribute(event, "calendarStartTime") ?? "");
    setEndTime(readStringAttribute(event, "calendarEndTime") ?? "");
    setAllDay(readBooleanAttribute(event, "calendarAllDay"));
    setCategory(readCalendarCategory(event));
    setColor(readCalendarColor(event));
    setLabels(readCalendarLabels(event).join(", "));
    setReminder(readStringAttribute(event, "calendarReminder") ?? "");
    setRecurrence(readStringAttribute(event, "calendarRecurrence") ?? "none");
    setRepeatUntil(readStringAttribute(event, "calendarRepeatUntil") ?? "");
    setLocation(readStringAttribute(event, "calendarLocation") ?? "");
    setUrl(readStringAttribute(event, "calendarUrl") ?? "");
    setRelatedResourceIds(readCalendarRelatedIds(event).join(", "));
    setSaveState("saved");
  }, [event.id]);

  useEffect(() => {
    const dirty =
      title !== event.metadata.title ||
      description !== (readStringAttribute(event, "calendarDescription") ?? "") ||
      startDate !== readCalendarStartDate(event) ||
      endDate !== readCalendarEndDate(event) ||
      startTime !== (readStringAttribute(event, "calendarStartTime") ?? "") ||
      endTime !== (readStringAttribute(event, "calendarEndTime") ?? "") ||
      allDay !== readBooleanAttribute(event, "calendarAllDay") ||
      category !== readCalendarCategory(event) ||
      color !== readCalendarColor(event) ||
      labels !== readCalendarLabels(event).join(", ") ||
      reminder !== (readStringAttribute(event, "calendarReminder") ?? "") ||
      recurrence !== (readStringAttribute(event, "calendarRecurrence") ?? "none") ||
      repeatUntil !== (readStringAttribute(event, "calendarRepeatUntil") ?? "") ||
      location !== (readStringAttribute(event, "calendarLocation") ?? "") ||
      url !== (readStringAttribute(event, "calendarUrl") ?? "") ||
      relatedResourceIds !== readCalendarRelatedIds(event).join(", ");
    if (!dirty) {
      setSaveState("saved");
      return;
    }
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      await onUpdateEvent(event.id, {
        title: title.trim() || "Untitled Event",
        description,
        startDate,
        endDate: endDate || startDate,
        startTime,
        endTime,
        allDay,
        category,
        color,
        labels: labels
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        reminder,
        recurrence,
        repeatUntil,
        location,
        url,
        relatedResourceIds: relatedResourceIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setSaveState("saved");
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [
    allDay,
    category,
    color,
    description,
    endDate,
    endTime,
    event.id,
    labels,
    location,
    recurrence,
    relatedResourceIds,
    reminder,
    repeatUntil,
    startDate,
    startTime,
    title,
    url,
  ]);

  const labelList = labels
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <aside className="karya-slide-panel min-w-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-4 2xl:p-5">
      <Surface className="min-w-0 p-0">
        <div className="border-b border-zinc-200 p-4 2xl:p-5">
          <div className="flex items-start justify-between gap-3">
            <input
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
              value={title}
              onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            />
            <Button variant="ghost" size="icon" title="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{formatCalendarCategory(category)}</Badge>
            <Badge>{saveState === "saved" ? "Autosaved" : saveState === "saving" ? "Saving" : "Unsaved"}</Badge>
          </div>
        </div>
        <div className="space-y-5 p-4 2xl:p-5">
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Description
            <textarea
              className="mt-1 min-h-20 w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={description}
              onChange={(inputEvent) => setDescription(inputEvent.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium uppercase text-zinc-400">
              Start Date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
                value={startDate}
                onChange={(inputEvent) => setStartDate(inputEvent.target.value)}
              />
            </label>
            <label className="block text-xs font-medium uppercase text-zinc-400">
              End Date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
                value={endDate}
                onChange={(inputEvent) => setEndDate(inputEvent.target.value)}
              />
            </label>
            <label className="block text-xs font-medium uppercase text-zinc-400">
              Start Time
              <input
                type="time"
                disabled={allDay}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-100"
                value={startTime}
                onChange={(inputEvent) => setStartTime(inputEvent.target.value)}
              />
            </label>
            <label className="block text-xs font-medium uppercase text-zinc-400">
              End Time
              <input
                type="time"
                disabled={allDay}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-100"
                value={endTime}
                onChange={(inputEvent) => setEndTime(inputEvent.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={allDay} onChange={(inputEvent) => setAllDay(inputEvent.target.checked)} />
            All-day event
          </label>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Category</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {(["meeting", "focus", "deadline", "reminder", "personal", "other"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium",
                    category === item ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-white",
                  )}
                  onClick={() => setCategory(item)}
                >
                  {formatCalendarCategory(item)}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Color
            <input
              type="color"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white p-1"
              value={color}
              onChange={(inputEvent) => setColor(inputEvent.target.value)}
            />
          </label>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Labels</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {labelList.map((label) => (
                <span
                  key={label}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-800"
                  style={{ backgroundColor: labelColor(label).background }}
                >
                  {label}
                </span>
              ))}
            </div>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={labels}
              onChange={(inputEvent) => setLabels(inputEvent.target.value)}
              placeholder="Planning, Meeting, Deadline"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium uppercase text-zinc-400">
              Reminder
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
                value={reminder}
                onChange={(inputEvent) => setReminder(inputEvent.target.value)}
                placeholder="10 min before"
              />
            </label>
            <label className="block text-xs font-medium uppercase text-zinc-400">
              Recurrence
              <select
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
                value={recurrence}
                onChange={(inputEvent) => setRecurrence(inputEvent.target.value)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Repeat Until
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={repeatUntil}
              onChange={(inputEvent) => setRepeatUntil(inputEvent.target.value)}
            />
          </label>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Location
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={location}
              onChange={(inputEvent) => setLocation(inputEvent.target.value)}
            />
          </label>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Meeting Link
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={url}
              onChange={(inputEvent) => setUrl(inputEvent.target.value)}
            />
          </label>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Related Resource IDs
            <textarea
              className="mt-1 min-h-16 w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={relatedResourceIds}
              onChange={(inputEvent) => setRelatedResourceIds(inputEvent.target.value)}
              placeholder="resource-id-1, resource-id-2"
            />
          </label>
          <RelationshipPanel
            object={event}
            objectType="event"
            snapshot={snapshot}
            onCreateRelationship={onCreateRelationship}
            onNavigate={onNavigateRelationship}
            onRemoveRelationship={onRemoveRelationship}
          />
          <ActivityCenterPanel snapshot={snapshot} objectKey={`event:${event.id}`} title="Activity" compact />
          <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            <p>Created {formatShortDate(event.metadata.createdAt)}</p>
            <p className="mt-1">Last edited {formatShortDate(event.metadata.updatedAt)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 p-4">
          <Button variant="ghost" size="sm" onClick={() => onArchive(event.id)}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(event.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </Surface>
    </aside>
  );
}

function BookmarksPanel({
  bookmarks,
  onCreateBookmark,
  onDelete,
  onOpenBookmark,
  onUpdateBookmark,
}: {
  bookmarks: ResourceSnapshot[];
  onCreateBookmark(url: string, options?: Omit<BookmarkPatch, "url">): Promise<{ id: string }>;
  onDelete(resourceId: string): void;
  onOpenBookmark(resourceId: string): void;
  onUpdateBookmark(resourceId: string, patch: BookmarkPatch): Promise<void>;
}): ReactElement {
  const [boardOpen, setBoardOpen] = useState(false);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | undefined>();
  const recentBookmarks = [...bookmarks].sort(compareBookmarks).slice(0, 4);
  const openBoard = (bookmarkId?: string) => {
    setSelectedBookmarkId(bookmarkId);
    setBoardOpen(true);
  };
  const createAndOpen = async () => {
    const bookmark = await onCreateBookmark("https://");
    openBoard(bookmark.id);
  };

  return (
    <Surface className="min-w-0 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recent Bookmarks</h2>
          <p className="mt-1 text-xs text-zinc-500">Saved web resources and research references for this Workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void createAndOpen()}>
            <Plus className="mr-2 h-4 w-4" />
            New Bookmark
          </Button>
          <Button size="sm" onClick={() => openBoard()}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Bookmarks
          </Button>
        </div>
      </div>
      {recentBookmarks.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
          {recentBookmarks.map((bookmark) => (
            <button
              key={bookmark.id}
              type="button"
              className="group min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
              onClick={() => openBoard(bookmark.id)}
              onDoubleClick={() => onOpenBookmark(bookmark.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{bookmark.metadata.title}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{readBookmarkDomain(bookmark)}</p>
                </div>
                {isBookmarkPinned(bookmark) ? <Pin className="h-3.5 w-3.5 fill-zinc-900" /> : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                {readStringAttribute(bookmark, "bookmarkDescription") || bookmark.metadata.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {readBookmarkLabels(bookmark)
                  .slice(0, 2)
                  .map((label) => (
                    <span
                      key={label}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-800"
                      style={{ backgroundColor: labelColor(label).background }}
                    >
                      {label}
                    </span>
                  ))}
                <Badge>{formatBookmarkStatus(readBookmarkStatus(bookmark))}</Badge>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No bookmarks saved in this Workspace yet.</p>
      )}
      {boardOpen ? (
        <BookmarksDialog
          bookmarks={bookmarks}
          selectedBookmarkId={selectedBookmarkId}
          onClose={() => {
            setBoardOpen(false);
            setSelectedBookmarkId(undefined);
          }}
          onCreateBookmark={async (url, options) => {
            const bookmark = await onCreateBookmark(url, options);
            setSelectedBookmarkId(bookmark.id);
            return bookmark;
          }}
          onDelete={(resourceId) => {
            onDelete(resourceId);
            if (selectedBookmarkId === resourceId) setSelectedBookmarkId(undefined);
          }}
          onOpenBookmark={onOpenBookmark}
          onSelectBookmark={setSelectedBookmarkId}
          onUpdateBookmark={onUpdateBookmark}
        />
      ) : null}
    </Surface>
  );
}

function BookmarksDialog({
  bookmarks,
  onClose,
  onCreateBookmark,
  onDelete,
  onOpenBookmark,
  onSelectBookmark,
  onUpdateBookmark,
  selectedBookmarkId,
}: {
  bookmarks: ResourceSnapshot[];
  onClose(): void;
  onCreateBookmark(url: string, options?: Omit<BookmarkPatch, "url">): Promise<{ id: string }>;
  onDelete(resourceId: string): void;
  onOpenBookmark(resourceId: string): void;
  onSelectBookmark(resourceId: string): void;
  onUpdateBookmark(resourceId: string, patch: BookmarkPatch): Promise<void>;
  selectedBookmarkId?: string;
}): ReactElement {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<BookmarkReadingStatus | "all" | "pinned" | "favorite">("all");
  const [url, setUrl] = useState("");
  const filteredBookmarks = bookmarks
    .filter((bookmark) => {
      if (filter === "pinned") return isBookmarkPinned(bookmark);
      if (filter === "favorite") return readBooleanAttribute(bookmark, "bookmarkFavorite");
      if (filter === "all") return readBookmarkStatus(bookmark) !== "archived";
      return readBookmarkStatus(bookmark) === filter;
    })
    .sort(compareBookmarks);
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId);
  const labels = collectBookmarkLabels(bookmarks);

  const submitBookmark = async () => {
    const nextUrl = url.trim();
    if (!nextUrl || nextUrl === "https://") return;
    const bookmark = await onCreateBookmark(nextUrl);
    setUrl("");
    onSelectBookmark(bookmark.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-zinc-100">
      <div className="karya-scale-in flex h-screen w-screen min-w-0 flex-col overflow-hidden border border-zinc-200 bg-zinc-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Karya Bookmarks</p>
            <h2 className="text-lg font-semibold">Knowledge Capture</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close bookmarks">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-5 overflow-hidden p-6",
            selectedBookmark ? "xl:grid-cols-[220px_minmax(0,1fr)_380px]" : "xl:grid-cols-[220px_minmax(0,1fr)]",
          )}
        >
          <aside className="min-h-0 space-y-4 overflow-y-auto">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Views</p>
              {(["all", "pinned", "favorite", "unread", "reading", "completed", "archived"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                    filter === item ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-white",
                  )}
                  onClick={() => setFilter(item)}
                >
                  <span>{formatBookmarkFilter(item)}</span>
                  <span className="text-xs opacity-70">{countBookmarks(bookmarks, item)}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-400">Labels</p>
              {labels.length ? (
                labels.map(([label, count]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-600"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: labelColor(label).dot }} />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="text-xs text-zinc-400">{count}</span>
                  </div>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-zinc-500">No labels yet.</p>
              )}
            </div>
          </aside>

          <section className="min-w-0 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-normal">Bookmarks</h2>
                  <Badge>{filteredBookmarks.length}</Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">Capture URLs as searchable Workspace resources.</p>
              </div>
              <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                {(["grid", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                      view === mode ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-white",
                    )}
                    onClick={() => setView(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <form
              className="mt-5 flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBookmark();
              }}
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-400"
                placeholder="Paste a URL..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={!url.trim() || url.trim() === "https://"}>
                Save
              </Button>
            </form>
            {view === "grid" ? (
              <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {filteredBookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    selected={selectedBookmarkId === bookmark.id}
                    onOpenBookmark={onOpenBookmark}
                    onSelectBookmark={onSelectBookmark}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {filteredBookmarks.map((bookmark) => (
                  <button
                    key={bookmark.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-50",
                      selectedBookmarkId === bookmark.id ? "bg-zinc-50" : "",
                    )}
                    onClick={() => onSelectBookmark(bookmark.id)}
                    onDoubleClick={() => onOpenBookmark(bookmark.id)}
                  >
                    <BookmarkFavicon bookmark={bookmark} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{bookmark.metadata.title}</p>
                      <p className="truncate text-xs text-zinc-500">{readBookmarkDomain(bookmark)}</p>
                    </div>
                    <Badge>{formatBookmarkStatus(readBookmarkStatus(bookmark))}</Badge>
                    <span className="text-xs text-zinc-400">{formatShortDate(bookmark.metadata.createdAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedBookmark ? (
            <BookmarkDetailPanel
              bookmark={selectedBookmark}
              onClose={() => onSelectBookmark("")}
              onDelete={onDelete}
              onOpenBookmark={onOpenBookmark}
              onUpdateBookmark={onUpdateBookmark}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BookmarkCard({
  bookmark,
  onOpenBookmark,
  onSelectBookmark,
  selected,
}: {
  bookmark: ResourceSnapshot;
  onOpenBookmark(resourceId: string): void;
  onSelectBookmark(resourceId: string): void;
  selected: boolean;
}): ReactElement {
  const labels = readBookmarkLabels(bookmark).slice(0, 3);
  return (
    <button
      type="button"
      className={cn(
        "group min-h-56 rounded-xl border bg-white p-0 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-zinc-950 ring-2 ring-zinc-950" : "border-zinc-200",
      )}
      onClick={() => onSelectBookmark(bookmark.id)}
      onDoubleClick={() => onOpenBookmark(bookmark.id)}
    >
      <div className="flex h-24 items-center justify-center rounded-t-xl border-b border-zinc-200 bg-gradient-to-br from-cyan-50 via-zinc-50 to-amber-50">
        <BookmarkFavicon bookmark={bookmark} large />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 font-semibold">{bookmark.metadata.title}</p>
            <p className="mt-1 truncate text-xs text-zinc-500">{readBookmarkDomain(bookmark)}</p>
          </div>
          {isBookmarkPinned(bookmark) ? <Pin className="h-4 w-4 shrink-0 fill-zinc-900" /> : null}
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
          {readStringAttribute(bookmark, "bookmarkDescription") || bookmark.metadata.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-800"
              style={{ backgroundColor: labelColor(label).background }}
            >
              {label}
            </span>
          ))}
          <Badge>{formatBookmarkStatus(readBookmarkStatus(bookmark))}</Badge>
        </div>
      </div>
    </button>
  );
}

function BookmarkFavicon({ bookmark, large = false }: { bookmark: ResourceSnapshot; large?: boolean }): ReactElement {
  const favicon = readStringAttribute(bookmark, "bookmarkFavicon");
  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        className={cn("rounded-lg bg-white object-contain shadow-sm", large ? "h-12 w-12 p-2" : "h-8 w-8 p-1.5")}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-zinc-950 text-white",
        large ? "h-12 w-12" : "h-8 w-8",
      )}
    >
      <ExternalLink className={large ? "h-5 w-5" : "h-4 w-4"} />
    </span>
  );
}

function BookmarkDetailPanel({
  bookmark,
  onClose,
  onDelete,
  onOpenBookmark,
  onUpdateBookmark,
}: {
  bookmark: ResourceSnapshot;
  onClose(): void;
  onDelete(resourceId: string): void;
  onOpenBookmark(resourceId: string): void;
  onUpdateBookmark(resourceId: string, patch: BookmarkPatch): Promise<void>;
}): ReactElement {
  const [title, setTitle] = useState(bookmark.metadata.title);
  const [url, setUrl] = useState(readStringAttribute(bookmark, "bookmarkUrl") ?? "");
  const [description, setDescription] = useState(
    readStringAttribute(bookmark, "bookmarkDescription") ?? bookmark.metadata.description ?? "",
  );
  const [notes, setNotes] = useState(readStringAttribute(bookmark, "bookmarkNotes") ?? "");
  const [labelText, setLabelText] = useState(readBookmarkLabels(bookmark).join(", "));
  const [status, setStatus] = useState<BookmarkReadingStatus>(readBookmarkStatus(bookmark));
  const [pinned, setPinned] = useState(isBookmarkPinned(bookmark));
  const [favorite, setFavorite] = useState(readBooleanAttribute(bookmark, "bookmarkFavorite"));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");

  useEffect(() => {
    setTitle(bookmark.metadata.title);
    setUrl(readStringAttribute(bookmark, "bookmarkUrl") ?? "");
    setDescription(readStringAttribute(bookmark, "bookmarkDescription") ?? bookmark.metadata.description ?? "");
    setNotes(readStringAttribute(bookmark, "bookmarkNotes") ?? "");
    setLabelText(readBookmarkLabels(bookmark).join(", "));
    setStatus(readBookmarkStatus(bookmark));
    setPinned(isBookmarkPinned(bookmark));
    setFavorite(readBooleanAttribute(bookmark, "bookmarkFavorite"));
    setSaveState("saved");
  }, [bookmark.id]);

  useEffect(() => {
    const labels = labelText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const dirty =
      title !== bookmark.metadata.title ||
      url !== (readStringAttribute(bookmark, "bookmarkUrl") ?? "") ||
      description !== (readStringAttribute(bookmark, "bookmarkDescription") ?? bookmark.metadata.description ?? "") ||
      notes !== (readStringAttribute(bookmark, "bookmarkNotes") ?? "") ||
      labelText !== readBookmarkLabels(bookmark).join(", ") ||
      status !== readBookmarkStatus(bookmark) ||
      pinned !== isBookmarkPinned(bookmark) ||
      favorite !== readBooleanAttribute(bookmark, "bookmarkFavorite");
    if (!dirty) {
      setSaveState("saved");
      return;
    }
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      await onUpdateBookmark(bookmark.id, {
        title: title.trim() || readBookmarkDomain(bookmark) || "Untitled Bookmark",
        url,
        description,
        notes,
        labels,
        readingStatus: status,
        pinned,
        favorite,
      });
      setSaveState("saved");
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [bookmark.id, description, favorite, labelText, notes, pinned, status, title, url]);

  const labels = labelText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <aside className="karya-slide-panel min-w-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-4 2xl:p-5">
      <Surface className="min-w-0 p-0">
        <div className="border-b border-zinc-200 p-4 2xl:p-5">
          <div className="flex items-start justify-between gap-3">
            <input
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title={pinned ? "Unpin" : "Pin"} onClick={() => setPinned(!pinned)}>
                {pinned ? <Pin className="h-4 w-4 fill-zinc-900" /> : <PinOff className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" title="Close" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{formatBookmarkStatus(status)}</Badge>
            <Badge>{favorite ? "Favorite" : "Reference"}</Badge>
            <Badge>{saveState === "saved" ? "Autosaved" : saveState === "saving" ? "Saving" : "Unsaved"}</Badge>
          </div>
        </div>
        <div className="space-y-5 p-4 2xl:p-5">
          <label className="block text-xs font-medium uppercase text-zinc-400">
            URL
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Reading Status</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {(["unread", "reading", "completed", "archived"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium",
                    status === item ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-white",
                  )}
                  onClick={() => setStatus(item)}
                >
                  {formatBookmarkStatus(item)}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Description
            <textarea
              className="mt-1 min-h-20 w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Labels</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-800"
                  style={{ backgroundColor: labelColor(label).background }}
                >
                  {label}
                </span>
              ))}
            </div>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={labelText}
              onChange={(event) => setLabelText(event.target.value)}
              placeholder="Research, APIs, Important"
            />
          </div>
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Notes
            <textarea
              className="mt-1 min-h-28 w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={favorite ? "primary" : "secondary"} size="sm" onClick={() => setFavorite(!favorite)}>
              {favorite ? "Favorited" : "Favorite"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenBookmark(bookmark.id)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </Button>
          </div>
          <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            <p>Website {readStringAttribute(bookmark, "bookmarkWebsiteName") || readBookmarkDomain(bookmark)}</p>
            <p className="mt-1">Created {formatShortDate(bookmark.metadata.createdAt)}</p>
            <p className="mt-1">Last edited {formatShortDate(bookmark.metadata.updatedAt)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdateBookmark(bookmark.id, { readingStatus: "archived" })}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(bookmark.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </Surface>
    </aside>
  );
}

function TasksDialog({
  onClose,
  ...taskSurfaceProps
}: Parameters<typeof TasksSurface>[0] & { onClose(): void }): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex bg-zinc-100">
      <div className="karya-scale-in flex h-screen w-screen min-w-0 flex-col overflow-hidden border border-zinc-200 bg-zinc-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Karya Tasks</p>
            <h2 className="text-lg font-semibold">Task Board</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close tasks">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <TasksSurface {...taskSurfaceProps} />
        </div>
      </div>
    </div>
  );
}

function TasksSurface({
  onComplete,
  onCreateTask,
  onDelete,
  onReopen,
  onUpdateTask,
  selectedTaskId,
  tasks,
}: {
  onComplete(resourceId: string): void;
  onCreateTask(title?: string): Promise<{ id: string }>;
  onDelete(resourceId: string): void;
  onReopen(resourceId: string): void;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
  selectedTaskId?: string;
  tasks: ResourceSnapshot[];
}): ReactElement {
  const [view, setView] = useState<TaskView>("list");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [quickTitle, setQuickTitle] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>(selectedTaskId);
  const filteredTasks = filterTasks(tasks, filter);
  const labels = collectTaskLabels(tasks);
  const pinnedTasks = filteredTasks.filter(isTaskPinned);
  const unpinnedTasks = filteredTasks.filter((task) => !isTaskPinned(task));
  const activeTask = tasks.find((task) => task.id === editingTaskId);

  useEffect(() => {
    if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) {
      setEditingTaskId(selectedTaskId);
    }
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (editingTaskId && !tasks.some((task) => task.id === editingTaskId)) {
      setEditingTaskId(undefined);
    }
  }, [editingTaskId, tasks]);

  const selectTaskForEditing = (resourceId: string) => {
    setEditingTaskId(resourceId);
  };

  const submitQuickTask = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    const task = await onCreateTask(title);
    setEditingTaskId(task.id);
    setQuickTitle("");
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--karya-border)] bg-[var(--karya-panel)] p-5 shadow-[var(--karya-shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-normal">Tasks</h2>
            <Badge>{tasks.length}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">Quick capture, scan, and organize Workspace tasks.</p>
        </div>
        <div className="flex rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-1">
          {(["list", "kanban", "calendar"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                view === mode
                  ? "bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
                  : "text-[var(--karya-muted)] hover:bg-[var(--karya-surface)] hover:text-[var(--karya-text)]",
              )}
              onClick={() => setView(mode)}
            >
              {mode === "list" ? "Keep" : mode}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3 shadow-sm">
        <form
          className="flex min-w-0 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuickTask();
          }}
        >
          <input
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-[var(--karya-text)] outline-none placeholder:text-[var(--karya-subtle)]"
            placeholder="Take a task..."
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
          />
          <Button type="button" variant="ghost" size="icon" title="Checklist">
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" title="Details">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="submit" size="sm" disabled={!quickTitle.trim()}>
            Add
          </Button>
        </form>
      </div>

      <div
        className={cn(
          "mt-5 grid min-h-0 flex-1 gap-5",
          activeTask ? "xl:grid-cols-[190px_minmax(0,1fr)_380px]" : "xl:grid-cols-[190px_minmax(0,1fr)]",
        )}
      >
        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--karya-subtle)]">Views</p>
            {(["all", "pinned", "today", "upcoming", "completed", "archived"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                  filter === item
                    ? "bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
                    : "text-[var(--karya-muted)] hover:bg-[var(--karya-surface)] hover:text-[var(--karya-text)]",
                )}
                onClick={() => setFilter(item)}
              >
                <span>{formatTaskFilter(item)}</span>
                <span className="text-xs opacity-70">{filterTasks(tasks, item).length}</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--karya-subtle)]">Labels</p>
            {labels.length ? (
              labels.map(([label, count]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--karya-muted)]"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: labelColor(label).dot }} />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="text-xs text-[var(--karya-subtle)]">{count}</span>
                </div>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-zinc-500">No labels yet.</p>
            )}
          </div>
          <TaskStatsPanel tasks={tasks} />
        </aside>

        <div className="min-w-0 overflow-y-auto pr-1">
          {view === "list" ? (
            <KeepTaskGrid
              pinnedTasks={pinnedTasks}
              tasks={unpinnedTasks}
              selectedTaskId={editingTaskId}
              onComplete={onComplete}
              onOpenTask={selectTaskForEditing}
              onReopen={onReopen}
              onSelectTask={selectTaskForEditing}
              onUpdateTask={onUpdateTask}
            />
          ) : view === "kanban" ? (
            <TaskKanbanView
              tasks={filteredTasks}
              selectedTaskId={editingTaskId}
              onComplete={onComplete}
              onOpenTask={selectTaskForEditing}
              onReopen={onReopen}
              onSelectTask={selectTaskForEditing}
              onUpdateTask={onUpdateTask}
            />
          ) : (
            <TaskCalendarView
              tasks={filteredTasks}
              onOpenTask={selectTaskForEditing}
              onSelectTask={selectTaskForEditing}
            />
          )}
        </div>
        {activeTask ? (
          <TaskDetailPanel
            task={activeTask}
            onClose={() => setEditingTaskId(undefined)}
            onComplete={onComplete}
            onDelete={(resourceId) => {
              onDelete(resourceId);
              setEditingTaskId(undefined);
            }}
            onReopen={onReopen}
            onUpdateTask={onUpdateTask}
          />
        ) : null}
      </div>
    </section>
  );
}

function TaskStatsPanel({ tasks }: { tasks: ResourceSnapshot[] }): ReactElement {
  return (
    <div className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3">
      <p className="text-sm font-medium">Task Summary</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <InsightStat label="Today" value={tasks.filter(isTaskDueToday).length} />
        <InsightStat label="Overdue" value={tasks.filter(isTaskOverdue).length} />
        <InsightStat label="Done" value={tasks.filter((task) => readTaskStatus(task) === "completed").length} />
        <InsightStat
          label="High"
          value={tasks.filter((task) => ["high", "critical"].includes(readTaskPriority(task))).length}
        />
      </div>
    </div>
  );
}

function KeepTaskGrid({
  onComplete,
  onOpenTask,
  onReopen,
  onSelectTask,
  onUpdateTask,
  pinnedTasks,
  selectedTaskId,
  tasks,
}: {
  onComplete(resourceId: string): void;
  onOpenTask(resourceId: string): void;
  onReopen(resourceId: string): void;
  onSelectTask(resourceId: string): void;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
  pinnedTasks: ResourceSnapshot[];
  selectedTaskId?: string;
  tasks: ResourceSnapshot[];
}): ReactElement {
  if (!tasks.length && !pinnedTasks.length) {
    return <p className="text-sm text-zinc-500">No tasks yet.</p>;
  }
  const renderCards = (items: ResourceSnapshot[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
      {items.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          tone={taskTone(task, index)}
          selected={selectedTaskId === task.id}
          onComplete={onComplete}
          onOpenTask={onOpenTask}
          onReopen={onReopen}
          onSelectTask={onSelectTask}
          onUpdateTask={onUpdateTask}
        />
      ))}
    </div>
  );
  return (
    <div className="space-y-5">
      {pinnedTasks.length ? (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase text-zinc-400">Pinned</p>
          {renderCards(pinnedTasks)}
        </div>
      ) : null}
      {tasks.length ? (
        <div>
          {pinnedTasks.length ? <p className="mb-3 text-xs font-semibold uppercase text-zinc-400">Others</p> : null}
          {renderCards(tasks)}
        </div>
      ) : null}
    </div>
  );
}

function TaskKanbanView({
  onComplete,
  onOpenTask,
  onReopen,
  onSelectTask,
  onUpdateTask,
  selectedTaskId,
  tasks,
}: {
  onComplete(resourceId: string): void;
  onOpenTask(resourceId: string): void;
  onReopen(resourceId: string): void;
  onSelectTask(resourceId: string): void;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
  selectedTaskId?: string;
  tasks: ResourceSnapshot[];
}): ReactElement {
  const [draggingTaskId, setDraggingTaskId] = useState<string | undefined>();
  const [dropStatus, setDropStatus] = useState<TaskStatus | undefined>();
  const columns: TaskStatus[] = ["todo", "in-progress", "completed"];
  return (
    <div>
      <p className="mb-3 text-xs text-[var(--karya-muted)]">Drag cards between columns to update status.</p>
      <div className="grid gap-3 lg:grid-cols-3">
        {columns.map((status) => {
          const columnTasks = tasks.filter((task) => readTaskStatus(task) === status);
          return (
            <div
              key={status}
              className={cn(
                "rounded-xl border p-3 transition-all duration-150",
                dropStatus === status
                  ? "border-[var(--karya-border-strong)] bg-[var(--karya-surface-strong)] shadow-inner"
                  : "border-[var(--karya-border)] bg-[var(--karya-control)]",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropStatus(status);
              }}
              onDragLeave={() => setDropStatus(undefined)}
              onDrop={(event) => {
                event.preventDefault();
                const resourceId = event.dataTransfer.getData("text/plain") || draggingTaskId;
                setDraggingTaskId(undefined);
                setDropStatus(undefined);
                if (resourceId) void onUpdateTask(resourceId, { status });
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--karya-muted)]">{formatTaskStatus(status)}</p>
                <Badge>{columnTasks.length}</Badge>
              </div>
              <div className="space-y-3">
                {columnTasks.length ? (
                  columnTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      tone={taskTone(task, index)}
                      selected={selectedTaskId === task.id}
                      onComplete={onComplete}
                      onOpenTask={onOpenTask}
                      onReopen={onReopen}
                      onSelectTask={onSelectTask}
                      onUpdateTask={onUpdateTask}
                      onDragStart={(resourceId) => setDraggingTaskId(resourceId)}
                    />
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--karya-border)] p-4 text-center text-xs text-[var(--karya-subtle)]">
                    Drop tasks here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCalendarView({
  onOpenTask,
  onSelectTask,
  tasks,
}: {
  onOpenTask(resourceId: string): void;
  onSelectTask(resourceId: string): void;
  tasks: ResourceSnapshot[];
}): ReactElement {
  const today = startOfLocalDay(new Date());
  const firstDueDate = tasks
    .map((task) => parseTaskDate(readStringAttribute(task, "taskDueDate")))
    .find((date): date is Date => Boolean(date));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(firstDueDate ?? today));
  const days = buildCalendarDays(visibleMonth);
  const tasksByDate = new Map<string, ResourceSnapshot[]>();
  tasks.forEach((task) => {
    const dueDate = readStringAttribute(task, "taskDueDate");
    if (!dueDate) return;
    const existing = tasksByDate.get(dueDate) ?? [];
    existing.push(task);
    tasksByDate.set(dueDate, existing);
  });

  return (
    <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
          <p className="mt-1 text-xs text-[var(--karya-muted)]">Tasks are placed by due date. Today is highlighted.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setVisibleMonth(startOfMonth(today))}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-[var(--karya-border)] bg-[var(--karya-panel)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="border-b border-r border-[var(--karya-border)] px-2 py-2 text-center text-xs font-semibold uppercase text-[var(--karya-subtle)]"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const key = formatTaskDateKey(day);
          const dayTasks = tasksByDate.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
          const isToday = key === formatTaskDateKey(today);
          return (
            <div
              key={key}
              className={cn(
                "min-h-32 border-b border-r border-[var(--karya-border)] p-2 transition-colors",
                isCurrentMonth ? "bg-[var(--karya-panel)]" : "bg-[var(--karya-control)] text-[var(--karya-subtle)]",
                isToday ? "bg-[var(--karya-surface-strong)] ring-2 ring-inset ring-[var(--karya-border-strong)]" : "",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday ? "bg-[var(--karya-control-strong)] text-[var(--karya-text)]" : "text-[var(--karya-muted)]",
                  )}
                >
                  {day.getDate()}
                </span>
                {dayTasks.length ? (
                  <span className="text-[11px] text-[var(--karya-subtle)]">{dayTasks.length}</span>
                ) : null}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task, index) => {
                  const tone = taskTone(task, index);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className="w-full rounded-md border px-2 py-1 text-left text-[11px] font-medium text-[var(--karya-text)] transition hover:-translate-y-0.5 hover:shadow-sm"
                      style={{ backgroundColor: tone.background, borderColor: tone.border }}
                      onClick={() => onSelectTask(task.id)}
                      onDoubleClick={() => onOpenTask(task.id)}
                    >
                      <span className="line-clamp-1">{task.metadata.title}</span>
                    </button>
                  );
                })}
                {dayTasks.length > 3 ? (
                  <p className="px-2 text-[11px] text-[var(--karya-subtle)]">+{dayTasks.length - 3} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  onComplete,
  onDragStart,
  onOpenTask,
  onReopen,
  onSelectTask,
  onUpdateTask,
  selected,
  task,
  tone,
}: {
  onComplete(resourceId: string): void;
  onDragStart?(resourceId: string): void;
  onOpenTask(resourceId: string): void;
  onReopen(resourceId: string): void;
  onSelectTask(resourceId: string): void;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
  selected: boolean;
  task: ResourceSnapshot;
  tone: { background: string; border: string };
}): ReactElement {
  const status = readTaskStatus(task);
  const allChecklistItems = readTaskList(task, "taskChecklistItems");
  const checklistCompleted = readTaskCompletedList(task);
  const checklist = allChecklistItems.slice(0, 3);
  const labels = readTaskLabels(task).slice(0, 3);
  const pinned = isTaskPinned(task);
  const priority = readTaskPriority(task);
  const dueDate = readStringAttribute(task, "taskDueDate");
  const reminderDate = readStringAttribute(task, "taskReminderDate");
  const reminderTime = readStringAttribute(task, "taskReminderTime");
  const reminderRepeat = readStringAttribute(task, "taskReminderRepeat");
  const description = htmlToPlainText(readStringAttribute(task, "taskDescription") ?? task.metadata.description ?? "");
  const toggleChecklistItem = (index: number) => {
    const nextCompleted = allChecklistItems.map((_, itemIndex) => checklistCompleted[itemIndex] ?? false);
    nextCompleted[index] = !nextCompleted[index];
    void onUpdateTask(task.id, { checklistCompleted: nextCompleted });
  };
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      className={cn(
        "group karya-fade-up min-h-52 cursor-grab rounded-xl border p-4 text-left shadow-sm outline-none transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:ring-2 focus:ring-[var(--karya-border-strong)] active:scale-[0.99] active:cursor-grabbing",
        selected ? "ring-2 ring-[var(--karya-border-strong)]" : "",
      )}
      style={{ backgroundColor: tone.background, borderColor: selected ? "var(--karya-border-strong)" : tone.border }}
      onClick={() => onSelectTask(task.id)}
      onDoubleClick={() => onOpenTask(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpenTask(task.id);
        }
        if (event.key === " ") {
          event.preventDefault();
          onSelectTask(task.id);
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart?.(task.id);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              "line-clamp-2 text-sm font-semibold",
              status === "completed" ? "text-[var(--karya-muted)] line-through" : "text-[var(--karya-text)]",
            )}
          >
            {task.metadata.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-[var(--karya-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--karya-muted)] ring-1 ring-[var(--karya-border)]">
              {formatTaskStatus(status)}
            </span>
            <span className="rounded-md bg-[var(--karya-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--karya-muted)] ring-1 ring-[var(--karya-border)]">
              {formatTaskPriority(priority)}
            </span>
          </div>
          {description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--karya-muted)]">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pinned ? <Pin className="h-4 w-4 fill-[var(--karya-text)] text-[var(--karya-text)]" /> : null}
          <button
            type="button"
            className="rounded-md p-1 text-[var(--karya-muted)] opacity-0 transition hover:bg-[var(--karya-surface)] hover:text-[var(--karya-text)] group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTask(task.id);
            }}
            aria-label="Edit task"
            title="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {checklist.length ? (
        <div className="mt-3 space-y-1">
          {checklist.map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-2 text-xs text-[var(--karya-muted)]">
              <button
                type="button"
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border bg-[var(--karya-surface)]",
                  checklistCompleted[index]
                    ? "border-[var(--karya-border-strong)] bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
                    : "border-[var(--karya-border)]",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleChecklistItem(index);
                }}
                aria-label={
                  checklistCompleted[index] ? "Mark checklist item incomplete" : "Mark checklist item complete"
                }
              >
                {checklistCompleted[index] ? <CheckSquare className="h-2.5 w-2.5" /> : null}
              </button>
              <span
                className={cn(
                  "line-clamp-1",
                  checklistCompleted[index] ? "text-[var(--karya-subtle)] line-through" : "",
                )}
              >
                {item}
              </span>
            </div>
          ))}
          {allChecklistItems.length > checklist.length ? (
            <p className="text-[11px] text-[var(--karya-subtle)]">
              +{allChecklistItems.length - checklist.length} more checklist items
            </p>
          ) : null}
        </div>
      ) : null}

      {labels.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--karya-text)] ring-1 ring-[var(--karya-border)]"
              style={{ backgroundColor: `${labelColor(label).dot}33` }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1 text-xs font-medium text-[var(--karya-muted)]">
          {dueDate ? <p className="truncate">Due {formatTaskDateLabel(dueDate)}</p> : null}
          {reminderDate ? (
            <p className="truncate">
              Reminder {formatTaskDateLabel(reminderDate)}
              {reminderTime ? ` ${reminderTime}` : ""}
            </p>
          ) : null}
          {reminderRepeat && reminderRepeat !== "none" ? (
            <p className="truncate capitalize">Repeats {reminderRepeat}</p>
          ) : null}
          <p className="truncate text-[11px] text-[var(--karya-subtle)]">
            Updated {formatShortDate(task.metadata.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            status === "completed"
              ? "border-[var(--karya-border-strong)] bg-[var(--karya-surface-strong)] text-[var(--karya-text)]"
              : "border-[var(--karya-border)] bg-[var(--karya-surface)]",
          )}
          onClick={(event) => {
            event.stopPropagation();
            status === "completed" ? onReopen(task.id) : onComplete(task.id);
          }}
          aria-label={status === "completed" ? "Reopen task" : "Complete task"}
        >
          {status === "completed" ? <CheckSquare className="h-3 w-3" /> : null}
        </button>
      </div>
    </div>
  );
}

function WorkspaceInsightsPanel({
  insights,
}: {
  insights?: KernelSnapshot["continuity"]["workspaceInsightsByWorkspace"][string];
}): ReactElement {
  const resourceStats = insights?.resources;
  const applicationStats = insights?.applications ?? [];
  const imports = insights?.imports;
  const session = insights?.session;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Workspace Insights</h2>
        <Badge>{insights?.lastActivity ? "Active" : "Quiet"}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Applications</p>
            <span className="text-xs text-zinc-500">
              {applicationStats.reduce((total, application) => total + application.launchCount, 0)} launches
            </span>
          </div>
          {applicationStats.length ? (
            <div className="space-y-2">
              {applicationStats.slice(0, 3).map((application) => (
                <div key={application.applicationId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{application.name}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{application.launchCount} launches</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No application launches yet.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InsightStat label="Opened" value={resourceStats?.opened ?? 0} />
          <InsightStat label="Edited" value={resourceStats?.edited ?? 0} />
          <InsightStat label="Created" value={resourceStats?.created ?? 0} />
          <InsightStat label="Renamed" value={resourceStats?.renamed ?? 0} />
          <InsightStat label="Moved" value={resourceStats?.moved ?? 0} />
          <InsightStat label="Archived" value={resourceStats?.archived ?? 0} />
          <InsightStat label="Referenced" value={resourceStats?.referenced ?? 0} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InsightStat label="Folders" value={imports?.folders ?? 0} />
          <InsightStat label="Files" value={imports?.files ?? 0} />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-medium">Workspace</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500">
            <span>Resumed</span>
            <span className="text-right text-zinc-700">{session?.resumeCount ?? 0} times</span>
            <span>Last Active</span>
            <span className="text-right text-zinc-700">
              {session?.lastActiveAt ? formatRelativeTime(session.lastActiveAt) : "No activity"}
            </span>
            <span>Current Session</span>
            <span className="text-right text-zinc-700">
              {session?.currentSessionStartedAt ? formatDurationSince(session.currentSessionStartedAt) : "Not started"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-medium">Last Activity</p>
          {insights?.lastActivity ? (
            <>
              <p className="mt-1 truncate text-sm text-zinc-700">
                {formatInsightActivity(insights.lastActivity.type, insights.lastActivity.title)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{formatRelativeTime(insights.lastActivity.occurredAt)}</p>
            </>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RelatedWorkPanel({
  onOpenResource,
  snapshot,
  workspaceId,
}: {
  snapshot: KernelSnapshot;
  workspaceId: string;
  onOpenResource(resourceId: string): void;
}): ReactElement {
  const workspaceObjects: RelationshipObject[] = [
    ...snapshot.resources.all.filter(
      (resource) => resource.workspaceRefs.includes(workspaceId) || resource.primaryWorkspaceId === workspaceId,
    ),
    ...snapshot.events.all.filter(
      (event) =>
        event.lifecycleState !== "deleted" &&
        (event.workspaceRefs.includes(workspaceId) || event.primaryWorkspaceId === workspaceId),
    ),
  ];
  const connected = workspaceObjects
    .flatMap((object) =>
      object.relationships.map((relationship) => ({ object, relationship, target: relationshipTarget(relationship) })),
    )
    .slice(0, 6);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Related Work</h2>
        <Badge>{connected.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {connected.length ? (
          connected.map(({ object, relationship, target }) => (
            <button
              key={`${object.id}:${relationship.id}`}
              type="button"
              className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-left transition-colors hover:border-zinc-300"
              onClick={() => {
                if (target.type === "resource") onOpenResource(target.id);
              }}
            >
              <p className="truncate text-sm font-medium">{displayKaryaObjectTitle(object)}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {formatRelationshipType(relationship.type)} · {relationshipTargetTitle(snapshot, target)}
              </p>
            </button>
          ))
        ) : (
          <p className="text-xs text-zinc-500">No connected work in this Workspace yet.</p>
        )}
      </div>
    </div>
  );
}

interface RelationshipEdge {
  id: string;
  source: RelationshipObject;
  sourceType: RelationshipObjectType;
  target: { id: string; type: RelationshipObjectType };
  targetObject?: RelationshipObject;
  relationship: RelationshipObject["relationships"][number];
}

function WorkspaceRelationshipsPage({
  onCreateRelationship,
  onOpenResource,
  onRemoveRelationship,
  onSelectResource,
  snapshot,
  workspace,
  workspaceId,
}: {
  snapshot: KernelSnapshot;
  workspace: KernelSnapshot["workspaces"]["all"][number];
  workspaceId: string;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onOpenResource(resourceId: string): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  onSelectResource(resourceId: string): void;
}): ReactElement {
  const objects = workspaceRelationshipObjects(snapshot, workspaceId);
  const objectOptions = objects.map((object) => ({
    key: relationshipObjectKey(object),
    id: object.id,
    type: relationshipObjectType(object),
    title: displayKaryaObjectTitle(object),
    label: relationshipObjectLabel(object),
  }));
  const edges = uniqueRelationshipEdges(objects, snapshot);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<RelationshipType | "all">("all");
  const [selectedKey, setSelectedKey] = useState(objectOptions[0]?.key ?? "");
  const [sourceKey, setSourceKey] = useState(objectOptions[0]?.key ?? "");
  const [targetKey, setTargetKey] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("relatedTo");
  const [busy, setBusy] = useState(false);
  const selectedObject = objects.find((object) => relationshipObjectKey(object) === selectedKey) ?? objects[0];
  const filteredEdges = edges.filter((edge) => {
    const search = query.trim().toLowerCase();
    const targetTitle = relationshipTargetTitle(snapshot, edge.target);
    const matchesQuery =
      !search ||
      displayKaryaObjectTitle(edge.source).toLowerCase().includes(search) ||
      targetTitle.toLowerCase().includes(search) ||
      formatRelationshipType(edge.relationship.type).toLowerCase().includes(search);
    const matchesType = typeFilter === "all" || edge.relationship.type === typeFilter;
    return matchesQuery && matchesType;
  });
  const selectedEdges = selectedObject
    ? edges.filter((edge) => edge.source.id === selectedObject.id || edge.target.id === selectedObject.id)
    : [];
  const source = objectOptions.find((option) => option.key === sourceKey);
  const target = objectOptions.find((option) => option.key === targetKey);
  const sourceObject = objects.find((object) => relationshipObjectKey(object) === sourceKey);
  const targetOptions = objectOptions.filter((option) => {
    if (option.key === sourceKey) return false;
    const targetObject = objects.find((object) => relationshipObjectKey(object) === option.key);
    return !sourceObject || !targetObject || canCreateRelationshipBetween(sourceObject, targetObject);
  });
  const suggestions = buildRelationshipSuggestions(objects, edges).slice(0, 5);
  const canSubmitRelationship = Boolean(source && target && targetOptions.some((option) => option.key === target.key));
  const relationshipActivities = (snapshot.activity.byWorkspace[workspaceId] ?? snapshot.activity.items)
    .filter((activity) => activity.category === "relationship")
    .slice(0, 6);

  useEffect(() => {
    if (targetKey && !targetOptions.some((option) => option.key === targetKey)) {
      setTargetKey("");
    }
  }, [targetKey, targetOptions]);

  const addRelationship = async () => {
    if (!source || !target || source.key === target.key || !canSubmitRelationship) return;
    setBusy(true);
    try {
      await onCreateRelationship(source.id, source.type, target.id, target.type, relationshipType);
      setSelectedKey(source.key);
      setTargetKey("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <Surface className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-[var(--karya-border)] p-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="karya-section-label">Relationship Workspace</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--karya-text)]">
              Connected work in {displayWorkspaceName(workspace)}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--karya-muted)]">
              Explore how resources and events depend on, reference, support, and block each other.
            </p>
            <ExplainThisButton capability="relationships" className="mt-2" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <InsightStat label="Objects" value={objects.length} />
            <InsightStat label="Links" value={edges.length} />
            <InsightStat label="Suggestions" value={suggestions.length} />
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="karya-section-label">Graph View</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--karya-text)]">
                  {selectedObject ? displayKaryaObjectTitle(selectedObject) : "No object selected"}
                </h3>
              </div>
              <Badge>{selectedEdges.length} connected</Badge>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {objects.map((object) => {
                  const key = relationshipObjectKey(object);
                  const selected = key === selectedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        "karya-interactive flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                        selected
                          ? "border-[var(--karya-border-strong)] bg-[var(--karya-control-hover)] text-[var(--karya-text)]"
                          : "border-[var(--karya-border)] bg-[var(--karya-control)] text-[var(--karya-muted)] hover:text-[var(--karya-text)]",
                      )}
                      onClick={() => setSelectedKey(key)}
                    >
                      <GitBranch className="h-4 w-4 shrink-0 text-[var(--karya-accent)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{displayKaryaObjectTitle(object)}</span>
                        <span className="block text-xs">{relationshipObjectLabel(object)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="min-h-80 rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-4">
                {selectedObject ? (
                  <div className="flex h-full min-h-72 flex-col justify-center gap-3">
                    <button
                      type="button"
                      className="mx-auto max-w-sm rounded-xl border border-[var(--karya-border-strong)] bg-[var(--karya-surface-strong)] px-4 py-3 text-center shadow-[var(--karya-shadow-button)]"
                      onClick={() =>
                        selectedObject && relationshipObjectType(selectedObject) === "resource"
                          ? onSelectResource(selectedObject.id)
                          : undefined
                      }
                    >
                      <p className="truncate text-sm font-semibold text-[var(--karya-text)]">
                        {displayKaryaObjectTitle(selectedObject)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--karya-muted)]">
                        {relationshipObjectLabel(selectedObject)}
                      </p>
                    </button>
                    <div className="grid gap-2 md:grid-cols-2">
                      {selectedEdges.length ? (
                        selectedEdges.map((edge) => {
                          const neighbor =
                            edge.source.id === selectedObject.id
                              ? edge.target
                              : { id: edge.source.id, type: edge.sourceType };
                          return (
                            <button
                              key={edge.id}
                              type="button"
                              className="karya-interactive rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] p-3 text-left"
                              onClick={() => {
                                setSelectedKey(`${neighbor.type}:${neighbor.id}`);
                                if (neighbor.type === "resource") onSelectResource(neighbor.id);
                              }}
                            >
                              <p className="truncate text-sm font-medium text-[var(--karya-text)]">
                                {relationshipTargetTitle(snapshot, neighbor)}
                              </p>
                              <p className="mt-1 text-xs text-[var(--karya-muted)]">
                                {formatRelationshipType(edge.relationship.type)}
                              </p>
                            </button>
                          );
                        })
                      ) : (
                        <p className="rounded-lg border border-dashed border-[var(--karya-border)] bg-[var(--karya-surface)] p-4 text-sm text-[var(--karya-muted)] md:col-span-2">
                          No relationships yet. Create one from the panel on the right.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--karya-muted)]">
                    Add resources or events to this Workspace to start building a graph.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-4">
              <p className="karya-section-label">Create Relationship</p>
              <div className="mt-3 space-y-2">
                <select
                  className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none"
                  value={sourceKey}
                  onChange={(event) => setSourceKey(event.target.value)}
                >
                  {objectOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.title} · {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none"
                  value={relationshipType}
                  onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}
                >
                  {RELATIONSHIP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatRelationshipType(type)}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none"
                  value={targetKey}
                  onChange={(event) => setTargetKey(event.target.value)}
                >
                  <option value="">Choose target object...</option>
                  {targetOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.title} · {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  className="w-full justify-center"
                  size="sm"
                  disabled={!canSubmitRelationship || busy}
                  onClick={() => void addRelationship()}
                >
                  <Plus className="h-4 w-4" />
                  Add Relationship
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-4">
              <p className="karya-section-label">Suggestions</p>
              <div className="mt-3 space-y-2">
                {suggestions.length ? (
                  suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.source.key}:${suggestion.target.key}`}
                      type="button"
                      className="karya-interactive w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3 text-left"
                      onClick={() => {
                        setSourceKey(suggestion.source.key);
                        setTargetKey(suggestion.target.key);
                        setRelationshipType(suggestion.type);
                      }}
                    >
                      <p className="text-sm font-medium text-[var(--karya-text)]">{suggestion.reason}</p>
                      <p className="mt-1 truncate text-xs text-[var(--karya-muted)]">
                        {suggestion.source.title} → {suggestion.target.title}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--karya-border)] bg-[var(--karya-control)] p-3 text-sm text-[var(--karya-muted)]">
                    No relationship suggestions yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Surface className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="karya-section-label">Connected Resources</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--karya-text)]">
                {filteredEdges.length} relationship links
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] lg:min-w-[520px]">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-muted)]">
                <Search className="h-4 w-4" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[var(--karya-text)] outline-none placeholder:text-[var(--karya-subtle)]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search relationships..."
                />
              </label>
              <select
                className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as RelationshipType | "all")}
              >
                <option value="all">All relationship types</option>
                {RELATIONSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatRelationshipType(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {filteredEdges.length ? (
              filteredEdges.map((edge) => (
                <div
                  key={edge.id}
                  className="grid gap-2 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto] md:items-center"
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => (edge.sourceType === "resource" ? onOpenResource(edge.source.id) : undefined)}
                  >
                    <p className="truncate text-sm font-medium text-[var(--karya-text)]">
                      {displayKaryaObjectTitle(edge.source)}
                    </p>
                    <p className="text-xs text-[var(--karya-muted)]">{relationshipObjectLabel(edge.source)}</p>
                  </button>
                  <Badge>{formatRelationshipType(edge.relationship.type)}</Badge>
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => (edge.target.type === "resource" ? onOpenResource(edge.target.id) : undefined)}
                  >
                    <p className="truncate text-sm font-medium text-[var(--karya-text)]">
                      {relationshipTargetTitle(snapshot, edge.target)}
                    </p>
                    <p className="text-xs text-[var(--karya-muted)]">
                      {edge.target.type === "event" ? "Calendar Event" : "Resource"}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onRemoveRelationship(edge.source.id, edge.sourceType, edge.relationship.id)}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--karya-border)] bg-[var(--karya-control)] p-4 text-sm text-[var(--karya-muted)]">
                No relationships match this view.
              </p>
            )}
          </div>
        </Surface>

        <Surface className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="karya-section-label">Timeline</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--karya-text)]">Recent relationship additions</h3>
            </div>
            <Badge>{relationshipActivities.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {relationshipActivities.length ? (
              relationshipActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3"
                >
                  <p className="text-sm font-medium text-[var(--karya-text)]">{activity.title}</p>
                  <p className="mt-1 text-xs text-[var(--karya-muted)]">
                    {formatActivityType(activity.verb)} · {formatShortDate(activity.occurredAt)} · {activity.groupCount}{" "}
                    grouped
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--karya-border)] bg-[var(--karya-control)] p-4 text-sm text-[var(--karya-muted)]">
                No relationship activity has been recorded yet.
              </p>
            )}
          </div>
        </Surface>
      </div>
    </section>
  );
}

function workspaceRelationshipObjects(snapshot: KernelSnapshot, workspaceId: string): RelationshipObject[] {
  return [
    ...snapshot.resources.all
      .filter(isVisibleResource)
      .filter(
        (resource) => resource.workspaceRefs.includes(workspaceId) || resource.primaryWorkspaceId === workspaceId,
      ),
    ...snapshot.events.all.filter(
      (event) =>
        event.lifecycleState !== "deleted" &&
        (event.workspaceRefs.includes(workspaceId) || event.primaryWorkspaceId === workspaceId),
    ),
  ];
}

function countWorkspaceRelationships(resources: ResourceSnapshot[], events: EventSnapshot[]): number {
  return uniqueRelationshipEdges([...resources, ...events], undefined).length;
}

function uniqueRelationshipEdges(objects: RelationshipObject[], snapshot?: KernelSnapshot): RelationshipEdge[] {
  const localObjects = new Map(objects.map((object) => [relationshipObjectKey(object), object]));
  const seen = new Set<string>();
  return objects.flatMap((source) => {
    const sourceType = relationshipObjectType(source);
    return source.relationships
      .map((relationship): RelationshipEdge | undefined => {
        const target = relationshipTarget(relationship);
        const graphKey =
          relationship.metadata?.graphEdgeId ??
          [relationshipObjectKey(source), `${target.type}:${target.id}`, relationship.type].sort().join(":");
        if (seen.has(graphKey)) return undefined;
        seen.add(graphKey);
        const targetObject =
          localObjects.get(`${target.type}:${target.id}`) ??
          (snapshot && target.type === "event"
            ? snapshot.events.all.find((event) => event.id === target.id)
            : snapshot?.resources.all.find((resource) => resource.id === target.id));
        return {
          id: graphKey,
          source,
          sourceType,
          target,
          targetObject,
          relationship,
        };
      })
      .filter((edge): edge is RelationshipEdge => Boolean(edge));
  });
}

function relationshipObjectKey(object: RelationshipObject): string {
  return `${relationshipObjectType(object)}:${object.id}`;
}

function relationshipObjectType(object: RelationshipObject): RelationshipObjectType {
  return "eventType" in object ? "event" : "resource";
}

function relationshipObjectLabel(object: RelationshipObject): string {
  if ("eventType" in object) return "Calendar Event";
  const kind = (object as unknown as { metadata: { kind?: string } }).metadata.kind;
  if (kind === "task") return "Task";
  if (kind === "bookmark") return "Bookmark";
  if (kind === "note") return "Note";
  return kind || "Resource";
}

function canCreateRelationshipBetween(source: RelationshipObject, target: RelationshipObject): boolean {
  return !isFolderToDirectFileChild(source, target) && !isFolderToDirectFileChild(target, source);
}

function isFolderToDirectFileChild(folder: RelationshipObject, candidateChild: RelationshipObject): boolean {
  return (
    !("eventType" in folder) &&
    !("eventType" in candidateChild) &&
    isFolderRelationshipObject(folder) &&
    !isFolderRelationshipObject(candidateChild) &&
    readRelationshipObjectAttribute(candidateChild, "folderParentId") === folder.id
  );
}

function isFolderRelationshipObject(object: RelationshipObject): boolean {
  return !("eventType" in object) && (object.type === "inode/directory" || object.metadata.kind === "folder");
}

function readRelationshipObjectAttribute(object: RelationshipObject, key: string): string | undefined {
  if ("eventType" in object) return undefined;
  const value = object.metadata.attributes?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildRelationshipSuggestions(
  objects: RelationshipObject[],
  edges: RelationshipEdge[],
): Array<{
  source: { key: string; id: string; type: RelationshipObjectType; title: string };
  target: { key: string; id: string; type: RelationshipObjectType; title: string };
  reason: string;
  type: RelationshipType;
}> {
  const existing = new Set(
    edges.flatMap((edge) => [
      `${relationshipObjectKey(edge.source)}:${edge.target.type}:${edge.target.id}`,
      `${edge.target.type}:${edge.target.id}:${relationshipObjectKey(edge.source)}`,
    ]),
  );
  const suggestions: Array<{
    source: { key: string; id: string; type: RelationshipObjectType; title: string };
    target: { key: string; id: string; type: RelationshipObjectType; title: string };
    reason: string;
    type: RelationshipType;
    score: number;
  }> = [];

  objects.forEach((source, sourceIndex) => {
    objects.slice(sourceIndex + 1).forEach((target) => {
      if (!canCreateRelationshipBetween(source, target)) return;
      const sourceKey = relationshipObjectKey(source);
      const targetKey = relationshipObjectKey(target);
      if (existing.has(`${sourceKey}:${targetKey}`)) return;
      const sourceTitle = displayKaryaObjectTitle(source);
      const targetTitle = displayKaryaObjectTitle(target);
      const sourceText = relationshipSearchText(source);
      const targetText = relationshipSearchText(target);
      const sharedTags = source.tags.filter((tag) => target.tags.includes(tag));
      const mentionsTarget = targetTitle.length > 3 && sourceText.includes(targetTitle.toLowerCase());
      const mentionsSource = sourceTitle.length > 3 && targetText.includes(sourceTitle.toLowerCase());
      const sharedWords = relationshipKeywords(sourceText).filter((word) =>
        relationshipKeywords(targetText).includes(word),
      );
      const score = sharedTags.length * 3 + sharedWords.length + (mentionsTarget || mentionsSource ? 5 : 0);
      if (score <= 1) return;
      suggestions.push({
        source: { key: sourceKey, id: source.id, type: relationshipObjectType(source), title: sourceTitle },
        target: { key: targetKey, id: target.id, type: relationshipObjectType(target), title: targetTitle },
        reason:
          mentionsTarget || mentionsSource
            ? `${sourceTitle} mentions ${targetTitle}.`
            : sharedTags.length
              ? `Both objects share ${sharedTags.slice(0, 2).join(", ")}.`
              : `Similar context appears in both objects.`,
        type: mentionsTarget || mentionsSource ? "references" : "relatedTo",
        score,
      });
    });
  });

  return suggestions
    .sort((left, right) => right.score - left.score)
    .map(({ score: _score, ...suggestion }) => suggestion);
}

function relationshipSearchText(object: RelationshipObject): string {
  return [
    displayKaryaObjectTitle(object),
    object.metadata.description,
    object.tags.join(" "),
    Object.values(object.metadata.attributes ?? {}).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function relationshipKeywords(value: string): string[] {
  return value.split(/[^a-z0-9]+/i).filter((word) => word.length > 4);
}

function InsightStat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

interface ResourceInspectorProps {
  resource?: ResourceSnapshot;
  workspace?: KernelSnapshot["workspaces"]["all"][number];
  onArchive(resourceId: string): void;
  onCheckHealth(resourceId: string): void;
  onCopyPath(resourceId: string): void;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onDelete(resourceId: string): void;
  onDuplicate(resourceId: string): void;
  onMove(resource: ResourceSnapshot): void;
  onOpen(resourceId: string): void;
  onOpenContainingFolder(resourceId: string): void;
  onOpenProfile(profileId: string): void;
  onProperties(resource: ResourceSnapshot): void;
  onRename(resource: ResourceSnapshot): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  onReveal(resourceId: string): void;
  onRestore(resourceId: string): void;
  profiles: Array<{ id: string; name: string; icon?: string; accentColor?: string }>;
  snapshot?: KernelSnapshot;
}

function TaskDetailPanel({
  task,
  onArchive,
  onClose,
  onComplete,
  onCreateRelationship,
  onDelete,
  onNavigateRelationship,
  onRemoveRelationship,
  onReopen,
  snapshot,
  onUpdateTask,
}: {
  task: ResourceSnapshot;
  onArchive?(resourceId: string): void;
  onClose(): void;
  onComplete(resourceId: string): void;
  onCreateRelationship?(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onDelete?(resourceId: string): void;
  onNavigateRelationship?(target: { id: string; type: RelationshipObjectType }): void;
  onRemoveRelationship?(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  onReopen(resourceId: string): void;
  snapshot?: KernelSnapshot;
  onUpdateTask(resourceId: string, patch: TaskPatch): Promise<void>;
}): ReactElement {
  const [title, setTitle] = useState(task.metadata.title);
  const [checklistText, setChecklistText] = useState(readTaskList(task, "taskChecklistItems").join("\n"));
  const [checklistChecked, setChecklistChecked] = useState<boolean[]>(readTaskCompletedList(task));
  const [labelText, setLabelText] = useState(readTaskLabels(task).join(", "));
  const [status, setStatus] = useState<TaskStatus>(readTaskStatus(task));
  const [priority, setPriority] = useState<TaskPriority>(readTaskPriority(task));
  const [dueDate, setDueDate] = useState(readStringAttribute(task, "taskDueDate") ?? "");
  const [reminderDate, setReminderDate] = useState(readStringAttribute(task, "taskReminderDate") ?? "");
  const [reminderTime, setReminderTime] = useState(readStringAttribute(task, "taskReminderTime") ?? "");
  const [reminderRepeat, setReminderRepeat] = useState(readStringAttribute(task, "taskReminderRepeat") ?? "none");
  const [notes, setNotes] = useState(htmlToPlainText(readStringAttribute(task, "taskDescription") ?? ""));
  const [pinned, setPinned] = useState(isTaskPinned(task));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [focusChecklistIndex, setFocusChecklistIndex] = useState<number | undefined>();
  const snapshotStatus = readTaskStatus(task);

  useEffect(() => {
    setTitle(task.metadata.title);
    setChecklistText(readTaskList(task, "taskChecklistItems").join("\n"));
    setChecklistChecked(readTaskCompletedList(task));
    setLabelText(readTaskLabels(task).join(", "));
    setStatus(readTaskStatus(task));
    setPriority(readTaskPriority(task));
    setDueDate(readStringAttribute(task, "taskDueDate") ?? "");
    setReminderDate(readStringAttribute(task, "taskReminderDate") ?? "");
    setReminderTime(readStringAttribute(task, "taskReminderTime") ?? "");
    setReminderRepeat(readStringAttribute(task, "taskReminderRepeat") ?? "none");
    setNotes(htmlToPlainText(readStringAttribute(task, "taskDescription") ?? ""));
    setPinned(isTaskPinned(task));
    setSaveState("saved");
  }, [task.id]);

  useEffect(() => {
    setStatus(snapshotStatus);
  }, [snapshotStatus, task.id]);

  useEffect(() => {
    if (focusChecklistIndex === undefined) return;
    const timeout = window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-task-checklist-index="${focusChecklistIndex}"]`);
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
      setFocusChecklistIndex(undefined);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusChecklistIndex, checklistText]);

  useEffect(() => {
    const nextChecklist = checklistText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const nextChecklistCompleted = checklistText
      .split("\n")
      .map((item, index) => ({ item: item.trim(), checked: checklistChecked[index] ?? false }))
      .filter(({ item }) => Boolean(item))
      .map(({ checked }) => checked);
    const nextLabels = labelText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const dirty =
      title !== task.metadata.title ||
      checklistText !== readTaskList(task, "taskChecklistItems").join("\n") ||
      nextChecklistCompleted.join("\n") !== readTaskCompletedList(task).slice(0, nextChecklist.length).join("\n") ||
      labelText !== readTaskLabels(task).join(", ") ||
      status !== readTaskStatus(task) ||
      priority !== readTaskPriority(task) ||
      dueDate !== (readStringAttribute(task, "taskDueDate") ?? "") ||
      reminderDate !== (readStringAttribute(task, "taskReminderDate") ?? "") ||
      reminderTime !== (readStringAttribute(task, "taskReminderTime") ?? "") ||
      reminderRepeat !== (readStringAttribute(task, "taskReminderRepeat") ?? "none") ||
      notes !== htmlToPlainText(readStringAttribute(task, "taskDescription") ?? "") ||
      pinned !== isTaskPinned(task);
    if (!dirty) {
      setSaveState("saved");
      return;
    }
    setSaveState("dirty");
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      await onUpdateTask(task.id, {
        title: title.trim() || "Untitled Task",
        checklistItems: nextChecklist,
        checklistCompleted: nextChecklistCompleted,
        labels: nextLabels,
        description: notes,
        status,
        priority,
        dueDate,
        reminderDate,
        reminderTime,
        reminderRepeat,
        reminderAt: reminderDate ? `${reminderDate}${reminderTime ? `T${reminderTime}` : ""}` : "",
        pinned,
      });
      setSaveState("saved");
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [
    checklistChecked,
    checklistText,
    dueDate,
    labelText,
    notes,
    pinned,
    priority,
    reminderDate,
    reminderRepeat,
    reminderTime,
    status,
    task.id,
    title,
  ]);

  const labels = labelText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const checklistItems = checklistText.split("\n");
  const completed = status === "completed";
  const setChecklistItem = (index: number, value: string) => {
    const nextItems = [...checklistItems];
    nextItems[index] = value;
    setChecklistText(nextItems.join("\n"));
  };
  const toggleChecklistItem = (index: number) => {
    const nextChecked = [...checklistChecked];
    nextChecked[index] = !(nextChecked[index] ?? false);
    setChecklistChecked(nextChecked);
  };
  const insertChecklistItem = (index: number) => {
    const nextItems = [...checklistItems];
    nextItems.splice(index + 1, 0, "");
    const nextChecked = [...checklistChecked];
    nextChecked.splice(index + 1, 0, false);
    setChecklistChecked(nextChecked);
    setChecklistText(nextItems.join("\n"));
    setFocusChecklistIndex(index + 1);
  };
  const removeChecklistItem = (index: number) => {
    setChecklistChecked(checklistChecked.filter((_, itemIndex) => itemIndex !== index));
    setChecklistText(checklistItems.filter((_, itemIndex) => itemIndex !== index).join("\n"));
    setFocusChecklistIndex(Math.max(0, index - 1));
  };
  const addChecklistItem = () => {
    setChecklistChecked([...checklistChecked, false]);
    setChecklistText([...checklistItems, ""].join("\n"));
    setFocusChecklistIndex(checklistItems.length);
  };
  const removeLabel = (label: string) => {
    setLabelText(labels.filter((item) => item !== label).join(", "));
  };

  return (
    <aside className="karya-slide-panel hidden min-w-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-4 xl:block 2xl:p-5">
      <Surface className="min-w-0 p-0">
        <div className="border-b border-zinc-200 p-4 2xl:p-5">
          <div className="flex items-start justify-between gap-3">
            <input
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title={pinned ? "Unpin" : "Pin"} onClick={() => setPinned(!pinned)}>
                {pinned ? <Pin className="h-4 w-4 fill-zinc-900" /> : <PinOff className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" title="Close" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{formatTaskStatus(status)}</Badge>
            <Badge>{formatTaskPriority(priority)}</Badge>
            <Badge>{saveState === "saved" ? "Autosaved" : saveState === "saving" ? "Saving" : "Unsaved"}</Badge>
          </div>
        </div>

        <div className="space-y-5 p-4 2xl:p-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Status</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {(["todo", "in-progress", "completed"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150",
                    status === item ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500 hover:bg-white",
                  )}
                  onClick={() => setStatus(item)}
                >
                  {formatTaskStatus(item)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Checklist</p>
            <div className="space-y-2">
              {checklistItems.length
                ? checklistItems.map((item, index) => (
                    <div
                      key={index}
                      className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 transition-colors focus-within:border-zinc-400"
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                          checklistChecked[index]
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-zinc-300 bg-white",
                        )}
                        onClick={() => toggleChecklistItem(index)}
                        aria-label={
                          checklistChecked[index] ? "Mark checklist item incomplete" : "Mark checklist item complete"
                        }
                      >
                        {checklistChecked[index] ? <CheckSquare className="h-3 w-3" /> : null}
                      </button>
                      <input
                        data-task-checklist-index={index}
                        className={cn(
                          "min-w-0 flex-1 bg-transparent text-sm outline-none",
                          checklistChecked[index] ? "text-zinc-500 line-through" : "",
                        )}
                        value={item}
                        onChange={(event) => setChecklistItem(index, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          if (!item.trim() && checklistItems.length > 1) {
                            removeChecklistItem(index);
                            return;
                          }
                          insertChecklistItem(index);
                        }}
                        placeholder={index === 0 ? "Add checklist item" : "Checklist item"}
                      />
                      <button
                        type="button"
                        className="rounded p-1 text-zinc-300 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100"
                        onClick={() => removeChecklistItem(index)}
                        aria-label="Remove checklist item"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                : null}
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={addChecklistItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Labels</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-800"
                  style={{ backgroundColor: labelColor(label).background }}
                >
                  {label}
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-white/50"
                    onClick={() => removeLabel(label)}
                    aria-label={`Remove ${label} label`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={labelText}
              onChange={(event) => setLabelText(event.target.value)}
              placeholder="Design, High"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium uppercase text-zinc-400">
              Reminder Date
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none"
                type="date"
                value={reminderDate}
                onChange={(event) => setReminderDate(event.target.value)}
              />
            </label>
            <label className="text-xs font-medium uppercase text-zinc-400">
              Time
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none"
                type="time"
                value={reminderTime}
                onChange={(event) => setReminderTime(event.target.value)}
              />
            </label>
            <label className="col-span-2 text-xs font-medium uppercase text-zinc-400">
              Repeat
              <select
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none"
                value={reminderRepeat}
                onChange={(event) => setReminderRepeat(event.target.value)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-medium uppercase text-zinc-400">
            Due Date
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm normal-case text-zinc-900 outline-none"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">Priority</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {(["none", "low", "medium", "high", "critical"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150",
                    priority === item ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500 hover:bg-white",
                    item === "none" ? "col-span-2" : "",
                  )}
                  onClick={() => setPriority(item)}
                >
                  {formatTaskPriority(item)}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-medium uppercase text-zinc-400">
            Notes
            <textarea
              className="mt-1 min-h-28 w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 normal-case text-zinc-900 outline-none focus:border-zinc-400"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {snapshot && onCreateRelationship && onRemoveRelationship ? (
            <RelationshipPanel
              object={task}
              objectType="resource"
              snapshot={snapshot}
              onCreateRelationship={onCreateRelationship}
              onNavigate={onNavigateRelationship}
              onRemoveRelationship={onRemoveRelationship}
            />
          ) : null}
          {snapshot ? (
            <ActivityCenterPanel snapshot={snapshot} objectKey={`resource:${task.id}`} title="Activity" compact />
          ) : null}

          <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            <p>Created {formatShortDate(task.metadata.createdAt)}</p>
            <p className="mt-1">Last edited {formatShortDate(task.metadata.updatedAt)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 p-4">
          {onArchive ? (
            <Button variant="ghost" size="sm" onClick={() => onArchive(task.id)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          ) : (
            <span />
          )}
          {onDelete ? (
            <Button variant="ghost" size="sm" onClick={() => onDelete(task.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : null}
          {completed ? (
            <Button variant="secondary" size="sm" onClick={() => onReopen(task.id)}>
              Reopen
            </Button>
          ) : (
            <Button size="sm" onClick={() => onComplete(task.id)}>
              Complete
            </Button>
          )}
        </div>
      </Surface>
    </aside>
  );
}

function ResourceInspector({
  resource,
  workspace,
  onArchive,
  onCheckHealth,
  onCopyPath,
  onCreateRelationship,
  onDelete,
  onDuplicate,
  onMove,
  onOpen,
  onOpenContainingFolder,
  onOpenProfile,
  onProperties,
  onRename,
  onRemoveRelationship,
  onReveal,
  onRestore,
  profiles,
  snapshot,
}: ResourceInspectorProps): ReactElement {
  const location = readStringAttribute(resource, "contentSourcePath");
  const health =
    readStringAttribute(resource, "resourceHealth") ??
    (resource?.lifecycleState === "archived" ? "archived" : "available");
  const mimeType = readStringAttribute(resource, "contentMimeType") ?? resource?.type ?? resource?.metadata.kind;
  const isBookmark = isBookmarkResource(resource);
  const isEditableNote = isEditableNativeNote(resource);
  const resourceActivities = resource ? getResourceActivities(snapshot, resource.id) : [];

  return (
    <aside className="hidden min-w-0 overflow-y-auto border-l border-[var(--karya-border)] bg-[var(--karya-bg-elevated)] p-4 2xl:block">
      {resource ? (
        <Surface className="karya-slide-panel min-w-0 overflow-hidden p-0">
          <div className="sticky top-0 z-10 border-b border-[var(--karya-border)] bg-[var(--karya-surface)]/95 p-4 backdrop-blur-xl">
            <p className="karya-section-label">Inspector</p>
            <div className="mt-2 min-w-0">
              <h2 className="truncate text-base font-semibold text-[var(--karya-text)]">
                {displayResourceTitle(resource)}
              </h2>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--karya-muted)]">
                {resource.metadata.description || mimeType || resource.metadata.kind}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge>{resource.metadata.kind}</Badge>
              <Badge>{health}</Badge>
              <Badge>{resource.lifecycleState}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                className="justify-start text-xs"
                title="Open"
                onClick={() => onOpen(resource.id)}
                disabled={!location && !isEditableNote && !isBookmark}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Reveal"
                onClick={() => onReveal(resource.id)}
                disabled={!location}
              >
                <FolderOpen className="h-4 w-4" />
                Reveal
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Rename"
                disabled={resource.lifecycleState === "archived"}
                onClick={() => onRename(resource)}
              >
                <Pencil className="h-4 w-4" />
                Rename
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Move"
                disabled={resource.lifecycleState === "archived"}
                onClick={() => onMove(resource)}
              >
                <FolderInput className="h-4 w-4" />
                Move
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Duplicate"
                onClick={() => onDuplicate(resource.id)}
              >
                <Clipboard className="h-4 w-4" />
                Duplicate
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Copy Path"
                onClick={() => onCopyPath(resource.id)}
                disabled={!location}
              >
                <Clipboard className="h-4 w-4" />
                Copy Path
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Properties"
                onClick={() => onProperties(resource)}
              >
                <Settings className="h-4 w-4" />
                Properties
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Containing Folder"
                onClick={() => onOpenContainingFolder(resource.id)}
                disabled={!location}
              >
                <FolderOpen className="h-4 w-4" />
                Folder
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Check Health"
                onClick={() => onCheckHealth(resource.id)}
              >
                <RefreshCw className="h-4 w-4" />
                Check
              </Button>
              {resource.lifecycleState === "archived" ? (
                <Button
                  size="sm"
                  className="justify-start text-xs"
                  variant="secondary"
                  title="Restore"
                  onClick={() => onRestore(resource.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="justify-start text-xs"
                  variant="secondary"
                  title="Archive"
                  onClick={() => onArchive(resource.id)}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              )}
              <Button
                size="sm"
                className="justify-start text-xs"
                variant="secondary"
                title="Delete"
                onClick={() => onDelete(resource.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          <ContextualResourceInspectorBody
            resource={resource}
            location={location}
            mimeType={mimeType}
            profiles={profiles}
            snapshot={snapshot}
            onArchive={onArchive}
            onCheckHealth={onCheckHealth}
            onCopyPath={onCopyPath}
            onCreateRelationship={onCreateRelationship}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onOpen={onOpen}
            onOpenContainingFolder={onOpenContainingFolder}
            onOpenProfile={onOpenProfile}
            onProperties={onProperties}
            onRemoveRelationship={onRemoveRelationship}
            onRestore={onRestore}
          />
        </Surface>
      ) : workspace ? (
        <WorkspaceInspector workspace={workspace} snapshot={snapshot} />
      ) : (
        <Surface className="flex min-h-64 items-center justify-center p-6 text-center">
          <div>
            <p className="text-sm font-medium text-[var(--karya-text)]">No resource selected</p>
            <p className="mt-1 text-sm text-[var(--karya-muted)]">
              Select a note, task, file, or bookmark to inspect its context.
            </p>
          </div>
        </Surface>
      )}
    </aside>
  );
}

function ContextualResourceInspectorBody({
  location,
  mimeType,
  onArchive,
  onCheckHealth,
  onCopyPath,
  onCreateRelationship,
  onDelete,
  onDuplicate,
  onOpen,
  onOpenContainingFolder,
  onOpenProfile,
  onProperties,
  onRemoveRelationship,
  onRestore,
  profiles,
  resource,
  snapshot,
}: {
  resource: ResourceSnapshot;
  location?: string;
  mimeType?: string;
  profiles: Array<{ id: string; name: string; icon?: string; accentColor?: string }>;
  snapshot?: KernelSnapshot;
  onArchive(resourceId: string): void;
  onCheckHealth(resourceId: string): void;
  onCopyPath(resourceId: string): void;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onDelete(resourceId: string): void;
  onDuplicate(resourceId: string): void;
  onOpen(resourceId: string): void;
  onOpenContainingFolder(resourceId: string): void;
  onOpenProfile(profileId: string): void;
  onProperties(resource: ResourceSnapshot): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  onRestore(resourceId: string): void;
}): ReactElement {
  const isNote = resource.metadata.kind === "note";
  const isTask = isTaskResource(resource);
  const isBookmark = isBookmarkResource(resource);
  const isFolder = resource.metadata.kind === "folder" || resource.type === "inode/directory";
  const isDesktopResource =
    resource.defaultSpace === "user" || resource.workspaceRefs.includes(DESKTOP_HOME_DEFAULT_SPACE_ID);
  const ownerProfile = profiles.find((profile) => profile.id === resource.profileId);
  const resourceActivities = getResourceActivities(snapshot, resource.id);
  const lastOpened = resourceActivities.find((activity) => activity.type === "resource-opened");
  const linkedTasks =
    snapshot?.resources.all
      .filter(isTaskResource)
      .filter(
        (task) =>
          task.relationships.some((relationship) => relationshipTarget(relationship).id === resource.id) ||
          resource.relationships.some((relationship) => relationshipTarget(relationship).id === task.id),
      )
      .slice(0, 4) ?? [];
  const relatedResources = resource.relationships.filter(
    (relationship) => relationshipTargetType(relationship) === "resource",
  ).length;
  const relatedEvents = resource.relationships.filter(
    (relationship) => relationshipTargetType(relationship) === "event",
  ).length;
  const domain = readBookmarkDomain(resource) || readStringAttribute(resource, "bookmarkDomain") || "No domain";
  const url = readStringAttribute(resource, "bookmarkUrl") ?? readStringAttribute(resource, "url");
  const previewResource = resource;

  return (
    <div className="space-y-3 p-4">
      {isNote ? (
        <InspectorSection title="Note" defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <InspectorRow label="Created" value={formatShortDate(resource.metadata.createdAt)} />
            <InspectorRow
              label="Last Edited"
              value={formatShortDate(readStringAttribute(resource, "noteLastEditedAt") ?? resource.metadata.updatedAt)}
            />
            <InspectorRow
              label="Word Count"
              value={String(
                readNumberAttribute(resource, "noteWordCount") ??
                  countWords(readStringAttribute(resource, "noteContent") ?? resource.metadata.description ?? ""),
              )}
            />
            <InspectorRow label="Linked Tasks" value={String(linkedTasks.length)} />
          </div>
          {linkedTasks.length ? (
            <div className="mt-3 space-y-2">
              {linkedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-2 text-left"
                  onClick={() => onOpen(task.id)}
                >
                  <p className="truncate text-sm font-medium text-[var(--karya-text)]">{task.metadata.title}</p>
                  <p className="mt-1 text-xs text-[var(--karya-muted)]">{formatTaskStatus(readTaskStatus(task))}</p>
                </button>
              ))}
            </div>
          ) : null}
        </InspectorSection>
      ) : null}

      {isTask ? (
        <InspectorSection title="Task" defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <InspectorRow label="Status" value={formatTaskStatus(readTaskStatus(resource))} />
            <InspectorRow label="Priority" value={formatTaskPriority(readTaskPriority(resource))} />
            <InspectorRow label="Due Date" value={readStringAttribute(resource, "taskDueDate") ?? "None"} />
            <InspectorRow
              label="Reminder"
              value={
                readStringAttribute(resource, "taskReminderAt") ??
                readStringAttribute(resource, "taskReminderDate") ??
                "None"
              }
            />
            <InspectorRow label="Parent Task" value={readStringAttribute(resource, "taskParentId") ?? "None"} />
            <InspectorRow label="Linked Resources" value={String(relatedResources)} />
          </div>
        </InspectorSection>
      ) : null}

      {isBookmark ? (
        <InspectorSection title="Bookmark" defaultOpen>
          <div className="grid grid-cols-1 gap-2">
            <InspectorRow label="URL" value={url ?? "No URL"} />
            <InspectorRow label="Domain" value={domain} />
            <InspectorRow label="Collections" value={readBookmarkLabels(resource).join(", ") || "None"} />
            <InspectorRow label="Related Resources" value={String(relatedResources)} />
          </div>
        </InspectorSection>
      ) : null}

      {!isNote && !isTask && !isBookmark ? (
        <InspectorSection title={isFolder ? "Folder Preview" : "Preview"} defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <InspectorRow label="Type" value={mimeType ?? previewResource.metadata.kind} />
            <InspectorRow
              label="Version"
              value={String(readNumberAttribute(previewResource, "resourceVersion") ?? 1)}
            />
            <InspectorRow label="Modified" value={formatShortDate(previewResource.metadata.updatedAt)} />
            <InspectorRow
              label="Last Opened"
              value={lastOpened?.occurredAt ? formatShortDate(lastOpened.occurredAt) : "Not opened"}
            />
            {isFolder ? (
              <InspectorRow label="Children" value={String(readNumberAttribute(resource, "folderChildCount") ?? 0)} />
            ) : null}
            {isFolder ? (
              <InspectorRow label="Indexed" value={String(readNumberAttribute(resource, "folderIndexedCount") ?? 0)} />
            ) : null}
          </div>
        </InspectorSection>
      ) : null}

      {snapshot ? (
        <RelationshipSummaryPanel
          object={resource}
          objectType="resource"
          snapshot={snapshot}
          onNavigate={(target) => {
            if (target.type === "resource") onOpen(target.id);
          }}
          onRemoveRelationship={onRemoveRelationship}
        />
      ) : null}

      <InspectorSection title="Linked Workspaces">
        <div className="space-y-2">
          {resource.workspaceRefs.length ? (
            resource.workspaceRefs.map((workspaceId) => {
              const workspace = snapshot?.workspaces.all.find((candidate) => candidate.id === workspaceId);
              return (
                <InspectorRow
                  key={workspaceId}
                  label={workspaceId === resource.primaryWorkspaceId ? "Primary" : "Linked"}
                  value={workspace ? displayWorkspaceName(workspace) : workspaceId}
                />
              );
            })
          ) : (
            <p className="text-sm text-[var(--karya-muted)]">No linked workspaces.</p>
          )}
        </div>
      </InspectorSection>

      <InspectorSection title="Metadata">
        <div className="grid grid-cols-2 gap-2">
          <InspectorRow
            label="Owner"
            value={isDesktopResource ? "Desktop" : (ownerProfile?.name ?? resource.profileId)}
          />
          <InspectorRow label="Kind" value={resource.metadata.kind} />
          <InspectorRow label="Created" value={formatShortDate(resource.metadata.createdAt)} />
          <InspectorRow label="Relations" value={`${relatedResources} resources / ${relatedEvents} events`} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onDuplicate(resource.id)}>
            <Clipboard className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onProperties(resource)}>
            <Settings className="mr-2 h-4 w-4" />
            Properties
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenContainingFolder(resource.id)} disabled={!location}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Folder
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onCopyPath(resource.id)} disabled={!location}>
            <Clipboard className="mr-2 h-4 w-4" />
            Copy Path
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onCheckHealth(resource.id)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Check
          </Button>
          {resource.lifecycleState === "archived" ? (
            <Button size="sm" variant="secondary" onClick={() => onRestore(resource.id)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => onArchive(resource.id)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(resource.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          {!isDesktopResource ? (
            <Button size="sm" variant="ghost" onClick={() => onOpenProfile(resource.profileId)}>
              Profile
            </Button>
          ) : null}
        </div>
      </InspectorSection>

      <InspectorSection title="Tags">
        <div className="flex flex-wrap gap-2">
          {resource.tags.length ? (
            resource.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
          ) : (
            <p className="text-sm text-[var(--karya-muted)]">No tags yet.</p>
          )}
        </div>
      </InspectorSection>
    </div>
  );
}

function WorkspaceInspector({
  workspace,
  snapshot,
}: {
  workspace: KernelSnapshot["workspaces"]["all"][number];
  snapshot?: KernelSnapshot;
}): ReactElement {
  const resources = snapshot?.workspaces.resourceIdsByWorkspace[workspace.id] ?? [];
  const ownerProfile = snapshot?.profiles.all.find((profile) => profile.id === workspace.profileId);
  const isDefaultSpace =
    workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID || ownerProfile?.defaultSpaceId === workspace.id;
  const preferredApplications = workspace.pinnedApplicationIds
    .map(
      (applicationId) =>
        snapshot?.applications.installed.find((application) => application.metadata.id === applicationId)?.metadata
          .name,
    )
    .filter((name): name is string => Boolean(name));
  const taskCount =
    snapshot?.resources.all
      .filter(isTaskResource)
      .filter(
        (resource) => resource.workspaceRefs.includes(workspace.id) || resource.primaryWorkspaceId === workspace.id,
      ).length ?? 0;
  const eventCount =
    snapshot?.events.all.filter(
      (event) =>
        event.lifecycleState !== "deleted" &&
        (event.workspaceRefs.includes(workspace.id) || event.primaryWorkspaceId === workspace.id),
    ).length ?? 0;

  return (
    <Surface className="karya-slide-panel min-w-0 overflow-hidden p-0">
      <div className="sticky top-0 z-10 border-b border-[var(--karya-border)] bg-[var(--karya-surface)]/95 p-4 backdrop-blur-xl">
        <p className="karya-section-label">{isDefaultSpace ? "Inbox Inspector" : "Project Inspector"}</p>
        <h2 className="mt-2 truncate text-base font-semibold text-[var(--karya-text)]">
          {displayWorkspaceName(workspace)}
        </h2>
        <p className="mt-1 line-clamp-2 text-xs text-[var(--karya-muted)]">
          {workspace.metadata.description ??
            (isDefaultSpace ? "Inbox for captures, imports, and unsorted resources." : "Project context and defaults.")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isDefaultSpace ? <Badge>Inbox</Badge> : null}
          <Badge>{workspace.lifecycleState}</Badge>
          {workspace.pinned ? <Badge>Pinned</Badge> : null}
        </div>
      </div>
      <div className="space-y-3 p-4">
        {isDefaultSpace ? (
          <InspectorSection title="Inbox Properties" defaultOpen>
            <div className="grid grid-cols-1 gap-2">
              <InspectorRow
                label="Description"
                value={
                  workspace.metadata.description ??
                  "Inbox for temporary resources, captures, imports, and unorganized work."
                }
              />
              <InspectorRow label="Default Import Behaviour" value="Capture here before placement" />
              <InspectorRow
                label="Capture Rules"
                value="Imports, screenshots, scratch notes, and temporary resources enter here first."
              />
              <InspectorRow
                label="Auto Placement"
                value="Automatic placement can move items into Projects when context is clear."
              />
              <InspectorRow label="Cleanup" value="Review and move durable items into Projects." />
              <InspectorRow label="Archive Policy" value="Inbox remains available." />
            </div>
          </InspectorSection>
        ) : (
          <InspectorSection title="Project Properties" defaultOpen>
            <div className="grid grid-cols-1 gap-2">
              <InspectorRow label="Description" value={workspace.metadata.description ?? "No description"} />
              <InspectorRow label="Profile" value={workspace.profileId} />
              <InspectorRow
                label="Last Opened"
                value={workspace.lastOpenedAt ? formatShortDate(workspace.lastOpenedAt) : "New"}
              />
            </div>
          </InspectorSection>
        )}
        {!isDefaultSpace ? (
          <InspectorSection title="Members">
            <p className="text-sm text-[var(--karya-muted)]">Members are reserved for shared Workspaces.</p>
          </InspectorSection>
        ) : null}
        {!isDefaultSpace ? (
          <InspectorSection title="Statistics">
            <div className="grid grid-cols-2 gap-2">
              <InspectorRow label="Resources" value={String(resources.length)} />
              <InspectorRow label="Tasks" value={String(taskCount)} />
              <InspectorRow label="Events" value={String(eventCount)} />
              <InspectorRow label="Applications" value={String(workspace.pinnedApplicationIds.length)} />
            </div>
          </InspectorSection>
        ) : null}
        {!isDefaultSpace ? (
          <InspectorSection title="Default Applications">
            <div className="space-y-2">
              {preferredApplications.length ? (
                preferredApplications.map((name) => <InspectorRow key={name} label="Application" value={name} />)
              ) : (
                <p className="text-sm text-[var(--karya-muted)]">No default applications attached.</p>
              )}
            </div>
          </InspectorSection>
        ) : null}
      </div>
    </Surface>
  );
}

type RelationshipObject = ResourceSnapshot | EventSnapshot;

function RelationshipPanel({
  object,
  objectType,
  onCreateRelationship,
  onNavigate,
  onRemoveRelationship,
  snapshot,
}: {
  object: RelationshipObject;
  objectType: RelationshipObjectType;
  onCreateRelationship(
    sourceId: string,
    sourceType: RelationshipObjectType,
    targetId: string,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  onNavigate?(target: { id: string; type: RelationshipObjectType }): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  snapshot: KernelSnapshot;
}): ReactElement {
  const [targetKey, setTargetKey] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("relatedTo");
  const [busy, setBusy] = useState(false);
  const options = [
    ...snapshot.resources.all.map((resource) => ({
      key: `resource:${resource.id}`,
      id: resource.id,
      type: "resource" as const,
      title: displayResourceTitle(resource),
      label: "Resource",
    })),
    ...snapshot.events.all
      .filter((event) => event.lifecycleState !== "deleted")
      .map((event) => ({
        key: `event:${event.id}`,
        id: event.id,
        type: "event" as const,
        title: event.metadata.title,
        label: "Event",
      })),
  ].filter((option) => !(option.id === object.id && option.type === objectType));
  const selectedTarget = options.find((option) => option.key === targetKey);
  const relatedResources = object.relationships.filter(
    (relationship) => relationshipTargetType(relationship) === "resource",
  );
  const relatedEvents = object.relationships.filter((relationship) => relationshipTargetType(relationship) === "event");
  const graphRelationships = object.relationships.slice(0, 4);
  const suggestions = options.slice(0, 3);

  const addRelationship = async () => {
    if (!selectedTarget) return;
    setBusy(true);
    try {
      await onCreateRelationship(object.id, objectType, selectedTarget.id, selectedTarget.type, relationshipType);
      setTargetKey("");
      setRelationshipType("relatedTo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-3 shadow-[var(--karya-shadow-button)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="karya-section-label">Relationship Graph</p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--karya-text)]">
            {object.relationships.length} connected objects
          </h3>
        </div>
        <Badge>{objectType === "event" ? "Calendar Event" : "Resource"}</Badge>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="max-w-28 shrink-0 truncate rounded-full bg-[var(--karya-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--karya-text)] shadow-[var(--karya-shadow-button)]">
            {displayKaryaObjectTitle(object)}
          </span>
          {graphRelationships.length ? (
            graphRelationships.map((relationship) => {
              const target = relationshipTarget(relationship);
              return (
                <div key={relationship.id} className="flex shrink-0 items-center gap-2">
                  <span className="text-[var(--karya-subtle)]">→</span>
                  <button
                    type="button"
                    className="karya-interactive max-w-32 truncate rounded-full border border-[var(--karya-border)] bg-[var(--karya-surface)] px-3 py-1.5 text-xs font-medium text-[var(--karya-text)]"
                    onClick={() => onNavigate?.(target)}
                  >
                    {relationshipTargetTitle(snapshot, target)}
                  </button>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-[var(--karya-muted)]">No relationships yet.</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <select
          className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-strong)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none transition focus:border-[var(--karya-border-strong)] focus:ring-2 focus:ring-[var(--karya-ring-soft)]"
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          <option value="">Add related object...</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.title} · {option.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select
            className="min-w-0 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-strong)] px-3 py-2 text-sm text-[var(--karya-text)] outline-none transition focus:border-[var(--karya-border-strong)] focus:ring-2 focus:ring-[var(--karya-ring-soft)]"
            value={relationshipType}
            onChange={(event) => setRelationshipType(event.target.value as RelationshipType)}
          >
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatRelationshipType(type)}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!selectedTarget || busy} onClick={() => void addRelationship()}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {suggestions.length ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-[var(--karya-subtle)]">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.key}
                type="button"
                className="karya-interactive max-w-full truncate rounded-full border border-[var(--karya-border)] bg-[var(--karya-control)] px-3 py-1.5 text-xs text-[var(--karya-muted)] hover:bg-[var(--karya-control-hover)] hover:text-[var(--karya-text)]"
                onClick={() => setTargetKey(suggestion.key)}
              >
                {suggestion.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <RelationshipGroup
        title="Related Resources"
        relationships={relatedResources}
        snapshot={snapshot}
        onNavigate={onNavigate}
        onRemove={(relationshipId) => onRemoveRelationship(object.id, objectType, relationshipId)}
      />
      <RelationshipGroup
        title="Related Events"
        relationships={relatedEvents}
        snapshot={snapshot}
        onNavigate={onNavigate}
        onRemove={(relationshipId) => onRemoveRelationship(object.id, objectType, relationshipId)}
      />
    </section>
  );
}

function RelationshipGroup({
  onNavigate,
  onRemove,
  relationships,
  snapshot,
  title,
}: {
  title: string;
  relationships: RelationshipObject["relationships"];
  snapshot: KernelSnapshot;
  onNavigate?(target: { id: string; type: RelationshipObjectType }): void;
  onRemove(relationshipId: string): Promise<void>;
}): ReactElement {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase text-[var(--karya-subtle)]">{title}</p>
      <div className="space-y-2">
        {relationships.length ? (
          relationships.map((relationship) => {
            const target = relationshipTarget(relationship);
            const label = relationshipTargetTitle(snapshot, target);
            return (
              <div
                key={relationship.id}
                className="karya-interactive flex items-center justify-between gap-2 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-2"
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onNavigate?.(target)}>
                  <p className="truncate text-sm font-medium text-[var(--karya-text)]">{label}</p>
                  <p className="mt-0.5 text-xs text-[var(--karya-muted)]">
                    {formatRelationshipType(relationship.type)}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remove relationship"
                  onClick={() => void onRemove(relationship.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--karya-border)] bg-[var(--karya-control)] p-3 text-xs text-[var(--karya-muted)]">
            No objects linked here yet.
          </p>
        )}
      </div>
    </div>
  );
}

function RelationshipSummaryPanel({
  object,
  objectType,
  onNavigate,
  onRemoveRelationship,
  snapshot,
}: {
  object: RelationshipObject;
  objectType: RelationshipObjectType;
  onNavigate?(target: { id: string; type: RelationshipObjectType }): void;
  onRemoveRelationship(sourceId: string, sourceType: RelationshipObjectType, relationshipId: string): Promise<void>;
  snapshot: KernelSnapshot;
}): ReactElement {
  const relationships = object.relationships.slice(0, 4);
  const relatedResources = object.relationships.filter(
    (relationship) => relationshipTargetType(relationship) === "resource",
  ).length;
  const relatedEvents = object.relationships.filter(
    (relationship) => relationshipTargetType(relationship) === "event",
  ).length;

  return (
    <section className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] p-3 shadow-[var(--karya-shadow-button)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="karya-section-label">Relationships</p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--karya-text)]">
            {object.relationships.length} connected objects
          </h3>
        </div>
        <Badge>{objectType === "event" ? "Calendar Event" : "Resource"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <InspectorRow label="Related Resources" value={String(relatedResources)} />
        <InspectorRow label="Related Events" value={String(relatedEvents)} />
      </div>
      <div className="mt-3 space-y-2">
        {relationships.length ? (
          relationships.map((relationship) => {
            const target = relationshipTarget(relationship);
            return (
              <div
                key={relationship.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-control)] p-2"
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onNavigate?.(target)}>
                  <p className="truncate text-sm font-medium text-[var(--karya-text)]">
                    {relationshipTargetTitle(snapshot, target)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--karya-muted)]">
                    {formatRelationshipType(relationship.type)}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remove relationship"
                  onClick={() => void onRemoveRelationship(object.id, objectType, relationship.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--karya-border)] bg-[var(--karya-control)] p-3 text-xs text-[var(--karya-muted)]">
            No objects linked yet. Use the Workspace Relationships tab to build the graph.
          </p>
        )}
      </div>
    </section>
  );
}

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "references",
  "dependsOn",
  "relatedTo",
  "parentOf",
  "childOf",
  "duplicateOf",
  "inspiredBy",
  "supports",
  "blocks",
  "custom",
  "createdFrom",
  "attachment",
];

function relationshipTarget(relationship: RelationshipObject["relationships"][number]): {
  id: string;
  type: RelationshipObjectType;
} {
  return {
    id: relationship.targetObjectId ?? relationship.metadata?.targetObjectId ?? relationship.targetResourceId,
    type: relationshipTargetType(relationship),
  };
}

function relationshipTargetType(relationship: RelationshipObject["relationships"][number]): RelationshipObjectType {
  return relationship.targetObjectType ?? (relationship.metadata?.targetObjectType === "event" ? "event" : "resource");
}

function relationshipTargetTitle(
  snapshot: KernelSnapshot,
  target: { id: string; type: RelationshipObjectType },
): string {
  if (target.type === "event") {
    return snapshot.events.all.find((event) => event.id === target.id)?.metadata.title ?? target.id;
  }
  const resource = snapshot.resources.all.find((item) => item.id === target.id);
  return resource ? displayResourceTitle(resource) : target.id;
}

function formatRelationshipType(type: RelationshipType): string {
  const labels: Record<RelationshipType, string> = {
    relatedTo: "Related To",
    dependsOn: "Depends On",
    references: "References",
    createdFrom: "Created From",
    duplicateOf: "Duplicate Of",
    attachment: "Attachment",
    childOf: "Child Of",
    parentOf: "Parent Of",
    inspiredBy: "Inspired By",
    supports: "Supports",
    blocks: "Blocks",
    custom: "Custom",
  };
  return labels[type];
}

function InspectorRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-lg bg-[var(--karya-surface)] p-2">
      <p className="text-xs font-medium text-[var(--karya-subtle)]">{label}</p>
      <p className="mt-1 break-words text-sm text-[var(--karya-text)]">{value || "None"}</p>
    </div>
  );
}

function InspectorSection({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}): ReactElement {
  return (
    <details
      className="group rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--karya-text)]">
        <span>{title}</span>
        <ChevronRight className="h-4 w-4 text-[var(--karya-subtle)] transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
