import { InMemoryApplicationRegistry } from "@karya/application-registry";
import { DefaultAccountEngine, type LocalDeviceDescriptor } from "@karya/account-service";
import { InMemoryActivityService } from "@karya/activity-service";
import { InMemoryCommandRegistry } from "@karya/command-registry";
import { DefaultCaptureService } from "@karya/capture-service";
import { DefaultContinueWorkingService, InMemoryContinuityService } from "@karya/continuity-service";
import type { ContentStore } from "@karya/content-store";
import { InMemoryCalendarEventService } from "@karya/event-service";
import { InMemoryEventBus } from "@karya/event-bus";
import { DefaultResourceEditingService } from "@karya/editing-service";
import { DefaultImportService, type ImportSourceProvider } from "@karya/import-service";
import { InMemoryNotificationService } from "@karya/notification-service";
import { InMemoryProfileService } from "@karya/profile-service";
import {
  DefaultQueryService,
  InMemoryResourceQueryRepository,
  InMemoryWorkspaceQueryRepository,
  type ResourceQueryRepository,
  type SearchQueryRepository,
  type WorkspaceQueryRepository,
} from "@karya/query-service";
import { DefaultRelationshipService } from "@karya/relationship-service";
import { InMemoryResourceService } from "@karya/resource-service";
import { InMemorySearchService } from "@karya/search-service";
import { InMemorySettingsService } from "@karya/settings-service";
import { KaryaStateEngine } from "@karya/state-engine";
import { SynchronizationEngine } from "@karya/sync-service";
import {
  LoopbackTransportProvider,
  RemoteTransportEngine,
  type RemoteTransportOptions,
  type TransportProvider,
} from "@karya/transport-service";
import type { ApplicationProvider, PlatformProviders } from "@karya/platform";
import type { CommandRegistry } from "@karya/command-registry";
import type {
  EditableResourceContent,
  EditCheckpoint,
  EditSession,
  EntityId,
  ImportDestination,
  KaryaNotification,
  Profile,
  Resource,
  SyncConflict,
  SyncDeviceState,
  SyncOperation,
  SyncReplayReceipt,
  KaryaAccount,
  TrustedDevice,
  TransportSessionRecord,
  Workspace,
} from "@karya/types";
import { InMemoryWorkspaceService } from "@karya/workspace-service";
import type { ApplicationRepository } from "@karya/application-registry";
import type { ResourceRepository, WorkspaceRepository } from "@karya/domain";
import type {
  MetadataUnitOfWork,
  ActivityRepository,
  NotificationRepository,
  ProfileRepository,
  SearchDocumentRepository,
  SessionRepository,
  SettingsRepository,
  Repository,
  SyncOperationRepository,
} from "@karya/persistence";
import { CommandBus } from "./command-bus";
import { registerCommandHandlers } from "./command-handlers";
import type { KaryaKernel } from "./contracts";
import { initializeKernel } from "./lifecycle";
import { createSeedData, type SeedDataOptions } from "./seed-data";
import { ServiceRegistry } from "./service-registry";
import { KernelShellApi } from "./shell-api";

export const createKaryaCore = createKaryaKernel;

export interface KaryaKernelOptions {
  contentStore?: ContentStore;
  importSourceProvider?: ImportSourceProvider;
  platform?: PlatformProviders;
  seed?: SeedDataOptions;
  persistence?: {
    activities?: ActivityRepository;
    editableContents?: Repository<EditableResourceContent>;
    editCheckpoints?: Repository<EditCheckpoint>;
    editSessions?: Repository<EditSession>;
    syncOperations?: SyncOperationRepository;
    syncDeviceStates?: Repository<SyncDeviceState>;
    syncReplayReceipts?: Repository<SyncReplayReceipt>;
    syncConflicts?: Repository<SyncConflict>;
    accounts?: Repository<KaryaAccount>;
    trustedDevices?: Repository<TrustedDevice>;
    transportSessions?: Repository<TransportSessionRecord>;
    notifications?: NotificationRepository;
    applications?: ApplicationRepository;
    profiles?: ProfileRepository;
    resourceQueries?: ResourceQueryRepository;
    resources?: ResourceRepository;
    searchQueries?: SearchQueryRepository;
    search?: SearchDocumentRepository;
    sessions?: SessionRepository;
    settings?: SettingsRepository;
    workspaces?: WorkspaceRepository;
    workspaceQueries?: WorkspaceQueryRepository;
    unitOfWork?: MetadataUnitOfWork;
    initialize?: () => Promise<void>;
    seedIfEmpty?: (seed: ReturnType<typeof createSeedData>) => Promise<void>;
    close?: () => Promise<void>;
  };
  editing?: { autosaveDelayMs?: number };
  account?: { displayName?: string; device?: Partial<LocalDeviceDescriptor> };
  transport?: RemoteTransportOptions & { provider?: TransportProvider };
}

export function createKaryaKernel(options: KaryaKernelOptions = {}): KaryaKernel {
  const registry = new ServiceRegistry();
  const eventBus = new InMemoryEventBus(false);
  const seed = createSeedData(options.seed);
  const applicationProvider = options.platform?.applications ?? createNoopApplicationProvider();
  const profileService = new InMemoryProfileService(eventBus, seed.profiles, options.persistence?.profiles);
  const syncDeviceStates = options.persistence?.syncDeviceStates ?? new MemoryRepository<SyncDeviceState>();
  const accountService = new DefaultAccountEngine(
    eventBus,
    {
      accounts: options.persistence?.accounts ?? new MemoryRepository<KaryaAccount>(),
      devices: options.persistence?.trustedDevices ?? new MemoryRepository<TrustedDevice>(),
      deviceStates: syncDeviceStates,
    },
    {
      name: options.account?.device?.name ?? "This device",
      platform: options.account?.device?.platform ?? "unknown",
      platformVersion: options.account?.device?.platformVersion,
    },
    async () => (await profileService.listProfiles()).map(({ id }) => id),
  );
  const workspaceService = new InMemoryWorkspaceService(
    eventBus,
    seed.workspaces,
    seed.session.activeWorkspaceId,
    options.persistence?.workspaces,
  );
  const resourceService = new InMemoryResourceService(eventBus, seed.resources, options.persistence?.resources);
  const editableContents = options.persistence?.editableContents ?? new MemoryRepository<EditableResourceContent>();
  const editSessions = options.persistence?.editSessions ?? new MemoryRepository<EditSession>();
  const editCheckpoints = options.persistence?.editCheckpoints ?? new MemoryRepository<EditCheckpoint>();
  const editingService = new DefaultResourceEditingService(
    eventBus,
    resourceService,
    { contents: editableContents, sessions: editSessions, checkpoints: editCheckpoints },
    options.editing?.autosaveDelayMs,
  );
  const captureService = new DefaultCaptureService(eventBus, profileService, workspaceService, resourceService);
  const activityService = new InMemoryActivityService(eventBus, seed.activities, options.persistence?.activities);
  const commandRegistry = new InMemoryCommandRegistry(eventBus);
  const eventService = new InMemoryCalendarEventService(eventBus, seed.events);
  const relationshipService = new DefaultRelationshipService(resourceService, eventService);
  const applicationRegistry = new InMemoryApplicationRegistry(
    eventBus,
    seed.applications,
    applicationProvider,
    options.persistence?.applications,
  );
  const notificationService = new InMemoryNotificationService(
    eventBus,
    activityService,
    seed.notifications,
    options.persistence?.notifications,
    async () => (await profileService.getActiveProfile())?.id,
    async () => (await workspaceService.getActiveWorkspace())?.id,
  );
  const synchronizationService = new SynchronizationEngine(
    eventBus,
    {
      operations: options.persistence?.syncOperations ?? new MemorySyncOperationRepository(),
      deviceStates: syncDeviceStates,
      receipts: options.persistence?.syncReplayReceipts ?? new MemoryRepository<SyncReplayReceipt>(),
      conflicts: options.persistence?.syncConflicts ?? new MemoryRepository<SyncConflict>(),
    },
    {
      async getUpdatedAt(entityType, entityId) {
        if (entityType === "profile")
          return (await profileService.listProfiles()).find((item) => item.id === entityId)?.updatedAt;
        if (entityType === "workspace")
          return (await workspaceService.listWorkspaces()).find((item) => item.id === entityId)?.updatedAt;
        if (entityType === "resource") return (await resourceService.getResource(entityId))?.updatedAt;
        if (entityType === "resource-content") return (await editingService.getContent(entityId)).updatedAt;
        if (entityType === "notification") return (await notificationService.get(entityId))?.updatedAt;
        return undefined;
      },
      async apply(operation) {
        const payload = JSON.parse(operation.payload) as unknown;
        if (operation.entityType === "profile") await profileService.applyReplica(payload as Profile);
        else if (operation.entityType === "workspace") await workspaceService.applyReplica(payload as Workspace);
        else if (operation.entityType === "resource") await resourceService.applyReplica(payload as Resource);
        else if (operation.entityType === "resource-content")
          await editingService.applyReplicaContent(payload as EditableResourceContent);
        else if (operation.entityType === "notification")
          await notificationService.applyReplica(payload as KaryaNotification);
        else return false;
        return true;
      },
    },
    { authorize: (deviceId) => accountService.authorizeSynchronization(deviceId) },
  );
  const transportService = new RemoteTransportEngine(
    synchronizationService,
    options.transport?.provider ?? new LoopbackTransportProvider(),
    options.persistence?.transportSessions ?? new MemoryRepository<TransportSessionRecord>(),
    options.transport,
  );
  const settingsService = new InMemorySettingsService(seed.settings, options.persistence?.settings);
  const continuityService = new InMemoryContinuityService(eventBus, seed.session, options.persistence?.sessions);
  const continueWorkingService = new DefaultContinueWorkingService(eventBus, {
    getSession: () => continuityService.getCurrentSession(),
    listProfiles: () => profileService.listProfiles(),
    listResources: () => resourceService.listResources(),
    listWorkspaces: () => workspaceService.listWorkspaces(),
  });
  const searchService = new InMemorySearchService(eventBus, [], options.persistence?.search);
  const queryService = new DefaultQueryService({
    resources: options.persistence?.resourceQueries ?? new InMemoryResourceQueryRepository(seed.resources),
    search: { search: (text) => searchService.query(text) },
    workspaces: options.persistence?.workspaceQueries ?? new InMemoryWorkspaceQueryRepository(seed.workspaces),
  });
  const commandBus = new CommandBus({
    contentStore: options.contentStore,
    registry,
    eventBus,
    platform: options.platform,
    unitOfWork: options.persistence?.unitOfWork,
    publish: (eventName, payload) => eventBus.publish(eventName, payload),
  });
  registerBuiltInPaletteCommands(commandRegistry);
  const importService = new DefaultImportService({
    commandExecutor: {
      execute: (command) => commandBus.execute(command),
    },
    eventPublisher: {
      publish: (eventName, payload) => eventBus.publish(eventName, payload),
    },
    sourceProvider: options.importSourceProvider,
  });
  registerCommandHandlers(commandBus);
  const stateEngine = new KaryaStateEngine(eventBus);
  let unsubscribeContinuityEvents: (() => void) | undefined;
  let unsubscribeContinueWorkingEvents: (() => void) | undefined;
  let unsubscribeActivityEvents: (() => void) | undefined;
  let unsubscribeNotificationEvents: (() => void) | undefined;
  let unsubscribeSearchEvents: (() => void) | undefined;
  let unsubscribeStateEngine: (() => void) | undefined;
  let bootPromise: Promise<void> | undefined;
  let lifecycleState: import("./contracts").KaryaCoreLifecycleState = "created";
  let lifecycleQueue = Promise.resolve();
  const enqueueLifecycle = (operation: () => Promise<void>): Promise<void> => {
    const result = lifecycleQueue.then(operation, operation);
    lifecycleQueue = result.catch(() => undefined);
    return result;
  };

  registry.register({
    key: "eventBus",
    service: eventBus,
    start: () => eventBus.start(),
    stop: () => eventBus.stop(),
  });
  registry.register({
    key: "activityService",
    service: activityService,
    dependencies: ["eventBus"],
    start: async () => {
      unsubscribeActivityEvents = activityService.subscribeToEvents();
    },
    stop: async () => {
      unsubscribeActivityEvents?.();
    },
  });
  registry.register({
    key: "profileService",
    service: profileService,
    dependencies: ["eventBus"],
  });
  registry.register({
    key: "accountService",
    service: accountService,
    dependencies: ["eventBus", "profileService"],
    start: async () => {
      await accountService.start();
      if (!(await accountService.current())) {
        await accountService.create(options.account?.displayName ?? "My Karya");
      }
    },
    stop: () => accountService.stop(),
  });
  registry.register({
    key: "workspaceService",
    service: workspaceService,
    dependencies: ["eventBus"],
  });
  registry.register({
    key: "resourceService",
    service: resourceService,
    dependencies: ["eventBus"],
  });
  registry.register({
    key: "editingService",
    service: editingService,
    dependencies: ["eventBus", "resourceService"],
    start: () => editingService.start(),
    stop: () => editingService.suspend(),
  });
  registry.register({
    key: "captureService",
    service: captureService,
    dependencies: ["eventBus", "profileService", "workspaceService", "resourceService"],
  });
  registry.register({
    key: "eventService",
    service: eventService,
    dependencies: ["eventBus"],
  });
  registry.register({
    key: "relationshipService",
    service: relationshipService,
    dependencies: ["resourceService", "eventService"],
  });
  registry.register({
    key: "applicationRegistry",
    service: applicationRegistry,
    dependencies: ["eventBus"],
  });
  registry.register({ key: "commandRegistry", service: commandRegistry, dependencies: ["eventBus"] });
  registry.register({ key: "settingsService", service: settingsService });
  registry.register({ key: "queryService", service: queryService });
  registry.register({ key: "importService", service: importService });
  registry.register({
    key: "notificationService",
    service: notificationService,
    dependencies: ["eventBus", "activityService"],
    start: async () => {
      unsubscribeNotificationEvents = notificationService.subscribeToActivities();
    },
    stop: async () => {
      unsubscribeNotificationEvents?.();
    },
  });
  registry.register({
    key: "synchronizationService",
    service: synchronizationService,
    dependencies: [
      "eventBus",
      "accountService",
      "profileService",
      "workspaceService",
      "resourceService",
      "editingService",
      "notificationService",
    ],
    start: () => synchronizationService.start(),
    stop: () => synchronizationService.stop(),
  });
  registry.register({
    key: "transportService",
    service: transportService,
    dependencies: ["synchronizationService", "accountService"],
    start: async () => {
      await transportService.start();
      if ((await transportService.status()).state === "suspended") await transportService.resume();
    },
    stop: () => transportService.suspend(),
  });
  registry.register({
    key: "continueWorkingService",
    service: continueWorkingService,
    dependencies: ["eventBus", "continuityService", "profileService", "resourceService", "workspaceService"],
    start: async () => {
      unsubscribeContinueWorkingEvents = continueWorkingService.subscribeToEvents();
    },
    stop: async () => {
      unsubscribeContinueWorkingEvents?.();
    },
  });
  registry.register({
    key: "continuityService",
    service: continuityService,
    dependencies: ["eventBus"],
    start: async () => {
      unsubscribeContinuityEvents = continuityService.subscribeToEvents();
    },
    stop: async () => {
      unsubscribeContinuityEvents?.();
    },
  });
  registry.register({
    key: "searchService",
    service: searchService,
    dependencies: ["eventBus"],
    start: async () => {
      unsubscribeSearchEvents = searchService.subscribeToEvents();
    },
    stop: async () => {
      unsubscribeSearchEvents?.();
    },
  });

  const shell = new KernelShellApi(commandBus, stateEngine, accountService);

  return {
    registry,
    commandBus,
    shell,
    async boot() {
      if (lifecycleState === "running") return;
      if (lifecycleState === "stopped") {
        throw new Error("Karya Core cannot boot after shutdown");
      }
      bootPromise ??= (async () => {
        lifecycleState = "booting";
        try {
          await options.persistence?.initialize?.();
          await options.persistence?.seedIfEmpty?.(seed);
          unsubscribeStateEngine = await initializeKernel(registry, stateEngine, shell);
          lifecycleState = "running";
        } catch (error) {
          lifecycleState = "failed";
          bootPromise = undefined;
          throw error;
        }
      })();
      await bootPromise;
    },
    async suspend() {
      await enqueueLifecycle(async () => {
        if (lifecycleState !== "running") return;
        await registry.stop();
        lifecycleState = "suspended";
      });
    },
    async resume() {
      await enqueueLifecycle(async () => {
        if (lifecycleState === "created") {
          await this.boot();
          return;
        }
        if (lifecycleState !== "suspended") return;
        await registry.start();
        lifecycleState = "running";
      });
    },
    async shutdown() {
      await enqueueLifecycle(async () => {
        if (lifecycleState === "stopped" || lifecycleState === "shutting-down") return;
        lifecycleState = "shutting-down";
        unsubscribeStateEngine?.();
        await registry.stop();
        eventBus.clear();
        await options.persistence?.close?.();
        bootPromise = undefined;
        lifecycleState = "stopped";
      });
    },
    getLifecycleState() {
      return lifecycleState;
    },
  };
}

function createNoopApplicationProvider(): ApplicationProvider {
  return {
    async discoverInstalledApplications() {
      return [];
    },
    async refreshApplications() {
      return [];
    },
    async getApplicationMetadata() {
      return undefined;
    },
    async getApplicationIcon() {
      return undefined;
    },
    async resolveExecutablePath() {
      return undefined;
    },
    async openExternal() {},
    async launch() {},
    async openFile() {},
  };
}

class MemoryRepository<TEntity extends { id: EntityId }> implements Repository<TEntity> {
  private readonly values = new Map<EntityId, TEntity>();
  async list() {
    return [...this.values.values()];
  }
  async get(id: EntityId) {
    return this.values.get(id);
  }
  async save(entity: TEntity) {
    this.values.set(entity.id, entity);
  }
  async delete(id: EntityId) {
    this.values.delete(id);
  }
}

class MemorySyncOperationRepository implements SyncOperationRepository {
  private readonly values = new Map<EntityId, SyncOperation>();
  async append(operation: SyncOperation) {
    if (this.values.has(operation.id)) return false;
    this.values.set(operation.id, operation);
    return true;
  }
  async get(id: EntityId) {
    return this.values.get(id);
  }
  async list(state?: SyncOperation["acknowledgementState"]) {
    return [...this.values.values()].filter((item) => !state || item.acknowledgementState === state);
  }
  async updateAcknowledgement(
    id: EntityId,
    state: SyncOperation["acknowledgementState"],
    at?: string,
    reason?: string,
  ) {
    const current = this.values.get(id);
    if (!current) throw new Error(`Sync operation not found: ${id}`);
    const updated: SyncOperation = {
      ...current,
      acknowledgementState: state,
      acknowledgedAt: state === "acknowledged" ? at : current.acknowledgedAt,
      failureReason: reason,
    };
    this.values.set(id, updated);
    return updated;
  }
}

function registerBuiltInPaletteCommands(commandRegistry: CommandRegistry): void {
  commandRegistry.register({
    id: "create-note",
    title: "Create Note",
    description: "Create a note in the current context",
    category: "create",
    scope: "workspace",
    keywords: ["note", "new note", "create", "writing", "capture"],
    shortcut: "⌘N",
    pinned: true,
    handler: async ({ execute, getSnapshot }) => {
      const note = await execute<Resource>({
        id: crypto.randomUUID(),
        type: "CreateNoteCommand",
        payload: { title: "Untitled Note", content: "", destination: resolvePaletteDestination(await getSnapshot()) },
      });
      return execute({ id: crypto.randomUUID(), type: "SelectResourceCommand", payload: { resourceId: note.id } });
    },
  });
  commandRegistry.register({
    id: "create-task",
    title: "Create Task",
    description: "Create a task in the current context",
    category: "create",
    scope: "workspace",
    keywords: ["task", "todo", "new task", "create", "due"],
    shortcut: "⌘T",
    pinned: true,
    handler: async ({ execute, getSnapshot }) => {
      const task = await execute<Resource>({
        id: crypto.randomUUID(),
        type: "CreateTaskCommand",
        payload: { title: "Untitled Task", destination: resolvePaletteDestination(await getSnapshot()) },
      });
      return execute({ id: crypto.randomUUID(), type: "SelectResourceCommand", payload: { resourceId: task.id } });
    },
  });
  commandRegistry.register({
    id: "create-bookmark",
    title: "Create Bookmark",
    description: "Create a placeholder bookmark in the current context",
    category: "create",
    scope: "workspace",
    keywords: ["bookmark", "link", "url", "create"],
    shortcut: "⌘B",
    handler: async ({ execute, getSnapshot }) =>
      execute({
        id: crypto.randomUUID(),
        type: "CreateBookmarkCommand",
        payload: {
          url: "https://example.com",
          title: "New Bookmark",
          destination: resolvePaletteDestination(await getSnapshot()),
        },
      }),
  });
  commandRegistry.register({
    id: "open-calendar",
    title: "Open Calendar",
    description: "Open calendar results",
    category: "navigate",
    scope: "global",
    keywords: ["calendar", "events", "meetings", "schedule"],
    shortcut: "⌘7",
    handler: ({ execute }) =>
      execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "calendar event" } }),
  });
  commandRegistry.register({
    id: "open-notes",
    title: "Open Notes",
    description: "Search notes",
    category: "navigate",
    scope: "global",
    keywords: ["notes", "note", "writing"],
    shortcut: "⌘2",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "note" } }),
  });
  commandRegistry.register({
    id: "open-tasks",
    title: "Open Tasks",
    description: "Search tasks",
    category: "navigate",
    scope: "global",
    keywords: ["tasks", "task", "todo"],
    shortcut: "⌘3",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "task" } }),
  });
  commandRegistry.register({
    id: "open-bookmarks",
    title: "Open Bookmarks",
    description: "Search bookmarks",
    category: "navigate",
    scope: "global",
    keywords: ["bookmarks", "bookmark", "links"],
    shortcut: "⌘4",
    handler: ({ execute }) =>
      execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "bookmark" } }),
  });
  commandRegistry.register({
    id: "open-notifications",
    title: "Open Notifications",
    description: "Search notifications",
    category: "navigate",
    scope: "global",
    keywords: ["notifications", "alerts", "reminders"],
    shortcut: "⌘9",
    handler: ({ execute }) =>
      execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "notification unread" } }),
  });
  commandRegistry.register({
    id: "open-recent-activity",
    title: "Open Recent Activity",
    description: "Search recent timeline activity",
    category: "navigate",
    scope: "global",
    keywords: ["activity", "recent activity", "changes", "timeline"],
    shortcut: "⌘8",
    handler: ({ execute }) =>
      execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "activity recent" } }),
  });
  commandRegistry.register({
    id: "open-settings",
    title: "Open Settings",
    description: "Open settings search",
    category: "navigate",
    scope: "global",
    keywords: ["settings", "preferences"],
    shortcut: "⌘,",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "setting" } }),
  });
  commandRegistry.register({
    id: "open-clipboard",
    title: "Open Clipboard",
    description: "Open clipboard history",
    category: "navigate",
    scope: "global",
    keywords: ["clipboard", "copy", "paste", "history"],
    shortcut: "⇧⌘V",
    handler: ({ execute }) =>
      execute({ id: crypto.randomUUID(), type: "OpenSettingCommand", payload: { settingId: "setting-clipboard" } }),
  });
  commandRegistry.register({
    id: "resume-last-workspace",
    title: "Resume Last Workspace",
    description: "Resume the current workspace context",
    category: "workspace",
    scope: "workspace",
    keywords: ["resume", "continue", "workspace", "context"],
    shortcut: "⌘R",
    handler: async ({ execute, getSnapshot }) => {
      const snapshot = (await getSnapshot()) as {
        resources?: { recent?: Array<{ id: string }> };
        workspaces?: { active?: { id: string } };
      };
      return execute({
        id: crypto.randomUUID(),
        type: "ResumeContextCommand",
        payload: {
          resourceIds: snapshot.resources?.recent?.map((resource) => resource.id) ?? [],
          workspaceId: snapshot.workspaces?.active?.id,
        },
      });
    },
  });
}

function resolvePaletteDestination(snapshot: unknown): ImportDestination | undefined {
  const typed = snapshot as {
    shell?: { activeSurface?: { type: string; workspaceId?: string; profileId?: string; resourceId?: string } };
    profiles?: { all?: Array<{ id: string; defaultSpaceId: string }> };
    resources?: { all?: Array<{ id: string; primaryWorkspaceId?: string; workspaceRefs: string[] }> };
    workspaces?: { all?: Array<{ id: string; profileId: string; lifecycleState?: string }> };
  };
  const activeSurface = typed.shell?.activeSurface;
  if (activeSurface?.type === "workspace" && activeSurface.workspaceId)
    return destinationForWorkspaceSnapshot(typed, activeSurface.workspaceId);
  if (activeSurface?.type === "profile" && activeSurface.profileId) {
    const profile = typed.profiles?.all?.find((candidate) => candidate.id === activeSurface.profileId);
    return profile
      ? { profileId: profile.id, workspaceId: profile.defaultSpaceId, defaultSpace: "profile" }
      : undefined;
  }
  if (activeSurface?.type === "folder" && activeSurface.resourceId) {
    const folder = typed.resources?.all?.find((resource) => resource.id === activeSurface.resourceId);
    const workspaceId = folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
    return workspaceId ? destinationForWorkspaceSnapshot(typed, workspaceId) : undefined;
  }
  return destinationForWorkspaceSnapshot(typed, "workspace-desktop-home-default-space");
}

function destinationForWorkspaceSnapshot(
  snapshot: ReturnType<typeof snapshotShape>,
  workspaceId: string,
): ImportDestination | undefined {
  const workspace = snapshot.workspaces?.all?.find((candidate) => candidate.id === workspaceId);
  if (!workspace || workspace.lifecycleState === "deleted") return undefined;
  if (workspace.id === "workspace-desktop-home-default-space")
    return { workspaceId: workspace.id, defaultSpace: "user" };
  const ownerProfile = snapshot.profiles?.all?.find((profile) => profile.id === workspace.profileId);
  return {
    profileId: workspace.profileId,
    workspaceId: workspace.id,
    defaultSpace: ownerProfile?.defaultSpaceId === workspace.id ? "profile" : "none",
  };
}

function snapshotShape(snapshot: unknown): {
  profiles?: { all?: Array<{ id: string; defaultSpaceId: string }> };
  workspaces?: { all?: Array<{ id: string; profileId: string; lifecycleState?: string }> };
} {
  return snapshot as {
    profiles?: { all?: Array<{ id: string; defaultSpaceId: string }> };
    workspaces?: { all?: Array<{ id: string; profileId: string; lifecycleState?: string }> };
  };
}
