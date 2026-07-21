import type { ApplicationRegistry } from "@karya/application-registry";
import type { ActivityService } from "@karya/activity-service";
import type { AccountEngine } from "@karya/account-service";
import type { CommandRegistry } from "@karya/command-registry";
import type { CaptureService } from "@karya/capture-service";
import type { ContinueWorkingService, ContinuityService } from "@karya/continuity-service";
import type { CalendarEventService } from "@karya/event-service";
import type { EventBus } from "@karya/event-bus";
import type { ResourceEditingService } from "@karya/editing-service";
import type { SynchronizationEngine } from "@karya/sync-service";
import type { RemoteTransport } from "@karya/transport-service";
import type { ImportService } from "@karya/import-service";
import type { NotificationService } from "@karya/notification-service";
import type { ProfileService } from "@karya/profile-service";
import type { ResourceService } from "@karya/resource-service";
import type {
  Page,
  QueryService,
  ResourceQuery,
  ResourceView,
  WorkspaceQuery,
  WorkspaceView,
} from "@karya/query-service";
import type { RelationshipService } from "@karya/relationship-service";
import type { SearchService } from "@karya/search-service";
import type { SettingsService } from "@karya/settings-service";
import type { KernelSnapshot } from "@karya/state-engine";
import type {
  ContinuitySession,
  CalendarEvent,
  EntityId,
  ImportDestination,
  ImportJob,
  InstalledApplication,
  JobId,
  KaryaActivity,
  KaryaNotification,
  NotificationCategory,
  NotificationPriority,
  ReminderSchedule,
  Profile,
  Resource,
  RelationshipObjectType,
  RelationshipType,
  SearchResult,
  Workspace,
  WorkspaceLaunchSet,
  WorkspaceSettingsUpdate,
  EditableResourceContent,
  EditCheckpoint,
  EditSelection,
  EditSession,
  SyncConflict,
  SyncOperation,
  SyncStatus,
  KaryaAccount,
  TrustedDevice,
  AccountMetadataExport,
  ReplicaMembership,
  TransportStatus,
} from "@karya/types";
import type { WorkspaceService } from "@karya/workspace-service";
import type { CommandBus } from "./command-bus";
import type { ServiceRegistry } from "./service-registry";

export type { KernelSnapshot } from "@karya/state-engine";

export type TaskStatus = "todo" | "in-progress" | "blocked" | "completed" | "archived";
export type TaskPriority = "none" | "low" | "medium" | "high" | "critical";
export type BookmarkReadingStatus = "unread" | "reading" | "completed" | "archived";
export type CalendarEventCategory = "meeting" | "focus" | "deadline" | "reminder" | "personal" | "other";

export interface BookmarkUpdatePatch {
  title?: string;
  url?: string;
  description?: string;
  websiteName?: string;
  favicon?: string;
  previewImage?: string;
  notes?: string;
  labels?: string[];
  readingStatus?: BookmarkReadingStatus;
  favorite?: boolean;
  pinned?: boolean;
  tags?: string[];
}

export interface CalendarEventUpdatePatch {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  timeZone?: string;
  allDay?: boolean;
  color?: string;
  labels?: string[];
  category?: CalendarEventCategory;
  reminder?: string;
  recurrence?: string;
  repeatUntil?: string;
  location?: string;
  url?: string;
  relatedResourceIds?: EntityId[];
  tags?: string[];
}

export interface TaskUpdatePatch {
  title?: string;
  description?: string;
  checklistItems?: string[];
  checklistCompleted?: boolean[];
  labels?: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  reminderAt?: string;
  reminderDate?: string;
  reminderTime?: string;
  reminderRepeat?: string;
  pinned?: boolean;
  tags?: string[];
  parentTaskId?: EntityId;
}

export interface KernelServices {
  accountService: AccountEngine;
  activityService: ActivityService;
  applicationRegistry: ApplicationRegistry;
  captureService: CaptureService;
  commandRegistry: CommandRegistry;
  continueWorkingService: ContinueWorkingService;
  continuityService: ContinuityService;
  eventService: CalendarEventService;
  eventBus: EventBus;
  editingService: ResourceEditingService;
  synchronizationService: SynchronizationEngine;
  transportService: RemoteTransport;
  importService: ImportService;
  notificationService: NotificationService;
  profileService: ProfileService;
  queryService: QueryService;
  relationshipService: RelationshipService;
  resourceService: ResourceService;
  searchService: SearchService;
  settingsService: SettingsService;
  workspaceService: WorkspaceService;
}

export type KernelServiceKey = keyof KernelServices;

export interface ServiceDescriptor<TKey extends KernelServiceKey = KernelServiceKey> {
  key: TKey;
  service: KernelServices[TKey];
  dependencies?: KernelServiceKey[];
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
}

export type KaryaCommand =
  | { id: EntityId; type: "BeginCaptureCommand"; payload: { kind?: "note" } }
  | { id: EntityId; type: "CompleteCaptureCommand"; payload: { captureId: EntityId; name: string } }
  | { id: EntityId; type: "CancelCaptureCommand"; payload: { captureId: EntityId } }
  | {
      id: EntityId;
      type: "CreateResourceCommand";
      payload: { displayTitle?: string; resourceType: string; tags?: string[]; destination?: ImportDestination };
    }
  | {
      id: EntityId;
      type: "CreateNoteCommand";
      payload: { title?: string; content?: string; destination?: ImportDestination };
    }
  | { id: EntityId; type: "UpdateNoteContentCommand"; payload: { resourceId: EntityId; content: string } }
  | {
      id: EntityId;
      type: "CreateTaskCommand";
      payload: {
        title?: string;
        description?: string;
        checklistItems?: string[];
        checklistCompleted?: boolean[];
        labels?: string[];
        destination?: ImportDestination;
        status?: TaskStatus;
        priority?: TaskPriority;
        dueDate?: string;
        reminderAt?: string;
        reminderDate?: string;
        reminderTime?: string;
        reminderRepeat?: string;
        pinned?: boolean;
        tags?: string[];
        parentTaskId?: EntityId;
      };
    }
  | { id: EntityId; type: "UpdateTaskCommand"; payload: { resourceId: EntityId; patch: TaskUpdatePatch } }
  | { id: EntityId; type: "CompleteTaskCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "ReopenTaskCommand"; payload: { resourceId: EntityId } }
  | {
      id: EntityId;
      type: "CreateBookmarkCommand";
      payload: {
        url: string;
        title?: string;
        description?: string;
        websiteName?: string;
        favicon?: string;
        previewImage?: string;
        notes?: string;
        labels?: string[];
        destination?: ImportDestination;
        readingStatus?: BookmarkReadingStatus;
        favorite?: boolean;
        pinned?: boolean;
        tags?: string[];
      };
    }
  | { id: EntityId; type: "UpdateBookmarkCommand"; payload: { resourceId: EntityId; patch: BookmarkUpdatePatch } }
  | {
      id: EntityId;
      type: "CreateCalendarEventCommand";
      payload: {
        title?: string;
        description?: string;
        startDate?: string;
        endDate?: string;
        startTime?: string;
        endTime?: string;
        timeZone?: string;
        allDay?: boolean;
        color?: string;
        labels?: string[];
        category?: CalendarEventCategory;
        reminder?: string;
        recurrence?: string;
        repeatUntil?: string;
        location?: string;
        url?: string;
        relatedResourceIds?: EntityId[];
        destination?: ImportDestination;
        tags?: string[];
      };
    }
  | {
      id: EntityId;
      type: "UpdateCalendarEventCommand";
      payload: { eventId: EntityId; patch: CalendarEventUpdatePatch };
    }
  | { id: EntityId; type: "ArchiveCalendarEventCommand"; payload: { eventId: EntityId } }
  | { id: EntityId; type: "DeleteCalendarEventCommand"; payload: { eventId: EntityId } }
  | {
      id: EntityId;
      type: "LinkResourceCommand";
      payload: { path: string; displayTitle?: string; destination?: ImportDestination };
    }
  | { id: EntityId; type: "SyncLinkedResourceCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "SyncLinkedResourcesCommand"; payload: Record<string, never> }
  | {
      id: EntityId;
      type: "ImportContentCommand";
      payload: {
        path: string;
        displayTitle?: string;
        tags?: string[];
        folderParentId?: EntityId;
        relativePath?: string;
        destination?: ImportDestination;
      };
    }
  | {
      id: EntityId;
      type: "CreateFolderResourceCommand";
      payload: { path: string; displayTitle?: string; destination?: ImportDestination };
    }
  | {
      id: EntityId;
      type: "UpdateFolderImportStatusCommand";
      payload: { folderId: EntityId; importStatus: string; indexedCount?: number; childCount?: number };
    }
  | { id: EntityId; type: "OpenFolderResourceCommand"; payload: { resourceId: EntityId; workspaceId?: EntityId } }
  | { id: EntityId; type: "OpenHomeSurfaceCommand"; payload: Record<string, never> }
  | { id: EntityId; type: "OpenResourceCommand"; payload: { resourceId: EntityId } }
  | {
      id: EntityId;
      type: "OpenResourceWithApplicationCommand";
      payload: { resourceId: EntityId; applicationId: EntityId; workspaceId?: EntityId };
    }
  | { id: EntityId; type: "RevealResourceCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "OpenContainingFolderCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "CopyResourcePathCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "CheckResourceHealthCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "UpdateResourceLocationCommand"; payload: { resourceId: EntityId; path: string } }
  | { id: EntityId; type: "RenameResourceCommand"; payload: { resourceId: EntityId; title: string } }
  | { id: EntityId; type: "MoveResourceCommand"; payload: { resourceId: EntityId; destination: ImportDestination } }
  | {
      id: EntityId;
      type: "DuplicateResourceCommand";
      payload: { resourceId: EntityId; destination?: ImportDestination };
    }
  | { id: EntityId; type: "DeleteResourceCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "ArchiveResourceCommand"; payload: { resourceId: EntityId } }
  | { id: EntityId; type: "RestoreResourceCommand"; payload: { resourceId: EntityId } }
  | {
      id: EntityId;
      type: "AddWorkspaceReferenceCommand";
      payload: { resourceId: EntityId; workspaceId: EntityId; makePrimary?: boolean };
    }
  | { id: EntityId; type: "RemoveWorkspaceReferenceCommand"; payload: { resourceId: EntityId; workspaceId: EntityId } }
  | {
      id: EntityId;
      type: "UpdateResourceMetadataCommand";
      payload: { resourceId: EntityId; metadata: Partial<Resource["metadata"]> };
    }
  | {
      id: EntityId;
      type: "CreateRelationshipCommand";
      payload: {
        sourceId: EntityId;
        sourceType: RelationshipObjectType;
        targetId: EntityId;
        targetType: RelationshipObjectType;
        relationshipType: RelationshipType;
      };
    }
  | {
      id: EntityId;
      type: "RemoveRelationshipCommand";
      payload: { sourceId: EntityId; sourceType: RelationshipObjectType; relationshipId: EntityId };
    }
  | {
      id: EntityId;
      type: "CreateNotificationCommand";
      payload: {
        title: string;
        description?: string;
        category: NotificationCategory;
        source: string;
        workspaceId?: EntityId;
        profileId?: EntityId;
        priority?: NotificationPriority;
      };
    }
  | { id: EntityId; type: "MarkNotificationReadCommand"; payload: { notificationId: EntityId } }
  | { id: EntityId; type: "ArchiveNotificationCommand"; payload: { notificationId: EntityId } }
  | { id: EntityId; type: "DeleteNotificationCommand"; payload: { notificationId: EntityId } }
  | {
      id: EntityId;
      type: "ScheduleReminderCommand";
      payload: {
        title: string;
        description?: string;
        category: NotificationCategory;
        source: string;
        workspaceId?: EntityId;
        profileId?: EntityId;
        remindAt: string;
      };
    }
  | {
      id: EntityId;
      type: "CreateWorkspaceCommand";
      payload: { name: string; description?: string; color?: string; icon?: string; templateId?: EntityId };
    }
  | { id: EntityId; type: "OpenWorkspaceCommand"; payload: { workspaceId: EntityId } }
  | { id: EntityId; type: "CloseWorkspaceCommand"; payload: { workspaceId: EntityId } }
  | { id: EntityId; type: "RenameWorkspaceCommand"; payload: { workspaceId: EntityId; name: string } }
  | { id: EntityId; type: "ArchiveWorkspaceCommand"; payload: { workspaceId: EntityId } }
  | { id: EntityId; type: "RestoreWorkspaceCommand"; payload: { workspaceId: EntityId } }
  | { id: EntityId; type: "DeleteWorkspaceCommand"; payload: { workspaceId: EntityId } }
  | { id: EntityId; type: "PinWorkspaceCommand"; payload: { workspaceId: EntityId; pinned: boolean } }
  | {
      id: EntityId;
      type: "UpdateWorkspaceLaunchSetCommand";
      payload: { workspaceId: EntityId; launchSet?: WorkspaceLaunchSet };
    }
  | {
      id: EntityId;
      type: "UpdateWorkspaceSettingsCommand";
      payload: { workspaceId: EntityId; update: WorkspaceSettingsUpdate };
    }
  | {
      id: EntityId;
      type: "CreateProfileCommand";
      payload: {
        name: string;
        description?: string;
        icon?: string;
        accentColor?: string;
        template?: Profile["template"];
      };
    }
  | { id: EntityId; type: "OpenProfileCommand"; payload: { profileId: EntityId } }
  | { id: EntityId; type: "ViewProfileCommand"; payload: { profileId: EntityId } }
  | { id: EntityId; type: "RenameProfileCommand"; payload: { profileId: EntityId; name: string } }
  | {
      id: EntityId;
      type: "UpdateProfileCommand";
      payload: {
        profileId: EntityId;
        name?: string;
        description?: string;
        icon?: string;
        accentColor?: string;
        defaultSpaceId?: EntityId;
        spaceIds?: EntityId[];
        preferences?: Profile["preferences"];
      };
    }
  | { id: EntityId; type: "ArchiveProfileCommand"; payload: { profileId: EntityId } }
  | { id: EntityId; type: "RestoreProfileCommand"; payload: { profileId: EntityId } }
  | { id: EntityId; type: "DeleteProfileCommand"; payload: { profileId: EntityId } }
  | { id: EntityId; type: "SwitchProfileCommand"; payload: { profileId: EntityId } }
  | { id: EntityId; type: "DiscoverApplicationsCommand"; payload: Record<string, never> }
  | { id: EntityId; type: "RefreshApplicationsCommand"; payload: Record<string, never> }
  | {
      id: EntityId;
      type: "LaunchApplicationCommand";
      payload: {
        applicationId: EntityId;
        launchArguments?: string[];
        workingDirectory?: string;
        resourceIds?: EntityId[];
        workspaceId?: EntityId;
        profileId?: EntityId;
      };
    }
  | { id: EntityId; type: "OpenApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "PinApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "UnpinApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "FavoriteApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "UnfavoriteApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "HideApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "ShowApplicationCommand"; payload: { applicationId: EntityId } }
  | { id: EntityId; type: "SetDefaultApplicationCommand"; payload: { applicationId: EntityId; isDefault?: boolean } }
  | {
      id: EntityId;
      type: "SetWorkspacePreferredApplicationCommand";
      payload: { workspaceId: EntityId; applicationId: EntityId; preferred?: boolean };
    }
  | { id: EntityId; type: "ResumeContextCommand"; payload: { resourceIds: EntityId[]; workspaceId?: EntityId } }
  | {
      id: EntityId;
      type: "SearchCommand";
      payload: { term: string; types?: Array<"profile" | "workspace" | "resource"> };
    }
  | { id: EntityId; type: "OpenSettingCommand"; payload: { settingId: EntityId } }
  | { id: EntityId; type: "SelectResourceCommand"; payload: { resourceId?: EntityId } }
  | { id: EntityId; type: "SelectCalendarEventCommand"; payload: { eventId?: EntityId } };

export interface ShellApi {
  currentAccount(): Promise<KaryaAccount | undefined>;
  renameAccount(displayName: string): Promise<KaryaAccount>;
  trustedDevices(): Promise<TrustedDevice[]>;
  currentDevice(): Promise<TrustedDevice | undefined>;
  renameDevice(deviceId: EntityId, name: string): Promise<TrustedDevice>;
  removeDevice(deviceId: EntityId): Promise<void>;
  replicaMembership(): Promise<ReplicaMembership[]>;
  exportAccountMetadata(): Promise<AccountMetadataExport>;
  importAccountMetadata(metadata: AccountMetadataExport): Promise<KaryaAccount>;
  boot(): Promise<void>;
  subscribe(listener: (snapshot: KernelSnapshot) => void): () => void;
  getSnapshotSync(): KernelSnapshot;
  getSnapshot(): Promise<KernelSnapshot>;
  getResource(id: EntityId): Promise<ResourceView>;
  listResources(query?: ResourceQuery): Promise<Page<ResourceView>>;
  getWorkspace(id: EntityId): Promise<WorkspaceView>;
  listWorkspaces(query?: WorkspaceQuery): Promise<Page<WorkspaceView>>;
  recentResources(limit?: number): Promise<ResourceView[]>;
  recentActivities(limit?: number): Promise<KaryaActivity[]>;
  activitiesByProfile(profileId: EntityId, limit?: number): Promise<KaryaActivity[]>;
  activitiesByWorkspace(workspaceId: EntityId, limit?: number): Promise<KaryaActivity[]>;
  activitiesByResource(resourceId: EntityId, limit?: number): Promise<KaryaActivity[]>;
  activitiesByEventType(eventType: string, limit?: number): Promise<KaryaActivity[]>;
  latestActivity(): Promise<KaryaActivity | undefined>;
  openActivity(activityId: EntityId): Promise<void>;
  unreadNotifications(): Promise<KaryaNotification[]>;
  recentNotifications(limit?: number): Promise<KaryaNotification[]>;
  notificationsByProfile(profileId: EntityId, limit?: number): Promise<KaryaNotification[]>;
  notificationsByWorkspace(workspaceId: EntityId, limit?: number): Promise<KaryaNotification[]>;
  notificationCount(): Promise<number>;
  latestNotification(): Promise<KaryaNotification | undefined>;
  markAllNotificationsRead(): Promise<void>;
  dismissNotification(notificationId: EntityId): Promise<KaryaNotification>;
  openNotification(notificationId: EntityId): Promise<void>;
  beginCapture(): Promise<import("@karya/types").CaptureSession>;
  completeCapture(captureId: EntityId, name: string): Promise<Resource>;
  cancelCapture(captureId: EntityId): Promise<void>;
  createResource(destination?: ImportDestination): Promise<Resource>;
  createNote(destination?: ImportDestination, title?: string, content?: string): Promise<Resource>;
  updateNoteContent(resourceId: EntityId, content: string): Promise<Resource>;
  openEditSession(resourceId: EntityId): Promise<{ session: EditSession; content: EditableResourceContent }>;
  updateEditContent(sessionId: EntityId, content: string, selection?: EditSelection): Promise<EditSession>;
  flushEditSession(sessionId: EntityId): Promise<EditableResourceContent>;
  closeEditSession(sessionId: EntityId): Promise<void>;
  getEditableContent(resourceId: EntityId): Promise<EditableResourceContent>;
  getEditSession(sessionId: EntityId): Promise<EditSession | undefined>;
  listEditCheckpoints(resourceId: EntityId): Promise<EditCheckpoint[]>;
  subscribeToEditSessions(listener: (session: EditSession) => void): () => void;
  getSyncStatus(): Promise<SyncStatus>;
  pendingSyncOperations(): Promise<SyncOperation[]>;
  acknowledgedSyncOperations(): Promise<SyncOperation[]>;
  acknowledgeSyncOperations(operationIds: readonly EntityId[]): Promise<void>;
  replaySyncOperations(operations?: readonly SyncOperation[]): Promise<void>;
  listSyncConflicts(): Promise<SyncConflict[]>;
  subscribeToSyncStatus(listener: () => void): () => void;
  getTransportStatus(): Promise<TransportStatus>;
  connectTransport(): Promise<void>;
  disconnectTransport(): Promise<void>;
  reconnectTransport(): Promise<void>;
  synchronizeTransport(): Promise<void>;
  subscribeToTransportStatus(listener: () => void): () => void;
  createTask(
    destination?: ImportDestination,
    title?: string,
    options?: Omit<TaskUpdatePatch, "title">,
  ): Promise<Resource>;
  updateTask(resourceId: EntityId, patch: TaskUpdatePatch): Promise<Resource>;
  completeTask(resourceId: EntityId): Promise<Resource>;
  reopenTask(resourceId: EntityId): Promise<Resource>;
  createBookmark(
    destination: ImportDestination | undefined,
    url: string,
    options?: Omit<BookmarkUpdatePatch, "url">,
  ): Promise<Resource>;
  updateBookmark(resourceId: EntityId, patch: BookmarkUpdatePatch): Promise<Resource>;
  createCalendarEvent(
    destination: ImportDestination | undefined,
    title?: string,
    options?: Omit<CalendarEventUpdatePatch, "title">,
  ): Promise<CalendarEvent>;
  updateCalendarEvent(eventId: EntityId, patch: CalendarEventUpdatePatch): Promise<CalendarEvent>;
  archiveCalendarEvent(eventId: EntityId): Promise<void>;
  deleteCalendarEvent(eventId: EntityId): Promise<void>;
  linkResource(path: string, displayTitle?: string, destination?: ImportDestination): Promise<Resource>;
  syncLinkedResource(resourceId: EntityId): Promise<Resource>;
  syncLinkedResources(): Promise<Resource[]>;
  importContent(path: string, displayTitle?: string, destination?: ImportDestination): Promise<Resource>;
  importFile(path: string, displayTitle?: string, destination?: ImportDestination): Promise<ImportJob>;
  importDirectory(path: string, destination?: ImportDestination): Promise<ImportJob>;
  cancelImport(jobId: JobId): Promise<void>;
  getImportJob(jobId: JobId): Promise<ImportJob | undefined>;
  listImportJobs(): Promise<ImportJob[]>;
  openFolderResource(resourceId: EntityId, workspaceId?: EntityId): Promise<Resource>;
  openHomeSurface(): Promise<void>;
  openResource(resourceId: EntityId): Promise<Resource>;
  openResourceWithApplication(resourceId: EntityId, applicationId: EntityId, workspaceId?: EntityId): Promise<Resource>;
  revealResource(resourceId: EntityId): Promise<Resource>;
  openContainingFolder(resourceId: EntityId): Promise<Resource>;
  copyResourcePath(resourceId: EntityId): Promise<void>;
  checkResourceHealth(resourceId: EntityId): Promise<Resource>;
  updateResourceLocation(resourceId: EntityId, path: string): Promise<Resource>;
  renameResource(resourceId: EntityId, title: string): Promise<Resource>;
  moveResource(resourceId: EntityId, destination: ImportDestination): Promise<Resource>;
  duplicateResource(resourceId: EntityId, destination?: ImportDestination): Promise<Resource>;
  deleteResource(resourceId: EntityId): Promise<void>;
  archiveResource(resourceId: EntityId): Promise<void>;
  restoreResource(resourceId: EntityId): Promise<Resource>;
  addWorkspaceReference(resourceId: EntityId, workspaceId: EntityId, makePrimary?: boolean): Promise<Resource>;
  removeWorkspaceReference(resourceId: EntityId, workspaceId: EntityId): Promise<Resource>;
  updateResourceMetadata(resourceId: EntityId, metadata: Partial<Resource["metadata"]>): Promise<Resource>;
  createRelationship(
    sourceId: EntityId,
    sourceType: RelationshipObjectType,
    targetId: EntityId,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void>;
  removeRelationship(sourceId: EntityId, sourceType: RelationshipObjectType, relationshipId: EntityId): Promise<void>;
  createNotification(input: {
    title: string;
    description?: string;
    category: NotificationCategory;
    source: string;
    workspaceId?: EntityId;
    profileId?: EntityId;
    priority?: NotificationPriority;
  }): Promise<KaryaNotification>;
  markNotificationRead(notificationId: EntityId): Promise<KaryaNotification>;
  archiveNotification(notificationId: EntityId): Promise<KaryaNotification>;
  deleteNotification(notificationId: EntityId): Promise<KaryaNotification>;
  scheduleReminder(input: {
    title: string;
    description?: string;
    category: NotificationCategory;
    source: string;
    workspaceId?: EntityId;
    profileId?: EntityId;
    remindAt: string;
  }): Promise<ReminderSchedule>;
  createWorkspace(
    name: string,
    description?: string,
    templateId?: EntityId,
    appearance?: { color?: string; icon?: string },
  ): Promise<Workspace>;
  openWorkspace(workspaceId: EntityId): Promise<Workspace>;
  closeWorkspace(workspaceId: EntityId): Promise<Workspace>;
  renameWorkspace(workspaceId: EntityId, name: string): Promise<Workspace>;
  archiveWorkspace(workspaceId: EntityId): Promise<Workspace>;
  restoreWorkspace(workspaceId: EntityId): Promise<Workspace>;
  deleteWorkspace(workspaceId: EntityId): Promise<Workspace>;
  pinWorkspace(workspaceId: EntityId, pinned: boolean): Promise<Workspace>;
  updateWorkspaceLaunchSet(workspaceId: EntityId, launchSet: WorkspaceLaunchSet | undefined): Promise<Workspace>;
  updateWorkspaceSettings(workspaceId: EntityId, update: WorkspaceSettingsUpdate): Promise<Workspace>;
  createProfile(
    name: string,
    options?: { description?: string; icon?: string; accentColor?: string; template?: Profile["template"] },
  ): Promise<Profile>;
  openProfile(profileId: EntityId): Promise<Profile>;
  viewProfile(profileId: EntityId): Promise<Profile>;
  renameProfile(profileId: EntityId, name: string): Promise<Profile>;
  updateProfile(
    profileId: EntityId,
    options: {
      name?: string;
      description?: string;
      icon?: string;
      accentColor?: string;
      defaultSpaceId?: EntityId;
      spaceIds?: EntityId[];
      preferences?: Profile["preferences"];
    },
  ): Promise<Profile>;
  archiveProfile(profileId: EntityId): Promise<Profile>;
  restoreProfile(profileId: EntityId): Promise<Profile>;
  deleteProfile(profileId: EntityId): Promise<Profile>;
  switchProfile(profileId: EntityId): Promise<Profile>;
  discoverApplications(): Promise<InstalledApplication[]>;
  refreshApplications(): Promise<InstalledApplication[]>;
  openApplication(applicationId: EntityId): Promise<InstalledApplication>;
  launchApplication(
    applicationId: EntityId,
    options?: {
      launchArguments?: string[];
      workingDirectory?: string;
      resourceIds?: EntityId[];
      workspaceId?: EntityId;
      profileId?: EntityId;
    },
  ): Promise<InstalledApplication>;
  pinApplication(applicationId: EntityId): Promise<InstalledApplication>;
  unpinApplication(applicationId: EntityId): Promise<InstalledApplication>;
  favoriteApplication(applicationId: EntityId): Promise<InstalledApplication>;
  unfavoriteApplication(applicationId: EntityId): Promise<InstalledApplication>;
  hideApplication(applicationId: EntityId): Promise<InstalledApplication>;
  showApplication(applicationId: EntityId): Promise<InstalledApplication>;
  setDefaultApplication(applicationId: EntityId, isDefault?: boolean): Promise<InstalledApplication>;
  setWorkspacePreferredApplication(
    workspaceId: EntityId,
    applicationId: EntityId,
    preferred?: boolean,
  ): Promise<Workspace>;
  resumeContext(resourceIds: EntityId[], workspaceId?: EntityId): Promise<ContinuitySession>;
  search(term: string): Promise<SearchResult[]>;
  recentSearches(): Promise<Array<{ query: string; searchedAt: string }>>;
  recordSearch(term: string): Promise<void>;
  clearRecentSearches(): Promise<void>;
  openSearchResult(result: SearchResult, query?: string): Promise<void>;
  selectResource(resourceId?: EntityId): Promise<void>;
}

export interface KaryaKernel {
  registry: ServiceRegistry;
  commandBus: CommandBus;
  shell: ShellApi;
  boot(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  shutdown(): Promise<void>;
  getLifecycleState(): KaryaCoreLifecycleState;
}

export interface KaryaCore extends KaryaKernel {}

export type KaryaCoreLifecycleState =
  "created" | "booting" | "running" | "suspended" | "shutting-down" | "stopped" | "failed";
