import { InMemoryApplicationRegistry } from "@karya/application-registry";
import { InMemoryActivityService } from "@karya/activity-service";
import { InMemoryCommandRegistry } from "@karya/command-registry";
import { InMemoryContinuityService } from "@karya/continuity-service";
import type { ContentStore } from "@karya/content-store";
import { InMemoryCalendarEventService } from "@karya/event-service";
import { InMemoryEventBus } from "@karya/event-bus";
import { DefaultImportService, type ImportSourceProvider } from "@karya/import-service";
import { InMemoryNotificationService } from "@karya/notification-service";
import { InMemoryProfileService } from "@karya/profile-service";
import {
  DefaultQueryService,
  InMemoryResourceQueryRepository,
  InMemorySearchQueryRepository,
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
import type { ApplicationProvider, PlatformProviders } from "@karya/platform";
import type { CommandRegistry } from "@karya/command-registry";
import type { ImportDestination, Resource } from "@karya/types";
import { InMemoryWorkspaceService } from "@karya/workspace-service";
import type { ApplicationRepository } from "@karya/application-registry";
import type { ResourceRepository, WorkspaceRepository } from "@karya/domain";
import type { MetadataUnitOfWork, ProfileRepository, SearchDocumentRepository, SessionRepository, SettingsRepository } from "@karya/persistence";
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
}

export function createKaryaKernel(options: KaryaKernelOptions = {}): KaryaKernel {
  const registry = new ServiceRegistry();
  const eventBus = new InMemoryEventBus();
  const seed = createSeedData(options.seed);
  const applicationProvider = options.platform?.applications ?? createNoopApplicationProvider();
  const profileService = new InMemoryProfileService(eventBus, seed.profiles, options.persistence?.profiles);
  const workspaceService = new InMemoryWorkspaceService(eventBus, seed.workspaces, seed.workspaces[0]?.id, options.persistence?.workspaces);
  const resourceService = new InMemoryResourceService(eventBus, seed.resources, options.persistence?.resources);
  const activityService = new InMemoryActivityService(eventBus, seed.activities);
  const commandRegistry = new InMemoryCommandRegistry(eventBus);
  const eventService = new InMemoryCalendarEventService(eventBus, seed.events);
  const relationshipService = new DefaultRelationshipService(resourceService, eventService);
  const applicationRegistry = new InMemoryApplicationRegistry(eventBus, seed.applications, applicationProvider, options.persistence?.applications);
  const notificationService = new InMemoryNotificationService(eventBus, seed.notifications, options.platform?.notifications);
  const settingsService = new InMemorySettingsService(seed.settings, options.persistence?.settings);
  const continuityService = new InMemoryContinuityService(eventBus, seed.session, options.persistence?.sessions);
  const searchService = new InMemorySearchService(eventBus, [], options.persistence?.search);
  const queryService = new DefaultQueryService({
    resources: options.persistence?.resourceQueries ?? new InMemoryResourceQueryRepository(seed.resources),
    search: options.persistence?.searchQueries ?? new InMemorySearchQueryRepository([]),
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
  let unsubscribeActivityEvents: (() => void) | undefined;
  let unsubscribeNotificationEvents: (() => void) | undefined;
  let unsubscribeReminderScheduler: (() => void) | undefined;
  let unsubscribeSearchEvents: (() => void) | undefined;
  let unsubscribeStateEngine: (() => void) | undefined;
  let bootPromise: Promise<void> | undefined;

  registry.register({ key: "eventBus", service: eventBus });
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
    dependencies: ["eventBus"],
    start: async () => {
      unsubscribeNotificationEvents = notificationService.subscribeToEvents();
      unsubscribeReminderScheduler = notificationService.startReminderScheduler();
    },
    stop: async () => {
      unsubscribeReminderScheduler?.();
      unsubscribeNotificationEvents?.();
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

  const shell = new KernelShellApi(commandBus, stateEngine);

  return {
    registry,
    commandBus,
    shell,
    async boot() {
      bootPromise ??= (async () => {
        try {
          await options.persistence?.initialize?.();
          await options.persistence?.seedIfEmpty?.(seed);
          unsubscribeStateEngine = await initializeKernel(registry, stateEngine, shell);
        } catch (error) {
          bootPromise = undefined;
          throw error;
        }
      })();
      await bootPromise;
    },
    async shutdown() {
      unsubscribeStateEngine?.();
      await registry.stop();
      eventBus.clear();
      await options.persistence?.close?.();
      bootPromise = undefined;
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
    handler: async ({ execute, getSnapshot }) => execute({
      id: crypto.randomUUID(),
      type: "CreateBookmarkCommand",
      payload: { url: "https://example.com", title: "New Bookmark", destination: resolvePaletteDestination(await getSnapshot()) },
    }),
  });
  commandRegistry.register({
    id: "create-workspace",
    title: "New Workspace",
    description: "Create a new workspace",
    category: "create",
    scope: "global",
    keywords: ["workspace", "new workspace", "create workspace"],
    shortcut: "⇧⌘W",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "CreateWorkspaceCommand", payload: { name: "Untitled Workspace" } }),
  });
  commandRegistry.register({
    id: "create-profile",
    title: "New Profile",
    description: "Create a new profile",
    category: "create",
    scope: "global",
    keywords: ["profile", "new profile", "create profile"],
    shortcut: "⇧⌘P",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "CreateProfileCommand", payload: { name: "Untitled Profile", template: "custom" } }),
  });
  commandRegistry.register({
    id: "open-calendar",
    title: "Open Calendar",
    description: "Open calendar results",
    category: "navigate",
    scope: "global",
    keywords: ["calendar", "events", "meetings", "schedule"],
    shortcut: "⌘7",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "calendar event" } }),
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
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "bookmark" } }),
  });
  commandRegistry.register({
    id: "open-notifications",
    title: "Open Notifications",
    description: "Search notifications",
    category: "navigate",
    scope: "global",
    keywords: ["notifications", "alerts", "reminders"],
    shortcut: "⌘9",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "notification unread" } }),
  });
  commandRegistry.register({
    id: "open-recent-activity",
    title: "Open Recent Activity",
    description: "Search recent timeline activity",
    category: "navigate",
    scope: "global",
    keywords: ["activity", "recent activity", "changes", "timeline"],
    shortcut: "⌘8",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "activity recent" } }),
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
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "OpenSettingCommand", payload: { settingId: "setting-clipboard" } }),
  });
  commandRegistry.register({
    id: "import-file",
    title: "Import File",
    description: "Open the file import command",
    category: "system",
    scope: "workspace",
    keywords: ["import", "file", "add file"],
    shortcut: "⌘I",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "import file" } }),
  });
  commandRegistry.register({
    id: "import-folder",
    title: "Import Folder",
    description: "Open the folder import command",
    category: "system",
    scope: "workspace",
    keywords: ["import", "folder", "directory"],
    shortcut: "⇧⌘I",
    handler: ({ execute }) => execute({ id: crypto.randomUUID(), type: "SearchCommand", payload: { term: "import folder" } }),
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
      const snapshot = await getSnapshot() as { resources?: { recent?: Array<{ id: string }> }; workspaces?: { active?: { id: string } } };
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
  if (activeSurface?.type === "workspace" && activeSurface.workspaceId) return destinationForWorkspaceSnapshot(typed, activeSurface.workspaceId);
  if (activeSurface?.type === "profile" && activeSurface.profileId) {
    const profile = typed.profiles?.all?.find((candidate) => candidate.id === activeSurface.profileId);
    return profile ? { profileId: profile.id, workspaceId: profile.defaultSpaceId, defaultSpace: "profile" } : undefined;
  }
  if (activeSurface?.type === "folder" && activeSurface.resourceId) {
    const folder = typed.resources?.all?.find((resource) => resource.id === activeSurface.resourceId);
    const workspaceId = folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
    return workspaceId ? destinationForWorkspaceSnapshot(typed, workspaceId) : undefined;
  }
  return destinationForWorkspaceSnapshot(typed, "workspace-desktop-home-default-space");
}

function destinationForWorkspaceSnapshot(snapshot: ReturnType<typeof snapshotShape>, workspaceId: string): ImportDestination | undefined {
  const workspace = snapshot.workspaces?.all?.find((candidate) => candidate.id === workspaceId);
  if (!workspace || workspace.lifecycleState === "deleted") return undefined;
  if (workspace.id === "workspace-desktop-home-default-space") return { workspaceId: workspace.id, defaultSpace: "user" };
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
