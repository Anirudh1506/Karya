import type { KernelSnapshot, StateEngine } from "@karya/state-engine";
import type {
  CalendarEvent,
  ContinuitySession,
  EntityId,
  ImportDestination,
  ImportJob,
  InstalledApplication,
  JobId,
  KaryaActivity,
  KaryaNotification,
  NotificationCategory,
  NotificationPriority,
  Profile,
  RelationshipObjectType,
  RelationshipType,
  ReminderSchedule,
  Resource,
  SearchResult,
  Workspace,
  WorkspaceLaunchSet,
  WorkspaceSettingsUpdate,
  AccountMetadataExport,
} from "@karya/types";
import type { Page, ResourceQuery, ResourceView, WorkspaceQuery, WorkspaceView } from "@karya/query-service";
import type { CommandBus } from "./command-bus";
import type { BookmarkUpdatePatch, CalendarEventUpdatePatch, ShellApi, TaskUpdatePatch } from "./contracts";
import type { AccountEngine } from "@karya/account-service";

export class KernelShellApi implements ShellApi {
  private initialized = false;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly stateEngine: StateEngine,
    private readonly accountService: AccountEngine,
  ) {}

  currentAccount() {
    return this.accountService.current();
  }
  renameAccount(displayName: string) {
    return this.accountService.rename(displayName);
  }
  trustedDevices() {
    return this.accountService.trustedDevices();
  }
  currentDevice() {
    return this.accountService.currentDevice();
  }
  renameDevice(deviceId: EntityId, name: string) {
    return this.accountService.renameDevice(deviceId, name);
  }
  removeDevice(deviceId: EntityId) {
    return this.accountService.unregisterDevice(deviceId);
  }
  replicaMembership() {
    return this.accountService.replicaMembership();
  }
  exportAccountMetadata() {
    return this.accountService.exportMetadata();
  }
  importAccountMetadata(metadata: AccountMetadataExport) {
    return this.accountService.importMetadata(metadata);
  }

  async boot(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  subscribe(listener: (snapshot: KernelSnapshot) => void): () => void {
    return this.stateEngine.subscribe(listener);
  }

  getSnapshotSync(): KernelSnapshot {
    return this.stateEngine.getSnapshot();
  }

  async getSnapshot(): Promise<KernelSnapshot> {
    return this.stateEngine.getSnapshot();
  }

  async getResource(id: EntityId): Promise<ResourceView> {
    return this.commandBus.getContext().registry.resolve("queryService").getResource(id);
  }

  async listResources(query?: ResourceQuery): Promise<Page<ResourceView>> {
    return this.commandBus.getContext().registry.resolve("queryService").listResources(query);
  }

  async getWorkspace(id: EntityId): Promise<WorkspaceView> {
    return this.commandBus.getContext().registry.resolve("queryService").getWorkspace(id);
  }

  async listWorkspaces(query?: WorkspaceQuery): Promise<Page<WorkspaceView>> {
    return this.commandBus.getContext().registry.resolve("queryService").listWorkspaces(query);
  }

  async recentResources(limit?: number): Promise<ResourceView[]> {
    return this.commandBus.getContext().registry.resolve("queryService").recentResources(limit);
  }

  recentActivities(limit?: number): Promise<KaryaActivity[]> {
    return this.commandBus.getContext().registry.resolve("activityService").recent(limit);
  }

  activitiesByProfile(profileId: EntityId, limit?: number): Promise<KaryaActivity[]> {
    return this.commandBus.getContext().registry.resolve("activityService").byProfile(profileId, limit);
  }

  activitiesByWorkspace(workspaceId: EntityId, limit?: number): Promise<KaryaActivity[]> {
    return this.commandBus.getContext().registry.resolve("activityService").byWorkspace(workspaceId, limit);
  }

  activitiesByResource(resourceId: EntityId, limit?: number): Promise<KaryaActivity[]> {
    return this.commandBus.getContext().registry.resolve("activityService").byResource(resourceId, limit);
  }

  activitiesByEventType(eventType: string, limit?: number): Promise<KaryaActivity[]> {
    return this.commandBus.getContext().registry.resolve("activityService").byEventType(eventType, limit);
  }

  latestActivity(): Promise<KaryaActivity | undefined> {
    return this.commandBus.getContext().registry.resolve("activityService").latest();
  }

  async openActivity(activityId: EntityId): Promise<void> {
    const activity = await this.commandBus.getContext().registry.resolve("activityService").get(activityId);
    if (!activity) throw new Error(`Activity not found: ${activityId}`);
    if (activity.object.type === "resource") {
      const resource = await this.commandBus
        .getContext()
        .registry.resolve("resourceService")
        .getResource(activity.object.id);
      if (!resource) throw new Error(`Resource not found: ${activity.object.id}`);
      await this.switchProfile(resource.profileId);
      const workspaceId = resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
      if (workspaceId) await this.openWorkspace(workspaceId);
      await this.openResource(resource.id);
    } else if (activity.object.type === "workspace") {
      if (activity.profileId) await this.switchProfile(activity.profileId);
      await this.openWorkspace(activity.object.id);
    } else if (activity.object.type === "profile") {
      await this.switchProfile(activity.object.id);
    }
  }

  unreadNotifications() {
    return this.commandBus.getContext().registry.resolve("notificationService").unread();
  }
  recentNotifications(limit?: number) {
    return this.commandBus.getContext().registry.resolve("notificationService").recent(limit);
  }
  notificationsByProfile(profileId: EntityId, limit?: number) {
    return this.commandBus.getContext().registry.resolve("notificationService").byProfile(profileId, limit);
  }
  notificationsByWorkspace(workspaceId: EntityId, limit?: number) {
    return this.commandBus.getContext().registry.resolve("notificationService").byWorkspace(workspaceId, limit);
  }
  notificationCount() {
    return this.commandBus.getContext().registry.resolve("notificationService").count();
  }
  latestNotification() {
    return this.commandBus.getContext().registry.resolve("notificationService").latest();
  }
  markAllNotificationsRead() {
    return this.commandBus.getContext().registry.resolve("notificationService").markAllRead();
  }
  dismissNotification(notificationId: EntityId) {
    return this.commandBus.getContext().registry.resolve("notificationService").dismiss(notificationId);
  }
  async openNotification(notificationId: EntityId): Promise<void> {
    const notification = await this.commandBus.getContext().registry.resolve("notificationService").get(notificationId);
    if (!notification) throw new Error(`Notification not found: ${notificationId}`);
    await this.markNotificationRead(notificationId);
    if (notification.resourceId) {
      const resource = await this.commandBus
        .getContext()
        .registry.resolve("resourceService")
        .getResource(notification.resourceId);
      if (!resource) throw new Error(`Resource not found: ${notification.resourceId}`);
      await this.switchProfile(resource.profileId);
      const workspaceId = resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
      if (workspaceId) await this.openWorkspace(workspaceId);
      await this.openResource(resource.id);
    } else if (notification.workspaceId) {
      if (notification.profileId) await this.switchProfile(notification.profileId);
      const workspace = (await this.commandBus.getContext().registry.resolve("workspaceService").listWorkspaces()).find(
        (candidate) => candidate.id === notification.workspaceId,
      );
      if (workspace && workspace.lifecycleState !== "archived" && workspace.lifecycleState !== "deleted") {
        await this.openWorkspace(notification.workspaceId);
      }
    } else if (notification.profileId) await this.switchProfile(notification.profileId);
  }

  async beginCapture(): Promise<import("@karya/types").CaptureSession> {
    return this.commandBus.execute({
      id: crypto.randomUUID(),
      type: "BeginCaptureCommand",
      payload: { kind: "note" },
    });
  }

  async completeCapture(captureId: EntityId, name: string): Promise<Resource> {
    return this.commandBus.execute({
      id: crypto.randomUUID(),
      type: "CompleteCaptureCommand",
      payload: { captureId, name },
    });
  }

  async cancelCapture(captureId: EntityId): Promise<void> {
    await this.commandBus.execute({
      id: crypto.randomUUID(),
      type: "CancelCaptureCommand",
      payload: { captureId },
    });
  }

  async createResource(destination?: ImportDestination): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CreateResourceCommand",
      payload: { displayTitle: "Untitled Resource", resourceType: "resource", destination, tags: ["created"] },
    });
  }

  async createNote(destination?: ImportDestination, title?: string, content = ""): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CreateNoteCommand",
      payload: { title, content, destination },
    });
  }

  async updateNoteContent(resourceId: EntityId, content: string): Promise<Resource> {
    const editing = this.commandBus.getContext().registry.resolve("editingService");
    const { session } = await editing.open(resourceId);
    await editing.change(session.id, content);
    await editing.flush(session.id);
    const resource = await this.commandBus.getContext().registry.resolve("resourceService").getResource(resourceId);
    if (!resource) throw new Error(`Resource not found: ${resourceId}`);
    return resource;
  }

  openEditSession(resourceId: EntityId) {
    return this.commandBus.getContext().registry.resolve("editingService").open(resourceId);
  }
  updateEditContent(sessionId: EntityId, content: string, selection?: import("@karya/types").EditSelection) {
    return this.commandBus.getContext().registry.resolve("editingService").change(sessionId, content, selection);
  }
  flushEditSession(sessionId: EntityId) {
    return this.commandBus.getContext().registry.resolve("editingService").flush(sessionId);
  }
  closeEditSession(sessionId: EntityId) {
    return this.commandBus.getContext().registry.resolve("editingService").close(sessionId);
  }
  getEditableContent(resourceId: EntityId) {
    return this.commandBus.getContext().registry.resolve("editingService").getContent(resourceId);
  }
  getEditSession(sessionId: EntityId) {
    return this.commandBus.getContext().registry.resolve("editingService").getSession(sessionId);
  }
  listEditCheckpoints(resourceId: EntityId) {
    return this.commandBus.getContext().registry.resolve("editingService").listCheckpoints(resourceId);
  }
  subscribeToEditSessions(listener: (session: import("@karya/types").EditSession) => void) {
    return this.commandBus.getContext().registry.resolve("editingService").subscribe(listener);
  }

  getSyncStatus() {
    return this.commandBus.getContext().registry.resolve("synchronizationService").status();
  }
  pendingSyncOperations() {
    return this.commandBus.getContext().registry.resolve("synchronizationService").pending();
  }
  acknowledgedSyncOperations() {
    return this.commandBus.getContext().registry.resolve("synchronizationService").acknowledged();
  }
  acknowledgeSyncOperations(operationIds: readonly EntityId[]) {
    return this.commandBus.getContext().registry.resolve("synchronizationService").acknowledge(operationIds);
  }
  replaySyncOperations(operations?: readonly import("@karya/types").SyncOperation[]) {
    return this.commandBus.getContext().registry.resolve("synchronizationService").replay(operations);
  }
  listSyncConflicts() {
    return this.commandBus.getContext().registry.resolve("synchronizationService").conflicts();
  }
  subscribeToSyncStatus(listener: () => void) {
    return this.commandBus.getContext().registry.resolve("synchronizationService").subscribe(listener);
  }
  getTransportStatus() {
    return this.commandBus.getContext().registry.resolve("transportService").status();
  }
  connectTransport() {
    return this.commandBus.getContext().registry.resolve("transportService").connect();
  }
  disconnectTransport() {
    return this.commandBus.getContext().registry.resolve("transportService").disconnect();
  }
  reconnectTransport() {
    return this.commandBus.getContext().registry.resolve("transportService").reconnect();
  }
  synchronizeTransport() {
    return this.commandBus.getContext().registry.resolve("transportService").synchronize();
  }
  subscribeToTransportStatus(listener: () => void) {
    return this.commandBus.getContext().registry.resolve("transportService").subscribe(listener);
  }

  async createTask(
    destination?: ImportDestination,
    title?: string,
    options: Omit<TaskUpdatePatch, "title"> = {},
  ): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CreateTaskCommand",
      payload: { title, destination, ...options },
    });
  }

  async updateTask(resourceId: EntityId, patch: TaskUpdatePatch): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "UpdateTaskCommand",
      payload: { resourceId, patch },
    });
  }

  async completeTask(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CompleteTaskCommand",
      payload: { resourceId },
    });
  }

  async reopenTask(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "ReopenTaskCommand",
      payload: { resourceId },
    });
  }

  async createBookmark(
    destination: ImportDestination | undefined,
    url: string,
    options: Omit<BookmarkUpdatePatch, "url"> = {},
  ): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CreateBookmarkCommand",
      payload: { url, destination, ...options },
    });
  }

  async updateBookmark(resourceId: EntityId, patch: BookmarkUpdatePatch): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "UpdateBookmarkCommand",
      payload: { resourceId, patch },
    });
  }

  async createCalendarEvent(
    destination: ImportDestination | undefined,
    title?: string,
    options: Omit<CalendarEventUpdatePatch, "title"> = {},
  ): Promise<CalendarEvent> {
    return this.commandBus.execute<CalendarEvent>({
      id: crypto.randomUUID(),
      type: "CreateCalendarEventCommand",
      payload: { title, destination, ...options },
    });
  }

  async updateCalendarEvent(eventId: EntityId, patch: CalendarEventUpdatePatch): Promise<CalendarEvent> {
    return this.commandBus.execute<CalendarEvent>({
      id: crypto.randomUUID(),
      type: "UpdateCalendarEventCommand",
      payload: { eventId, patch },
    });
  }

  async archiveCalendarEvent(eventId: EntityId): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "ArchiveCalendarEventCommand",
      payload: { eventId },
    });
  }

  async deleteCalendarEvent(eventId: EntityId): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "DeleteCalendarEventCommand",
      payload: { eventId },
    });
  }

  async linkResource(path: string, displayTitle?: string, destination?: ImportDestination): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "LinkResourceCommand",
      payload: { path, displayTitle, destination },
    });
  }

  async syncLinkedResource(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "SyncLinkedResourceCommand",
      payload: { resourceId },
    });
  }

  async syncLinkedResources(): Promise<Resource[]> {
    return this.commandBus.execute<Resource[]>({
      id: crypto.randomUUID(),
      type: "SyncLinkedResourcesCommand",
      payload: {},
    });
  }

  async importContent(path: string, displayTitle?: string, destination?: ImportDestination): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "ImportContentCommand",
      payload: { path, displayTitle, destination, tags: ["imported"] },
    });
  }

  async importFile(path: string, displayTitle?: string, destination?: ImportDestination): Promise<ImportJob> {
    return this.commandBus.getContext().registry.resolve("importService").importFile(path, displayTitle, destination);
  }

  async importDirectory(path: string, destination?: ImportDestination): Promise<ImportJob> {
    return this.commandBus.getContext().registry.resolve("importService").importDirectory(path, destination);
  }

  async cancelImport(jobId: JobId): Promise<void> {
    await this.commandBus.getContext().registry.resolve("importService").cancel(jobId);
  }

  async getImportJob(jobId: JobId): Promise<ImportJob | undefined> {
    return this.commandBus.getContext().registry.resolve("importService").getJob(jobId);
  }

  async listImportJobs(): Promise<ImportJob[]> {
    return this.commandBus.getContext().registry.resolve("importService").listJobs();
  }

  async openFolderResource(resourceId: EntityId, workspaceId?: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "OpenFolderResourceCommand",
      payload: { resourceId, workspaceId },
    });
  }

  async openHomeSurface(): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "OpenHomeSurfaceCommand",
      payload: {},
    });
  }

  async openResource(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "OpenResourceCommand",
      payload: { resourceId },
    });
  }

  async openResourceWithApplication(
    resourceId: EntityId,
    applicationId: EntityId,
    workspaceId?: EntityId,
  ): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "OpenResourceWithApplicationCommand",
      payload: { resourceId, applicationId, workspaceId },
    });
  }

  async revealResource(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "RevealResourceCommand",
      payload: { resourceId },
    });
  }

  async openContainingFolder(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "OpenContainingFolderCommand",
      payload: { resourceId },
    });
  }

  async copyResourcePath(resourceId: EntityId): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "CopyResourcePathCommand",
      payload: { resourceId },
    });
  }

  async checkResourceHealth(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CheckResourceHealthCommand",
      payload: { resourceId },
    });
  }

  async updateResourceLocation(resourceId: EntityId, path: string): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "UpdateResourceLocationCommand",
      payload: { resourceId, path },
    });
  }

  async renameResource(resourceId: EntityId, title: string): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "RenameResourceCommand",
      payload: { resourceId, title },
    });
  }

  async moveResource(resourceId: EntityId, destination: ImportDestination): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "MoveResourceCommand",
      payload: { resourceId, destination },
    });
  }

  async duplicateResource(resourceId: EntityId, destination?: ImportDestination): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "DuplicateResourceCommand",
      payload: { resourceId, destination },
    });
  }

  async deleteResource(resourceId: EntityId): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "DeleteResourceCommand",
      payload: { resourceId },
    });
  }

  async archiveResource(resourceId: EntityId): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "ArchiveResourceCommand",
      payload: { resourceId },
    });
  }

  async restoreResource(resourceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "RestoreResourceCommand",
      payload: { resourceId },
    });
  }

  async addWorkspaceReference(resourceId: EntityId, workspaceId: EntityId, makePrimary?: boolean): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "AddWorkspaceReferenceCommand",
      payload: { resourceId, workspaceId, makePrimary },
    });
  }

  async removeWorkspaceReference(resourceId: EntityId, workspaceId: EntityId): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "RemoveWorkspaceReferenceCommand",
      payload: { resourceId, workspaceId },
    });
  }

  async updateResourceMetadata(resourceId: EntityId, metadata: Partial<Resource["metadata"]>): Promise<Resource> {
    return this.commandBus.execute<Resource>({
      id: crypto.randomUUID(),
      type: "UpdateResourceMetadataCommand",
      payload: { resourceId, metadata },
    });
  }

  async createRelationship(
    sourceId: EntityId,
    sourceType: RelationshipObjectType,
    targetId: EntityId,
    targetType: RelationshipObjectType,
    relationshipType: RelationshipType,
  ): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "CreateRelationshipCommand",
      payload: { sourceId, sourceType, targetId, targetType, relationshipType },
    });
  }

  async removeRelationship(
    sourceId: EntityId,
    sourceType: RelationshipObjectType,
    relationshipId: EntityId,
  ): Promise<void> {
    await this.commandBus.execute<void>({
      id: crypto.randomUUID(),
      type: "RemoveRelationshipCommand",
      payload: { sourceId, sourceType, relationshipId },
    });
  }

  async createNotification(input: {
    title: string;
    description?: string;
    category: NotificationCategory;
    source: string;
    workspaceId?: EntityId;
    profileId?: EntityId;
    priority?: NotificationPriority;
  }): Promise<KaryaNotification> {
    return this.commandBus.execute<KaryaNotification>({
      id: crypto.randomUUID(),
      type: "CreateNotificationCommand",
      payload: input,
    });
  }

  async markNotificationRead(notificationId: EntityId): Promise<KaryaNotification> {
    return this.commandBus.execute<KaryaNotification>({
      id: crypto.randomUUID(),
      type: "MarkNotificationReadCommand",
      payload: { notificationId },
    });
  }

  async archiveNotification(notificationId: EntityId): Promise<KaryaNotification> {
    return this.commandBus.execute<KaryaNotification>({
      id: crypto.randomUUID(),
      type: "ArchiveNotificationCommand",
      payload: { notificationId },
    });
  }

  async deleteNotification(notificationId: EntityId): Promise<KaryaNotification> {
    return this.commandBus.execute<KaryaNotification>({
      id: crypto.randomUUID(),
      type: "DeleteNotificationCommand",
      payload: { notificationId },
    });
  }

  async scheduleReminder(input: {
    title: string;
    description?: string;
    category: NotificationCategory;
    source: string;
    workspaceId?: EntityId;
    profileId?: EntityId;
    remindAt: string;
  }): Promise<ReminderSchedule> {
    return this.commandBus.execute<ReminderSchedule>({
      id: crypto.randomUUID(),
      type: "ScheduleReminderCommand",
      payload: input,
    });
  }

  async createWorkspace(
    name: string,
    description?: string,
    templateId?: EntityId,
    appearance: { color?: string; icon?: string } = {},
  ): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "CreateWorkspaceCommand",
      payload: { name, description, templateId, ...appearance },
    });
  }

  async openWorkspace(workspaceId: EntityId): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "OpenWorkspaceCommand",
      payload: { workspaceId },
    });
  }

  async closeWorkspace(workspaceId: EntityId): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "CloseWorkspaceCommand",
      payload: { workspaceId },
    });
  }

  async renameWorkspace(workspaceId: EntityId, name: string): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "RenameWorkspaceCommand",
      payload: { workspaceId, name },
    });
  }

  async archiveWorkspace(workspaceId: EntityId): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "ArchiveWorkspaceCommand",
      payload: { workspaceId },
    });
  }

  async restoreWorkspace(workspaceId: EntityId): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "RestoreWorkspaceCommand",
      payload: { workspaceId },
    });
  }

  async deleteWorkspace(workspaceId: EntityId): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "DeleteWorkspaceCommand",
      payload: { workspaceId },
    });
  }

  async pinWorkspace(workspaceId: EntityId, pinned: boolean): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "PinWorkspaceCommand",
      payload: { workspaceId, pinned },
    });
  }

  async updateWorkspaceLaunchSet(workspaceId: EntityId, launchSet: WorkspaceLaunchSet | undefined): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "UpdateWorkspaceLaunchSetCommand",
      payload: { workspaceId, launchSet },
    });
  }

  async updateWorkspaceSettings(workspaceId: EntityId, update: WorkspaceSettingsUpdate): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "UpdateWorkspaceSettingsCommand",
      payload: { workspaceId, update },
    });
  }

  async createProfile(
    name: string,
    options: { description?: string; icon?: string; accentColor?: string; template?: Profile["template"] } = {},
  ): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "CreateProfileCommand",
      payload: { name, ...options },
    });
  }

  async openProfile(profileId: EntityId): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "OpenProfileCommand",
      payload: { profileId },
    });
  }

  async viewProfile(profileId: EntityId): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "ViewProfileCommand",
      payload: { profileId },
    });
  }

  async renameProfile(profileId: EntityId, name: string): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "RenameProfileCommand",
      payload: { profileId, name },
    });
  }

  async updateProfile(
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
  ): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "UpdateProfileCommand",
      payload: { profileId, ...options },
    });
  }

  async archiveProfile(profileId: EntityId): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "ArchiveProfileCommand",
      payload: { profileId },
    });
  }

  async restoreProfile(profileId: EntityId): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "RestoreProfileCommand",
      payload: { profileId },
    });
  }

  async deleteProfile(profileId: EntityId): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "DeleteProfileCommand",
      payload: { profileId },
    });
  }

  async switchProfile(profileId: EntityId): Promise<Profile> {
    return this.commandBus.execute<Profile>({
      id: crypto.randomUUID(),
      type: "SwitchProfileCommand",
      payload: { profileId },
    });
  }

  async discoverApplications(): Promise<InstalledApplication[]> {
    return this.commandBus.execute<InstalledApplication[]>({
      id: crypto.randomUUID(),
      type: "DiscoverApplicationsCommand",
      payload: {},
    });
  }

  async refreshApplications(): Promise<InstalledApplication[]> {
    return this.commandBus.execute<InstalledApplication[]>({
      id: crypto.randomUUID(),
      type: "RefreshApplicationsCommand",
      payload: {},
    });
  }

  async openApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.launchApplication(applicationId);
  }

  async launchApplication(
    applicationId: EntityId,
    options: {
      launchArguments?: string[];
      workingDirectory?: string;
      resourceIds?: EntityId[];
      workspaceId?: EntityId;
      profileId?: EntityId;
    } = {},
  ): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "LaunchApplicationCommand",
      payload: { applicationId, ...options },
    });
  }

  async pinApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "PinApplicationCommand",
      payload: { applicationId },
    });
  }

  async unpinApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "UnpinApplicationCommand",
      payload: { applicationId },
    });
  }

  async favoriteApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "FavoriteApplicationCommand",
      payload: { applicationId },
    });
  }

  async unfavoriteApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "UnfavoriteApplicationCommand",
      payload: { applicationId },
    });
  }

  async hideApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "HideApplicationCommand",
      payload: { applicationId },
    });
  }

  async showApplication(applicationId: EntityId): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "ShowApplicationCommand",
      payload: { applicationId },
    });
  }

  async setDefaultApplication(applicationId: EntityId, isDefault?: boolean): Promise<InstalledApplication> {
    return this.commandBus.execute<InstalledApplication>({
      id: crypto.randomUUID(),
      type: "SetDefaultApplicationCommand",
      payload: { applicationId, isDefault },
    });
  }

  async setWorkspacePreferredApplication(
    workspaceId: EntityId,
    applicationId: EntityId,
    preferred?: boolean,
  ): Promise<Workspace> {
    return this.commandBus.execute<Workspace>({
      id: crypto.randomUUID(),
      type: "SetWorkspacePreferredApplicationCommand",
      payload: { workspaceId, applicationId, preferred },
    });
  }

  async resumeContext(resourceIds: EntityId[], workspaceId?: EntityId): Promise<ContinuitySession> {
    return this.commandBus.execute<ContinuitySession>({
      id: crypto.randomUUID(),
      type: "ResumeContextCommand",
      payload: { resourceIds, workspaceId },
    });
  }

  async search(term: string): Promise<SearchResult[]> {
    return this.commandBus.execute<SearchResult[]>({
      id: crypto.randomUUID(),
      type: "SearchCommand",
      payload: { term, types: ["profile", "workspace", "resource"] },
    });
  }

  async recentSearches(): Promise<Array<{ query: string; searchedAt: string }>> {
    return (
      (await this.commandBus.getContext().registry.resolve("continuityService").getCurrentSession()).recentSearches ??
      []
    );
  }

  async recordSearch(term: string): Promise<void> {
    await this.commandBus.getContext().registry.resolve("continuityService").recordSearch(term);
  }

  async clearRecentSearches(): Promise<void> {
    await this.commandBus.getContext().registry.resolve("continuityService").clearRecentSearches();
  }

  async openSearchResult(result: SearchResult, query?: string): Promise<void> {
    const { document } = result;
    if (document.type === "profile") {
      await this.switchProfile(document.sourceId);
    } else if (document.type === "workspace") {
      if (document.profileId) await this.switchProfile(document.profileId);
      await this.openWorkspace(document.sourceId);
    } else if (document.type === "resource") {
      if (document.profileId) await this.switchProfile(document.profileId);
      const workspaceId = document.workspaceIds?.[0];
      if (workspaceId) await this.openWorkspace(workspaceId);
      await this.openResource(document.sourceId);
    }
    if (query) await this.recordSearch(query);
  }

  async selectResource(resourceId?: EntityId): Promise<void> {
    await this.commandBus.execute<EntityId | undefined>({
      id: crypto.randomUUID(),
      type: "SelectResourceCommand",
      payload: { resourceId },
    });
  }
}
