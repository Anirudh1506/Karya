import type { StateEngine } from "@karya/state-engine";
import type { InstalledApplication, KaryaActivity, Profile, SearchDocument } from "@karya/types";
import type { ServiceRegistry } from "./service-registry";
import type { KernelShellApi } from "./shell-api";

export async function initializeKernel(
  registry: ServiceRegistry,
  stateEngine: StateEngine,
  shell: KernelShellApi,
): Promise<() => void> {
  await initialize(registry);
  await registerServices(registry);
  await initializePersistence(registry);
  await discoverApplications(registry);
  await hydrateStateEngine(registry, stateEngine);
  const unsubscribeStateEngine = stateEngine.start();
  await initializeSearch(registry);
  await restoreSession(registry);
  await shell.initialize();
  return unsubscribeStateEngine;
}

async function initialize(registry: ServiceRegistry): Promise<void> {
  registerKernelEventHandlers(registry);
}

async function registerServices(registry: ServiceRegistry): Promise<void> {
  await registry.start();
}

async function initializePersistence(_registry: ServiceRegistry): Promise<void> {
  // Persistence is intentionally behind the kernel boundary. The current implementation is in-memory.
}

async function discoverApplications(registry: ServiceRegistry): Promise<void> {
  await registry.resolve("applicationRegistry").discoverApplications();
}

async function initializeSearch(registry: ServiceRegistry): Promise<void> {
  const searchService = registry.resolve("searchService");
  await searchService.loadPersistedIndex();

  if ((await searchService.listDocuments()).length === 0) {
    await seedSearchIndex(registry);
  }
}

async function hydrateStateEngine(registry: ServiceRegistry, stateEngine: StateEngine): Promise<void> {
  const [activeProfile, resources, events, activities, commands, notifications, profiles, workspaces, applications, settings, session] = await Promise.all([
    registry.resolve("profileService").getActiveProfile(),
    registry.resolve("resourceService").listResources(),
    registry.resolve("eventService").listEvents(),
    registry.resolve("activityService").list(),
    registry.resolve("commandRegistry").listSearchDocuments(),
    registry.resolve("notificationService").list(),
    registry.resolve("profileService").listProfiles(),
    registry.resolve("workspaceService").listWorkspaces(),
    registry.resolve("applicationRegistry").listInstalledApplications(),
    registry.resolve("settingsService").listSettings(),
    registry.resolve("continuityService").getCurrentSession(),
  ]);

  stateEngine.hydrate({
    applications,
    activities,
    commands,
    events,
    notifications,
    profiles,
    resources,
    session,
    settings,
    user: {
      id: activeProfile.id,
      name: activeProfile.name,
    },
    workspaces,
  });
}

async function restoreSession(registry: ServiceRegistry): Promise<void> {
  const session = await registry.resolve("continuityService").getCurrentSession();
  await registry.resolve("eventBus").publish("SessionRestored", { session });
  await registry.resolve("eventBus").publish("session:restored", { session });
}

function registerKernelEventHandlers(registry: ServiceRegistry): void {
  const eventBus = registry.resolve("eventBus");

  eventBus.subscribe("ResourceCreated", async ({ resource }) => {
    const workspaces = await registry.resolve("workspaceService").listWorkspaces();
    const availableWorkspaceIds = new Set(
      workspaces
        .filter((workspace) => workspace.lifecycleState !== "deleted")
        .map((workspace) => workspace.id),
    );
    await Promise.all(
      resource.workspaceRefs
        .filter((workspaceId) => availableWorkspaceIds.has(workspaceId))
        .map((workspaceId) => registry.resolve("workspaceService").addResourceReference(workspaceId, resource.id)),
    );
  });

  eventBus.subscribe("workspace:opened", async ({ workspaceId }) => {
    await registry.resolve("continuityService").setActiveWorkspace(workspaceId);
  });

  eventBus.subscribe("workspace:activated", async ({ workspaceId }) => {
    await registry.resolve("continuityService").setActiveWorkspace(workspaceId);
  });

  eventBus.subscribe("workspace:restored", async ({ workspaceId }) => {
    await registry.resolve("continuityService").setActiveWorkspace(workspaceId);
  });

  eventBus.subscribe("workspace:closed", async ({ workspaceId }) => {
    await registry.resolve("continuityService").preserveWorkspaceSession(workspaceId);
  });

  eventBus.subscribe("profile:changed", async ({ profileId }) => {
    const profile = (await registry.resolve("profileService").listProfiles()).find((candidate) => candidate.id === profileId);
    if (profile && (profile.lifecycleState ?? "active") === "active") {
      await registry.resolve("searchService").index([createProfileDocument(profile)]);
    }
  });

  eventBus.subscribe("ProfileCreated", async ({ profile }) => {
    await registry.resolve("searchService").index([createProfileDocument(profile)]);
  });

  eventBus.subscribe("ProfileUpdated", async ({ profile }) => {
    if (profile.lifecycleState === "deleted") {
      await registry.resolve("searchService").remove(`profile:${profile.id}`);
      return;
    }
    await registry.resolve("searchService").index([createProfileDocument(profile)]);
  });

  eventBus.subscribe("ProfileDeleted", async ({ profile }) => {
    await registry.resolve("searchService").remove(`profile:${profile.id}`);
  });

  eventBus.subscribe("ProfileOpened", async ({ profileId }) => {
    await registry.resolve("continuityService").setActiveProfile(profileId);
  });

  eventBus.subscribe("ApplicationDiscovered", async ({ application }) => {
    await registry.resolve("searchService").index([createApplicationDocument(application)]);
  });

  eventBus.subscribe("ApplicationUpdated", async ({ application }) => {
    if (application.hidden || application.lifecycleState !== "available" || application.metadata.platform === "karya") {
      await registry.resolve("searchService").remove(`application:${application.metadata.id}`);
      return;
    }
    await registry.resolve("searchService").index([createApplicationDocument(application)]);
  });

  eventBus.subscribe("ApplicationRemoved", async ({ applicationId }) => {
    await registry.resolve("searchService").remove(`application:${applicationId}`);
  });

  eventBus.subscribe("ApplicationPinned", async ({ application }) => {
    await registry.resolve("searchService").index([createApplicationDocument(application)]);
  });

  eventBus.subscribe("ApplicationUnpinned", async ({ application }) => {
    await registry.resolve("searchService").index([createApplicationDocument(application)]);
  });

  eventBus.subscribe("ApplicationFavorited", async ({ application }) => {
    await registry.resolve("searchService").index([createApplicationDocument(application)]);
  });

  eventBus.subscribe("ApplicationHidden", async ({ application }) => {
    if (application.hidden || application.lifecycleState !== "available" || application.metadata.platform === "karya") {
      await registry.resolve("searchService").remove(`application:${application.metadata.id}`);
      return;
    }
    await registry.resolve("searchService").index([createApplicationDocument(application)]);
  });

  eventBus.subscribe("ApplicationLaunched", async ({ applicationId, workspaceId, profileId, resourceIds, workingDirectory, launchArguments }) => {
    const session = await registry.resolve("continuityService").getCurrentSession();
    await registry.resolve("continuityService").captureResumeContext({
      profileId: profileId ?? session.activeProfileId,
      workspaceId: workspaceId ?? session.activeWorkspaceId,
      resourceIds,
      applicationIds: [applicationId],
      workingDirectory,
      launchArguments,
    });
  });
}

async function seedSearchIndex(registry: ServiceRegistry): Promise<void> {
  const [resources, events, activities, commands, notifications, profiles, workspaces, applications, settings] = await Promise.all([
    registry.resolve("resourceService").listResources(),
    registry.resolve("eventService").listEvents(),
    registry.resolve("activityService").list(),
    registry.resolve("commandRegistry").listSearchDocuments(),
    registry.resolve("notificationService").list(),
    registry.resolve("profileService").listProfiles(),
    registry.resolve("workspaceService").listWorkspaces(),
    registry.resolve("applicationRegistry").listInstalledApplications(),
    registry.resolve("settingsService").listSettings(),
  ]);

  const documents: SearchDocument[] = [
    ...resources
      .filter((resource) => resource.lifecycleState !== "deleted" && !isCalendarEventResource(resource))
      .map((resource) => ({
        id: `resource:${resource.id}`,
        type: "resource" as const,
        title: resource.metadata.title,
        subtitle: resource.type,
        keywords: [
          ...resource.tags,
          readStringAttribute(resource, "noteOrigin") ?? "",
          readStringAttribute(resource, "noteHeadings") ?? "",
          readStringAttribute(resource, "noteContent") ?? "",
          readStringAttribute(resource, "noteIndexedContent") ?? "",
          readStringAttribute(resource, "taskDescription") ?? "",
          readStringAttribute(resource, "taskDescriptionText") ?? "",
          readStringAttribute(resource, "taskChecklistItems") ?? "",
          readStringAttribute(resource, "taskLabels") ?? "",
          readStringAttribute(resource, "taskStatus") ?? "",
          readStringAttribute(resource, "taskPriority") ?? "",
          readStringAttribute(resource, "taskDueDate") ?? "",
          readStringAttribute(resource, "taskReminderDate") ?? "",
          readStringAttribute(resource, "taskReminderTime") ?? "",
        ].filter(Boolean),
          sourceId: resource.id,
        })),
    ...events
      .filter((event) => event.lifecycleState !== "deleted")
      .map((event) => ({
        id: `event:${event.id}`,
        type: "event" as const,
        title: event.metadata.title,
        subtitle: "Calendar Event",
        keywords: [
          ...event.tags,
          ...event.workspaceRefs,
          readStringAttribute(event, "calendarDescription") ?? "",
          readStringAttribute(event, "calendarStartDate") ?? "",
          readStringAttribute(event, "calendarStartTime") ?? "",
          readStringAttribute(event, "calendarEndDate") ?? "",
          readStringAttribute(event, "calendarEndTime") ?? "",
          readStringAttribute(event, "calendarLocation") ?? "",
          readStringAttribute(event, "calendarCategory") ?? "",
          readStringAttribute(event, "calendarLabels") ?? "",
          readStringAttribute(event, "calendarSearchText") ?? "",
          event.lifecycleState,
        ].filter(Boolean),
        sourceId: event.id,
      })),
    ...notifications
      .filter((notification) => notification.status !== "deleted")
      .map((notification) => ({
        id: `notification:${notification.id}`,
        type: "notification" as const,
        title: notification.title,
        subtitle: notification.description ?? "Notification",
        keywords: [
          notification.category,
          notification.source,
          notification.status,
          notification.priority,
          notification.workspaceId ?? "",
          notification.profileId ?? "",
          ...notification.references.map((reference) => reference.title ?? reference.id),
          ...notification.actions.map((action) => action.label),
        ].filter(Boolean),
        sourceId: notification.id,
      })),
    ...activities.map(createActivityDocument),
    ...profiles.filter((profile) => profile.lifecycleState !== "deleted").map(createProfileDocument),
    ...workspaces
      .filter((workspace) => workspace.lifecycleState !== "deleted")
      .map((workspace) => ({
        id: `workspace:${workspace.id}`,
        type: "workspace" as const,
        title: workspace.name,
        subtitle: workspace.metadata.description ?? "Workspace",
        keywords: [
          workspace.lifecycleState,
          workspace.pinned ? "pinned" : "",
          workspace.favorite ? "favorite" : "",
          ...workspace.resourceRefs,
        ].filter(Boolean),
        sourceId: workspace.id,
      })),
    ...applications
      .filter((application) => !application.hidden && application.lifecycleState === "available" && application.metadata.platform !== "karya")
      .map(createApplicationDocument),
    ...settings
      .filter((setting) => setting.searchable)
      .map((setting) => ({
        id: `setting:${setting.id}`,
        type: "setting" as const,
        title: setting.label,
        subtitle: setting.category,
        keywords: [setting.category, String(setting.value)],
        sourceId: setting.id,
      })),
    ...commands,
  ];

  await registry.resolve("searchService").index(documents);
}

function createActivityDocument(activity: KaryaActivity): SearchDocument {
  return {
    id: `activity:${activity.id}`,
    type: "activity",
    title: activity.title,
    subtitle: `${activity.category} ${activity.verb}`,
    keywords: [
      "activity",
      "timeline",
      "recent",
      "changes",
      "changed",
      activity.category,
      activity.verb,
      activity.source,
      activity.workspaceId ?? "",
      activity.profileId ?? "",
      activity.applicationId ?? "",
      activity.object.title ?? activity.object.id,
      activity.object.type,
      activity.occurredAt.slice(0, 10),
      ...activity.relatedObjects.map((reference) => reference.title ?? reference.id),
      ...Object.values(activity.metadata ?? {}).map(String),
    ].filter(Boolean),
    sourceId: activity.id,
  };
}

function readStringAttribute(resource: { metadata: { attributes?: Record<string, string | number | boolean | null> } }, key: string): string | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "string" ? value : undefined;
}

function isCalendarEventResource(resource: { type: string; metadata: { kind: string } }): boolean {
  return resource.metadata.kind === "calendar-event" || resource.type === "application/vnd.karya.calendar-event";
}

function createProfileDocument(profile: Profile): SearchDocument {
  return {
    id: `profile:${profile.id}`,
    type: "profile",
    title: profile.name,
    subtitle: profile.lifecycleState === "archived" ? "Archived Profile" : profile.description ?? "Profile",
    keywords: [
      profile.lifecycleState ?? "active",
      profile.template ?? "custom",
      profile.icon ?? "",
      profile.accentColor ?? "",
      ...profile.spaceIds,
    ].filter(Boolean),
    sourceId: profile.id,
  };
}

function createApplicationDocument(application: InstalledApplication): SearchDocument {
  return {
    id: `application:${application.metadata.id}`,
    type: "application",
    title: application.metadata.name,
    subtitle: application.metadata.description,
    keywords: [
      application.metadata.category ?? "",
      application.metadata.platform ?? "",
      application.lifecycleState,
      application.pinned ? "pinned" : "",
      application.favorite ? "favorite" : "",
      ...application.metadata.capabilities,
      ...(application.metadata.supportedFileTypes ?? []),
      ...(application.metadata.supportedUrlSchemes ?? []),
    ].filter(Boolean),
    sourceId: application.metadata.id,
  };
}
