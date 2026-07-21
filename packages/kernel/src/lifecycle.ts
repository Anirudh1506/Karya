import type { StateEngine } from "@karya/state-engine";
import {
  createProfileDocument as createUniversalProfileDocument,
  createResourceDocument,
  createWorkspaceDocument,
} from "@karya/search-service";
import type { InstalledApplication, KaryaActivity, SearchDocument } from "@karya/types";
import type { ServiceRegistry } from "./service-registry";
import type { KernelShellApi } from "./shell-api";
import { NO_ACTIVE_PROFILE_ID } from "./constants";

export async function initializeKernel(
  registry: ServiceRegistry,
  stateEngine: StateEngine,
  shell: KernelShellApi,
): Promise<() => void> {
  await initialize(registry);
  await registerServices(registry);
  await initializePersistence(registry);
  await discoverApplications(registry);
  await restoreActiveProfile(registry);
  await hydrateStateEngine(registry, stateEngine);
  const unsubscribeStateEngine = stateEngine.start();
  await registry.resolve("continueWorkingService").refresh();
  await initializeSearch(registry);
  await restoreSession(registry);
  await shell.initialize();
  return unsubscribeStateEngine;
}

async function restoreActiveProfile(registry: ServiceRegistry): Promise<void> {
  const [session, profiles] = await Promise.all([
    registry.resolve("continuityService").getCurrentSession(),
    registry.resolve("profileService").listProfiles(),
  ]);
  const persisted = profiles.find(
    (profile) => profile.id === session.activeProfileId && (profile.lifecycleState ?? "active") === "active",
  );
  if (persisted) {
    await registry.resolve("profileService").activateProfile(persisted.id);
  }
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
  await seedSearchIndex(registry);
}

async function hydrateStateEngine(registry: ServiceRegistry, stateEngine: StateEngine): Promise<void> {
  const [
    activeProfile,
    resources,
    events,
    activities,
    commands,
    notifications,
    profiles,
    workspaces,
    applications,
    settings,
    session,
  ] = await Promise.all([
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
      id: activeProfile?.id ?? NO_ACTIVE_PROFILE_ID,
      name: activeProfile?.name ?? "Karya User",
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
      workspaces.filter((workspace) => workspace.lifecycleState !== "deleted").map((workspace) => workspace.id),
    );
    await Promise.all(
      resource.workspaceRefs
        .filter((workspaceId) => availableWorkspaceIds.has(workspaceId))
        .map((workspaceId) => registry.resolve("workspaceService").addResourceReference(workspaceId, resource.id)),
    );
  });

  eventBus.subscribe("workspace:activated", async ({ workspaceId }) => {
    await registry.resolve("continuityService").setActiveWorkspace(workspaceId);
  });

  eventBus.subscribe("workspace:closed", async ({ workspaceId }) => {
    await registry.resolve("continuityService").preserveWorkspaceSession(workspaceId);
  });

  eventBus.subscribe("ProfileOpened", async ({ profile, profileId }) => {
    const continuity = registry.resolve("continuityService");
    const previousSession = await continuity.getCurrentSession();
    await continuity.setActiveProfile(profileId);

    const workspaces = (await registry.resolve("workspaceService").listWorkspaces()).filter(
      (workspace) =>
        workspace.profileId === profileId &&
        workspace.lifecycleState !== "archived" &&
        workspace.lifecycleState !== "deleted",
    );
    const recentWorkspaceId = Object.values(previousSession.workspaceSessions ?? {})
      .filter(
        (session) =>
          session.profileId === profileId && workspaces.some((workspace) => workspace.id === session.workspaceId),
      )
      .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))[0]?.workspaceId;
    const workspace =
      workspaces.find((candidate) => candidate.id === recentWorkspaceId) ??
      workspaces.find((candidate) => candidate.id === profile.defaultSpaceId) ??
      [...workspaces].sort((left, right) =>
        (right.lastOpenedAt ?? right.updatedAt).localeCompare(left.lastOpenedAt ?? left.updatedAt),
      )[0];
    if (workspace) {
      await registry.resolve("workspaceService").activateWorkspace(workspace.id);
    }
  });

  eventBus.subscribe("ProfileViewed", async ({ profileId }) => {
    await registry.resolve("continuityService").setActiveProfile(profileId);
  });

  eventBus.subscribe("WorkspaceArchived", async ({ workspace }) => {
    await registry.resolve("continuityService").preserveWorkspaceSession(workspace.id);
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

  eventBus.subscribe(
    "ApplicationLaunched",
    async ({ applicationId, workspaceId, profileId, resourceIds, workingDirectory, launchArguments }) => {
      const session = await registry.resolve("continuityService").getCurrentSession();
      await registry.resolve("continuityService").captureResumeContext({
        profileId: profileId ?? session.activeProfileId,
        workspaceId: workspaceId ?? session.activeWorkspaceId,
        resourceIds,
        applicationIds: [applicationId],
        workingDirectory,
        launchArguments,
      });
    },
  );
}

async function seedSearchIndex(registry: ServiceRegistry): Promise<void> {
  const [resources, events, activities, commands, notifications, profiles, workspaces, applications, settings] =
    await Promise.all([
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
      .filter((resource) => resource.lifecycleState === "active" && !isCalendarEventResource(resource))
      .map(createResourceDocument),
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
    ...profiles
      .filter((profile) => profile.lifecycleState !== "deleted" && profile.lifecycleState !== "archived")
      .map(createUniversalProfileDocument),
    ...workspaces
      .filter((workspace) => workspace.lifecycleState !== "deleted" && workspace.lifecycleState !== "archived")
      .map(createWorkspaceDocument),
    ...applications
      .filter(
        (application) =>
          !application.hidden &&
          application.lifecycleState === "available" &&
          application.metadata.platform !== "karya",
      )
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

  await registry.resolve("searchService").rebuild(documents);
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

function readStringAttribute(
  resource: { metadata: { attributes?: Record<string, string | number | boolean | null> } },
  key: string,
): string | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "string" ? value : undefined;
}

function isCalendarEventResource(resource: { type: string; metadata: { kind: string } }): boolean {
  return resource.metadata.kind === "calendar-event" || resource.type === "application/vnd.karya.calendar-event";
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
