import type { EventBus } from "@karya/event-bus";
import type {
  CalendarEvent,
  ContinuitySession,
  ContinuityWorkspaceSession,
  EntityId,
  InstalledApplication,
  KaryaActivity,
  KaryaNotification,
  Profile,
  Resource,
  SearchResult,
  Workspace,
  WorkspaceActivity,
} from "@karya/types";
import { freezeSnapshot } from "./immutability";
import {
  collectResourcesByWorkspace,
  countResourcesByWorkspace,
  createEmptySnapshot,
  createSuggestedCommandDocuments,
  deriveActivity,
  deriveApplications,
  deriveEvents,
  deriveNotifications,
  deriveProfiles,
  deriveResources,
  deriveSearchSuggestions,
  deriveWorkspaces,
  searchResources,
  upsertApplication,
  upsertById,
} from "./selectors";
import type { KernelSnapshot, StateEngine, StateEngineHydration } from "./types";
import {
  createFolderParentBreadcrumbs,
  deriveContinuityState,
  displayWorkspaceName,
  restoreShellFromSession,
} from "./derivations/continuity";

export class KaryaStateEngine implements StateEngine {
  private snapshot: KernelSnapshot = freezeSnapshot(createEmptySnapshot());
  private readonly listeners = new Set<(snapshot: KernelSnapshot) => void>();

  constructor(private readonly eventBus: EventBus) {}

  hydrate(input: StateEngineHydration): void {
    const activeProfile =
      input.profiles.find((profile) => profile.id === input.session.activeProfileId) ?? input.profiles[0];
    const visibleWorkspaces = input.workspaces.filter(
      (workspace) => workspace.lifecycleState !== "deleted" && workspace.profileId === activeProfile?.id,
    );
    const activeWorkspace =
      visibleWorkspaces.find((workspace) => workspace.id === input.session.activeWorkspaceId) ??
      visibleWorkspaces.find((workspace) => workspace.lifecycleState === "open") ??
      visibleWorkspaces[0];
    const workspaceResources = activeWorkspace
      ? input.resources.filter(
          (resource) => resource.workspaceRefs.includes(activeWorkspace.id) && resource.lifecycleState !== "deleted",
        )
      : [];
    const persistedSelectedId = activeWorkspace
      ? input.session.workspaceSessions?.[activeWorkspace.id]?.lastSelectedResourceId
      : undefined;
    const selectedId = workspaceResources.some((resource) => resource.id === persistedSelectedId)
      ? persistedSelectedId
      : workspaceResources[0]?.id;
    const openWorkspaces = activeWorkspace ? [activeWorkspace] : [];
    const settingsById = Object.fromEntries(input.settings.map((setting) => [setting.id, setting]));

    this.commit({
      user: input.user,
      profiles: deriveProfiles(input.profiles, input.resources, input.workspaces, activeProfile?.id),
      workspaces: {
        ...deriveWorkspaces(input.workspaces, activeWorkspace?.id),
        active: activeWorkspace,
        open: deriveWorkspaces(input.workspaces, activeWorkspace?.id).open.length
          ? deriveWorkspaces(input.workspaces, activeWorkspace?.id).open
          : openWorkspaces,
        resourceCountByWorkspace: countResourcesByWorkspace(input.resources),
        resourceIdsByWorkspace: collectResourcesByWorkspace(input.resources),
      },
      resources: deriveResources(input.resources, selectedId, input.session.recentResourceIds),
      events: deriveEvents(input.events),
      search: {
        query: "",
        results: [],
        filters: [],
        recentQueries: [],
        suggestedCommands: input.commands.length ? input.commands : createSuggestedCommandDocuments(),
        suggestions: deriveSearchSuggestions(input.resources, input.applications),
      },
      applications: {
        ...deriveApplications(input.applications, [], input.workspaces, input.session),
      },
      continuity: {
        ...deriveContinuityState(input.session, input.workspaces),
        recentSessions: [input.session],
      },
      activity: deriveActivity(input.activities),
      notifications: deriveNotifications(input.notifications),
      settings: {
        all: input.settings,
        byId: settingsById,
      },
      shell: {
        activeSurface: { type: "home" },
        breadcrumbs: [{ id: "surface:home", label: "Home" }],
        sidebarCollapsed: input.session.layout.sidebarCollapsed,
        inspectorOpen: input.session.layout.inspectorOpen,
        panelVisibility: {
          inspector: input.session.layout.inspectorOpen,
          sidebar: !input.session.layout.sidebarCollapsed,
        },
        systemStatus: "ready",
      },
    });
  }

  getSnapshot(): KernelSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: KernelSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): () => void {
    const unsubscribers = [
      this.eventBus.subscribe("ResourceCreated", ({ resource }) => {
        this.applyResourceCreated(resource);
      }),
      this.eventBus.subscribe("ResourceUpdated", ({ resource }) => {
        this.applyResourceUpdated(resource);
      }),
      this.eventBus.subscribe("ResourceMoved", ({ resource }) => {
        this.applyResourceUpdated(resource);
      }),
      this.eventBus.subscribe("ResourceDuplicated", ({ duplicate }) => {
        this.applyResourceCreated(duplicate);
      }),
      this.eventBus.subscribe("ResourceReferenced", ({ resource }) => {
        this.applyResourceUpdated(resource);
      }),
      this.eventBus.subscribe("ResourceUnreferenced", ({ resource }) => {
        this.applyResourceUpdated(resource);
      }),
      this.eventBus.subscribe("ResourceSelected", ({ resourceId }) => {
        this.selectResource(resourceId);
      }),
      this.eventBus.subscribe("CalendarEventCreated", ({ event }) => {
        this.applyCalendarEventUpdated(event);
      }),
      this.eventBus.subscribe("CalendarEventUpdated", ({ event }) => {
        this.applyCalendarEventUpdated(event);
      }),
      this.eventBus.subscribe("CalendarEventArchived", ({ event }) => {
        this.applyCalendarEventUpdated(event);
      }),
      this.eventBus.subscribe("CalendarEventDeleted", ({ event }) => {
        this.applyCalendarEventUpdated(event);
      }),
      this.eventBus.subscribe("NotificationCreated", ({ notification }) => {
        this.applyNotificationUpdated(notification);
      }),
      this.eventBus.subscribe("NotificationUpdated", ({ notification }) => {
        this.applyNotificationUpdated(notification);
      }),
      this.eventBus.subscribe("NotificationDeleted", ({ notification }) => {
        this.applyNotificationUpdated(notification);
      }),
      this.eventBus.subscribe("ActivityRecorded", ({ activity }) => {
        this.applyActivityUpdated(activity);
      }),
      this.eventBus.subscribe("ActivityUpdated", ({ activity }) => {
        this.applyActivityUpdated(activity);
      }),
      this.eventBus.subscribe("FolderSurfaceOpened", ({ folder, workspace }) => {
        this.openFolderSurface(folder, workspace);
      }),
      this.eventBus.subscribe("HomeSurfaceOpened", () => {
        this.openHomeSurface();
      }),
      this.eventBus.subscribe("FolderIndexed", ({ folder }) => {
        this.applyResourceUpdated(folder);
      }),
      this.eventBus.subscribe("FolderUpdated", ({ folder }) => {
        this.applyResourceUpdated(folder);
      }),
      this.eventBus.subscribe("ChildResourceDiscovered", ({ child }) => {
        this.applyResourceCreated(child);
      }),
      this.eventBus.subscribe("SearchCompleted", ({ query, results }) => {
        this.setSearch(query, results);
      }),
      this.eventBus.subscribe("SearchExecuted", ({ query }) => {
        this.commitSearchQuery(query);
      }),
      this.eventBus.subscribe("resource:deleted", ({ resourceId }) => {
        this.applyResourceDeleted(resourceId);
      }),
      this.eventBus.subscribe("WorkspaceCreated", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace, workspace.id);
      }),
      this.eventBus.subscribe("WorkspaceOpened", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace, workspace.id);
      }),
      this.eventBus.subscribe("WorkspaceClosed", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace, undefined);
      }),
      this.eventBus.subscribe("WorkspaceRenamed", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace);
      }),
      this.eventBus.subscribe("WorkspaceArchived", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace, undefined);
      }),
      this.eventBus.subscribe("WorkspaceRestored", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace, workspace.id);
      }),
      this.eventBus.subscribe("WorkspaceDeleted", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace, undefined);
      }),
      this.eventBus.subscribe("WorkspacePinned", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace);
      }),
      this.eventBus.subscribe("WorkspaceApplicationPreferred", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace);
      }),
      this.eventBus.subscribe("WorkspaceApplicationUnpreferred", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace);
      }),
      this.eventBus.subscribe("WorkspaceLaunchSetUpdated", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace);
      }),
      this.eventBus.subscribe("WorkspaceSettingsUpdated", ({ workspace }) => {
        this.applyWorkspaceUpdated(workspace);
      }),
      this.eventBus.subscribe("SessionRestored", ({ session }) => {
        this.applySessionRestored(session);
      }),
      this.eventBus.subscribe("continuity:session-updated", ({ session }) => {
        this.applySessionUpdated(session);
      }),
      this.eventBus.subscribe("ContinueWorkingUpdated", ({ items }) => {
        this.commit({
          ...this.snapshot,
          continuity: { ...this.snapshot.continuity, continueWorking: items },
        });
      }),
      this.eventBus.subscribe("profile:changed", ({ profileId }) => {
        this.applyProfileChanged(profileId);
      }),
      this.eventBus.subscribe("ProfileCreated", ({ profile }) => {
        this.applyProfileUpdated(profile);
      }),
      this.eventBus.subscribe("ProfileOpened", ({ profile }) => {
        this.applyProfileOpened(profile);
      }),
      this.eventBus.subscribe("ProfileViewed", ({ profile }) => {
        this.applyProfileViewed(profile);
      }),
      this.eventBus.subscribe("ProfileUpdated", ({ profile }) => {
        this.applyProfileUpdated(profile);
      }),
      this.eventBus.subscribe("ProfileRenamed", ({ profile }) => {
        this.applyProfileUpdated(profile);
      }),
      this.eventBus.subscribe("ProfileArchived", ({ profile }) => {
        this.applyProfileUpdated(profile);
      }),
      this.eventBus.subscribe("ProfileRestored", ({ profile }) => {
        this.applyProfileUpdated(profile);
      }),
      this.eventBus.subscribe("ProfileDeleted", ({ profile }) => {
        this.applyProfileUpdated(profile);
      }),
      this.eventBus.subscribe("ApplicationOpened", ({ applicationId }) => {
        this.applyApplicationOpened(applicationId);
      }),
      this.eventBus.subscribe("ApplicationDiscovered", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("ApplicationUpdated", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("ApplicationRemoved", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("ApplicationLaunched", ({ application }) => {
        this.applyApplicationLaunched(application);
      }),
      this.eventBus.subscribe("ApplicationPinned", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("ApplicationUnpinned", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("ApplicationFavorited", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("ApplicationHidden", ({ application }) => {
        this.applyApplicationUpdated(application);
      }),
      this.eventBus.subscribe("SettingOpened", ({ settingId }) => {
        this.applySettingOpened(settingId);
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  setSearch(query: string, results: SearchResult[]): void {
    this.commit({
      ...this.snapshot,
      search: {
        ...this.snapshot.search,
        query,
        results,
      },
    });
  }

  commitSearchQuery(query: string): void {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    this.commit({
      ...this.snapshot,
      search: {
        ...this.snapshot.search,
        recentQueries: [
          normalizedQuery,
          ...this.snapshot.search.recentQueries.filter(
            (recentQuery) => recentQuery.toLocaleLowerCase() !== normalizedQuery.toLocaleLowerCase(),
          ),
        ].slice(0, 6),
      },
    });
  }

  selectResource(resourceId?: EntityId): void {
    this.commit({
      ...this.snapshot,
      resources: deriveResources(
        this.snapshot.resources.all,
        resourceId,
        this.snapshot.resources.recent.map((resource) => resource.id),
      ),
    });
  }

  private applyResourceCreated(resource: Resource): void {
    const resources = upsertById(this.snapshot.resources.all, resource);
    const isFolderChild = typeof resource.metadata.attributes?.folderParentId === "string";
    const recentIds = isFolderChild
      ? this.snapshot.resources.recent.map((recent) => recent.id)
      : [resource.id, ...this.snapshot.resources.recent.map((recent) => recent.id).filter((id) => id !== resource.id)];

    this.commit({
      ...this.snapshot,
      resources: deriveResources(
        resources,
        isFolderChild ? this.snapshot.resources.selectedId : resource.id,
        recentIds,
      ),
      profiles: deriveProfiles(
        this.snapshot.profiles.all,
        resources,
        this.snapshot.workspaces.all,
        this.snapshot.profiles.active?.id,
      ),
      workspaces: {
        ...this.snapshot.workspaces,
        resourceCountByWorkspace: countResourcesByWorkspace(resources),
        resourceIdsByWorkspace: collectResourcesByWorkspace(resources),
      },
      search: {
        ...this.snapshot.search,
        results: this.snapshot.search.query
          ? searchResources(resources, this.snapshot.search.query)
          : this.snapshot.search.results,
        suggestions: deriveSearchSuggestions(resources, this.snapshot.applications.installed),
      },
    });
  }

  private applyResourceUpdated(resource: Resource): void {
    const resources = upsertById(this.snapshot.resources.all, resource);
    const activeWorkspaceId = this.snapshot.workspaces.active?.id;
    const selectedResource = resources.find((candidate) => candidate.id === this.snapshot.resources.selectedId);
    const selectedId =
      activeWorkspaceId && selectedResource?.workspaceRefs.includes(activeWorkspaceId)
        ? selectedResource.id
        : undefined;

    this.commit({
      ...this.snapshot,
      resources: deriveResources(
        resources,
        selectedId,
        this.snapshot.resources.recent.map((recent) => recent.id),
      ),
      profiles: deriveProfiles(
        this.snapshot.profiles.all,
        resources,
        this.snapshot.workspaces.all,
        this.snapshot.profiles.active?.id,
      ),
      workspaces: {
        ...this.snapshot.workspaces,
        resourceCountByWorkspace: countResourcesByWorkspace(resources),
        resourceIdsByWorkspace: collectResourcesByWorkspace(resources),
      },
    });
  }

  private applyCalendarEventUpdated(event: CalendarEvent): void {
    const events = upsertById(this.snapshot.events.all, event);

    this.commit({
      ...this.snapshot,
      events: deriveEvents(events),
    });
  }

  private applyNotificationUpdated(notification: KaryaNotification): void {
    const notifications = upsertById(this.snapshot.notifications.items, notification);

    this.commit({
      ...this.snapshot,
      notifications: deriveNotifications(notifications),
    });
  }

  private applyActivityUpdated(activity: KaryaActivity): void {
    const activities = upsertById(this.snapshot.activity.items, activity);

    this.commit({
      ...this.snapshot,
      activity: deriveActivity(activities),
    });
  }

  private applyResourceDeleted(resourceId: EntityId): void {
    const resources = this.snapshot.resources.all.filter((resource) => resource.id !== resourceId);
    const selectedId =
      this.snapshot.resources.selectedId === resourceId ? resources[0]?.id : this.snapshot.resources.selectedId;

    this.commit({
      ...this.snapshot,
      resources: deriveResources(
        resources,
        selectedId,
        this.snapshot.resources.recent.map((recent) => recent.id).filter((id) => id !== resourceId),
      ),
      profiles: deriveProfiles(
        this.snapshot.profiles.all,
        resources,
        this.snapshot.workspaces.all,
        this.snapshot.profiles.active?.id,
      ),
      workspaces: {
        ...this.snapshot.workspaces,
        resourceCountByWorkspace: countResourcesByWorkspace(resources),
        resourceIdsByWorkspace: collectResourcesByWorkspace(resources),
      },
    });
  }

  private applyWorkspaceUpdated(workspace: Workspace, activeWorkspaceId = this.snapshot.workspaces.active?.id): void {
    const workspaces = upsertById(this.snapshot.workspaces.all, workspace);
    const nextActiveId =
      workspace.lifecycleState === "open"
        ? activeWorkspaceId
        : activeWorkspaceId === workspace.id
          ? undefined
          : activeWorkspaceId;

    const activeProfileId =
      workspace.lifecycleState === "open" && activeWorkspaceId === workspace.id
        ? workspace.profileId
        : this.snapshot.profiles.active?.id;

    const nextSnapshot: KernelSnapshot = {
      ...this.snapshot,
      profiles: deriveProfiles(this.snapshot.profiles.all, this.snapshot.resources.all, workspaces, activeProfileId),
      workspaces: {
        ...deriveWorkspaces(workspaces, nextActiveId),
        resourceCountByWorkspace: this.snapshot.workspaces.resourceCountByWorkspace,
        resourceIdsByWorkspace: this.snapshot.workspaces.resourceIdsByWorkspace,
      },
      applications: deriveApplications(
        this.snapshot.applications.installed,
        this.snapshot.applications.running,
        workspaces,
        this.snapshot.continuity.currentSession,
      ),
      search: {
        ...this.snapshot.search,
        suggestions: deriveSearchSuggestions(
          this.snapshot.resources.all,
          this.snapshot.applications.installed,
          workspaces,
        ),
      },
    };

    if (workspace.lifecycleState === "open" && activeWorkspaceId === workspace.id) {
      nextSnapshot.shell = {
        ...nextSnapshot.shell,
        activeSurface: { type: "workspace", workspaceId: workspace.id },
        breadcrumbs: [
          { id: "surface:home", label: "Home" },
          { id: `workspace:${workspace.id}`, label: displayWorkspaceName(workspace) },
        ],
      };
    }

    this.commit(nextSnapshot);
  }

  private applySessionRestored(session: ContinuitySession): void {
    this.applySessionUpdated(session);
  }

  private applySessionUpdated(session: ContinuitySession): void {
    const activeWorkspace = this.snapshot.workspaces.all.find(
      (workspace) => workspace.id === session.activeWorkspaceId,
    );
    const activeProfile = this.snapshot.profiles.all.find((profile) => profile.id === session.activeProfileId);
    const restoredShell =
      this.snapshot.shell.activeSurface.type === "profile"
        ? undefined
        : restoreShellFromSession(this.snapshot, session);

    const workspaceResources = activeWorkspace
      ? this.snapshot.resources.all.filter(
          (resource) => resource.workspaceRefs.includes(activeWorkspace.id) && resource.lifecycleState !== "deleted",
        )
      : [];
    const persistedSelectedId = activeWorkspace
      ? session.workspaceSessions?.[activeWorkspace.id]?.lastSelectedResourceId
      : undefined;
    const selectedResourceId = workspaceResources.some((resource) => resource.id === persistedSelectedId)
      ? persistedSelectedId
      : undefined;

    this.commit({
      ...this.snapshot,
      profiles: deriveProfiles(
        this.snapshot.profiles.all,
        this.snapshot.resources.all,
        this.snapshot.workspaces.all,
        activeProfile?.id ?? this.snapshot.profiles.active?.id,
      ),
      workspaces: {
        ...deriveWorkspaces(this.snapshot.workspaces.all, activeWorkspace?.id ?? this.snapshot.workspaces.active?.id),
        resourceCountByWorkspace: this.snapshot.workspaces.resourceCountByWorkspace,
        resourceIdsByWorkspace: this.snapshot.workspaces.resourceIdsByWorkspace,
      },
      resources: deriveResources(this.snapshot.resources.all, selectedResourceId, session.recentResourceIds),
      applications: deriveApplications(
        this.snapshot.applications.installed,
        this.snapshot.applications.running,
        this.snapshot.workspaces.all,
        session,
      ),
      continuity: {
        ...deriveContinuityState(session, this.snapshot.workspaces.all),
        continueWorking: this.snapshot.continuity.continueWorking,
        recentSessions: upsertById(this.snapshot.continuity.recentSessions, session),
      },
      shell: restoredShell ?? {
        ...this.snapshot.shell,
        sidebarCollapsed: session.layout.sidebarCollapsed,
        inspectorOpen: session.layout.inspectorOpen,
        panelVisibility: {
          ...this.snapshot.shell.panelVisibility,
          inspector: session.layout.inspectorOpen,
          sidebar: !session.layout.sidebarCollapsed,
        },
      },
    });
  }

  private applyProfileChanged(profileId: EntityId): void {
    const profile = this.snapshot.profiles.all.find((item) => item.id === profileId);
    if (!profile) return;

    this.commit({
      ...this.snapshot,
      profiles: deriveProfiles(
        this.snapshot.profiles.all,
        this.snapshot.resources.all,
        this.snapshot.workspaces.all,
        profile.id,
      ),
    });
  }

  private applyProfileUpdated(profile: Profile): void {
    const profiles =
      profile.lifecycleState === "deleted"
        ? this.snapshot.profiles.all.filter((item) => item.id !== profile.id)
        : upsertById(this.snapshot.profiles.all, profile);
    const activeProfileId =
      profile.lifecycleState === "active" && profile.id === this.snapshot.profiles.active?.id
        ? profile.id
        : this.snapshot.profiles.active?.id;
    const nextSnapshot: KernelSnapshot = {
      ...this.snapshot,
      profiles: deriveProfiles(profiles, this.snapshot.resources.all, this.snapshot.workspaces.all, activeProfileId),
      search: {
        ...this.snapshot.search,
        suggestions: deriveSearchSuggestions(
          this.snapshot.resources.all,
          this.snapshot.applications.installed,
          this.snapshot.workspaces.all,
        ),
      },
    };

    if (
      this.snapshot.shell.activeSurface.type === "profile" &&
      this.snapshot.shell.activeSurface.profileId === profile.id
    ) {
      nextSnapshot.shell = {
        ...nextSnapshot.shell,
        activeSurface: profile.lifecycleState === "deleted" ? { type: "home" } : this.snapshot.shell.activeSurface,
        breadcrumbs:
          profile.lifecycleState === "deleted"
            ? [{ id: "surface:home", label: "Home" }]
            : [
                { id: "surface:home", label: "Home" },
                { id: `profile:${profile.id}`, label: profile.name },
              ],
      };
    }

    this.commit(nextSnapshot);
  }

  private applyProfileOpened(profile: Profile): void {
    const profiles = upsertById(this.snapshot.profiles.all, profile);
    this.commit({
      ...this.snapshot,
      profiles: deriveProfiles(profiles, this.snapshot.resources.all, this.snapshot.workspaces.all, profile.id),
      shell: {
        ...this.snapshot.shell,
        activeSurface: { type: "profile", profileId: profile.id },
        breadcrumbs: [
          { id: "surface:home", label: "Home" },
          { id: `profile:${profile.id}`, label: profile.name },
        ],
      },
    });
  }

  private applyProfileViewed(profile: Profile): void {
    const profiles = upsertById(this.snapshot.profiles.all, profile);
    this.commit({
      ...this.snapshot,
      profiles: deriveProfiles(
        profiles,
        this.snapshot.resources.all,
        this.snapshot.workspaces.all,
        this.snapshot.profiles.active?.id,
      ),
      shell: {
        ...this.snapshot.shell,
        activeSurface: { type: "profile", profileId: profile.id },
        breadcrumbs: [
          { id: "surface:home", label: "Home" },
          { id: `profile:${profile.id}`, label: profile.name },
        ],
      },
    });
  }

  private applyApplicationOpened(applicationId: EntityId): void {
    const application = this.snapshot.applications.installed.find((item) => item.metadata.id === applicationId);
    if (!application) return;

    this.commit({
      ...this.snapshot,
      applications: deriveApplications(
        this.snapshot.applications.installed,
        upsertApplication(this.snapshot.applications.running, application),
        this.snapshot.workspaces.all,
        this.snapshot.continuity.currentSession,
      ),
    });
  }

  private applyApplicationLaunched(application: InstalledApplication): void {
    this.commit({
      ...this.snapshot,
      applications: deriveApplications(
        upsertApplication(this.snapshot.applications.installed, application),
        upsertApplication(this.snapshot.applications.running, application),
        this.snapshot.workspaces.all,
        this.snapshot.continuity.currentSession,
      ),
      search: {
        ...this.snapshot.search,
        suggestions: deriveSearchSuggestions(
          this.snapshot.resources.all,
          upsertApplication(this.snapshot.applications.installed, application),
          this.snapshot.workspaces.all,
        ),
      },
    });
  }

  private applyApplicationUpdated(application: InstalledApplication): void {
    const applications = upsertApplication(this.snapshot.applications.installed, application);
    this.commit({
      ...this.snapshot,
      applications: deriveApplications(
        applications,
        this.snapshot.applications.running,
        this.snapshot.workspaces.all,
        this.snapshot.continuity.currentSession,
      ),
      search: {
        ...this.snapshot.search,
        suggestions: deriveSearchSuggestions(this.snapshot.resources.all, applications, this.snapshot.workspaces.all),
      },
    });
  }

  private applySettingOpened(settingId: EntityId): void {
    const setting = this.snapshot.settings.byId[settingId];
    if (!setting) return;

    this.commit({
      ...this.snapshot,
      settings: {
        ...this.snapshot.settings,
        active: setting,
      },
      shell: {
        ...this.snapshot.shell,
        activeDialog: `setting:${settingId}`,
      },
    });
  }

  private openFolderSurface(folder: Resource, containingWorkspace?: Workspace): void {
    const resources = upsertById(this.snapshot.resources.all, folder);
    const workspaceId = containingWorkspace?.id ?? folder.primaryWorkspaceId ?? folder.workspaceRefs[0];
    const workspace =
      containingWorkspace ?? this.snapshot.workspaces.all.find((candidate) => candidate.id === workspaceId);
    const profile = workspace
      ? this.snapshot.profiles.all.find((candidate) => candidate.id === workspace.profileId)
      : undefined;
    const parentBreadcrumbs = workspace
      ? createFolderParentBreadcrumbs(workspace, profile)
      : [{ id: "surface:home", label: "Home" }];
    this.commit({
      ...this.snapshot,
      resources: deriveResources(
        resources,
        folder.id,
        this.snapshot.resources.recent.map((recent) => recent.id),
      ),
      shell: {
        ...this.snapshot.shell,
        activeSurface: { type: "folder", resourceId: folder.id },
        breadcrumbs: [
          ...parentBreadcrumbs,
          { id: `folder:${folder.id}`, label: folder.metadata.title, resourceId: folder.id },
        ],
      },
    });
  }

  private openHomeSurface(): void {
    this.commit({
      ...this.snapshot,
      shell: {
        ...this.snapshot.shell,
        activeSurface: { type: "home" },
        breadcrumbs: [{ id: "surface:home", label: "Home" }],
      },
    });
  }

  private commit(nextSnapshot: KernelSnapshot): void {
    if (nextSnapshot === this.snapshot) return;
    this.snapshot = freezeSnapshot(nextSnapshot);
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
