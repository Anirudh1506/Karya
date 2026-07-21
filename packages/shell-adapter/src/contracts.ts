import type {
  KaryaCommand,
  KaryaCore,
  KernelSnapshot,
  BookmarkUpdatePatch,
  CalendarEventUpdatePatch,
  TaskUpdatePatch,
} from "@karya/core";
import type { PlatformProviders } from "@karya/platform";
import type { Page, ResourceQuery, ResourceView, WorkspaceQuery, WorkspaceView } from "@karya/query-service";
import type {
  ContinuitySession,
  EntityId,
  ImportDestination,
  ImportJob,
  InstalledApplication,
  JobId,
  KaryaEventMap,
  KaryaNotification,
  NotificationCategory,
  NotificationPriority,
  Profile,
  RelationshipObjectType,
  RelationshipType,
  ReminderSchedule,
  Resource,
  SearchResult,
  CalendarEvent,
  Workspace,
  WorkspaceLaunchSet,
  WorkspaceSettingsUpdate,
  KaryaAccount,
  TrustedDevice,
  ReplicaMembership,
  TransportStatus,
} from "@karya/types";

export type { KaryaCommand, KernelSnapshot } from "@karya/core";

export interface ShellAdapterOptions {
  core?: KaryaCore;
  platform?: PlatformProviders;
}

export interface ShellAdapter {
  currentAccount(): Promise<KaryaAccount | undefined>;
  renameAccount(displayName: string): Promise<KaryaAccount>;
  trustedDevices(): Promise<TrustedDevice[]>;
  currentDevice(): Promise<TrustedDevice | undefined>;
  renameDevice(deviceId: EntityId, name: string): Promise<TrustedDevice>;
  removeDevice(deviceId: EntityId): Promise<void>;
  replicaMembership(): Promise<ReplicaMembership[]>;
  getTransportStatus(): Promise<TransportStatus>;
  connectTransport(): Promise<void>;
  disconnectTransport(): Promise<void>;
  reconnectTransport(): Promise<void>;
  synchronizeTransport(): Promise<void>;
  boot(): Promise<void>;
  subscribe(listener: (snapshot: KernelSnapshot) => void): () => void;
  subscribeImports(listener: (event: ImportLifecycleEvent) => void): () => void;
  getSnapshot(): Promise<KernelSnapshot>;
  execute<TResult = unknown>(command: KaryaCommand): Promise<TResult>;
  getResource(id: EntityId): Promise<ResourceView>;
  listResources(query?: ResourceQuery): Promise<Page<ResourceView>>;
  getWorkspace(id: EntityId): Promise<WorkspaceView>;
  listWorkspaces(query?: WorkspaceQuery): Promise<Page<WorkspaceView>>;
  recentResources(limit?: number): Promise<ResourceView[]>;
  search(term: string): Promise<SearchResult[]>;
  executeSearchResult(result: SearchResult): Promise<void>;
  createResource(destination?: ImportDestination): Promise<Resource>;
  createNote(destination?: ImportDestination, title?: string, content?: string): Promise<Resource>;
  updateNoteContent(resourceId: EntityId, content: string): Promise<Resource>;
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
  linkFileFromPicker(destination?: ImportDestination): Promise<Resource | undefined>;
  linkDirectoryFromPicker(destination?: ImportDestination): Promise<Resource | undefined>;
  syncLinkedResource(resourceId: EntityId): Promise<Resource>;
  syncLinkedResources(): Promise<Resource[]>;
  importContent(path: string, displayTitle?: string, destination?: ImportDestination): Promise<Resource>;
  importFile(path: string, displayTitle?: string, destination?: ImportDestination): Promise<ImportJob>;
  importDirectory(path: string, destination?: ImportDestination): Promise<ImportJob>;
  importFileFromPicker(destination?: ImportDestination): Promise<ImportJob | undefined>;
  importDirectoryFromPicker(destination?: ImportDestination): Promise<ImportJob | undefined>;
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
  createWorkspace(name: string, description?: string, templateId?: EntityId): Promise<Workspace>;
  switchWorkspace(workspaceId: EntityId): Promise<Workspace>;
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
  resumeContext(resourceIds: EntityId[], workspaceId?: EntityId): Promise<ContinuitySession>;
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
  selectResource(resourceId?: EntityId): Promise<void>;
  getPlatform(): PlatformProviders;
}

export type ImportLifecycleEventName =
  "ImportStarted" | "ImportProgress" | "ImportCompleted" | "ImportFailed" | "ImportCancelled";

export type ImportLifecycleEvent = {
  [TEventName in ImportLifecycleEventName]: {
    type: TEventName;
    payload: KaryaEventMap[TEventName];
  };
}[ImportLifecycleEventName];
