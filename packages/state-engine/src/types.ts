import type {
  ContinueWorkingItem,
  ContinuitySession,
  EntityId,
  CalendarEvent,
  KaryaActivity,
  InstalledApplication,
  KaryaNotification,
  Profile,
  Resource,
  SearchDocument,
  SearchResult,
  SettingDefinition,
  Workspace,
  WorkspaceActivity,
  WorkspaceNavigationContext,
  ContinuityWorkspaceSession,
} from "@karya/types";

export interface UserState {
  id: EntityId;
  name: string;
}

export interface ProfileState {
  all: Profile[];
  active?: Profile;
  recent: Profile[];
  favorite: Profile[];
  archived: Profile[];
  defaultProfile?: Profile;
  defaultSpaceIds: EntityId[];
  statisticsById: Record<EntityId, ProfileStatistics>;
  workspaceIdsByProfile: Record<EntityId, EntityId[]>;
}

export interface ProfileStatistics {
  totalResources: number;
  activeResources: number;
  archivedResources: number;
  workspaceCount: number;
  recentActivity?: string;
  lastActive?: string;
  storageUsed: number;
  applicationsUsed: number;
  importCount: number;
}

export interface WorkspaceState {
  all: Workspace[];
  active?: Workspace;
  open: Workspace[];
  recent: Workspace[];
  archived: Workspace[];
  pinned: Workspace[];
  status: Record<EntityId, Workspace["lifecycleState"]>;
  openCount: number;
  archivedCount: number;
  pinnedCount: number;
  totalCount: number;
  resourceCountByWorkspace: Record<EntityId, number>;
  resourceIdsByWorkspace: Record<EntityId, EntityId[]>;
}

export interface ResourceState {
  all: Resource[];
  active?: Resource;
  selectedId?: EntityId;
  recent: Resource[];
  recentModifiedByWorkspace: Record<EntityId, Resource[]>;
  topLevel: Resource[];
  folders: Resource[];
  childrenByFolder: Record<EntityId, Resource[]>;
  childCountByFolder: Record<EntityId, number>;
  indexedCountByFolder: Record<EntityId, number>;
  folderHealthById: Record<EntityId, string>;
  activeResources: Resource[];
  archivedResources: Resource[];
  deletedResources: Resource[];
  metadataById: Record<EntityId, Resource["metadata"]>;
  activeCount: number;
  archivedCount: number;
  deletedCount: number;
  totalCount: number;
}

export interface EventState {
  all: CalendarEvent[];
  activeEvents: CalendarEvent[];
  archivedEvents: CalendarEvent[];
  deletedEvents: CalendarEvent[];
  metadataById: Record<EntityId, CalendarEvent["metadata"]>;
  activeCount: number;
  archivedCount: number;
  deletedCount: number;
  totalCount: number;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  filters: string[];
  recentQueries: string[];
  suggestedCommands: SearchDocument[];
  suggestions: string[];
}

export interface ApplicationState {
  installed: InstalledApplication[];
  pinned: InstalledApplication[];
  favorite: InstalledApplication[];
  hidden: InstalledApplication[];
  recent: InstalledApplication[];
  frequent: InstalledApplication[];
  categories: Record<string, InstalledApplication[]>;
  running: InstalledApplication[];
  preferredByWorkspace: Record<EntityId, EntityId[]>;
  workspaceAssociations: Record<EntityId, EntityId[]>;
  launchHistory: Array<{ applicationId: EntityId; workspaceId?: EntityId; profileId?: EntityId; launchedAt: string }>;
}

export interface ContinuityState {
  continueWorking: ContinueWorkingItem[];
  currentSession?: ContinuitySession;
  activeWorkspaceSession?: ContinuityWorkspaceSession;
  resumeContext?: ContinuitySession["resumeContext"];
  recentSessions: ContinuitySession[];
  continueWorkingByWorkspace: Record<EntityId, { resourceIds: EntityId[]; applicationIds: EntityId[] }>;
  activityByWorkspace: Record<EntityId, WorkspaceActivity[]>;
  workspaceInsightsByWorkspace: Record<EntityId, WorkspaceInsights>;
  lastWorkspace?: Workspace;
  resumeQueue: EntityId[];
  interruptedSession?: ContinuitySession["interruptedSession"];
  lastNavigationContext?: WorkspaceNavigationContext;
  lastSelectedResourceId?: EntityId;
}

export interface WorkspaceInsights {
  applications: Array<{ applicationId: EntityId; name: string; launchCount: number; lastOpenedAt: string }>;
  resources: {
    opened: number;
    edited: number;
    created: number;
    renamed: number;
    archived: number;
    moved: number;
    referenced: number;
    viewed: number;
    resumed: number;
  };
  imports: {
    folders: number;
    files: number;
    mostRecentTitle?: string;
    mostRecentAt?: string;
  };
  session: {
    resumeCount: number;
    lastActiveAt?: string;
    currentSessionStartedAt?: string;
  };
  lastActivity?: {
    title: string;
    type: WorkspaceActivity["type"];
    occurredAt: string;
  };
  groupedByType: Record<string, number>;
}

export interface NotificationState {
  items: KaryaNotification[];
  unread: KaryaNotification[];
  archived: KaryaNotification[];
  byWorkspace: Record<EntityId, KaryaNotification[]>;
  byProfile: Record<EntityId, KaryaNotification[]>;
  grouped: Array<{ key: string; items: KaryaNotification[]; count: number; latest: KaryaNotification }>;
  unreadCount: number;
  attentionCount: number;
}

export interface ActivityState {
  items: KaryaActivity[];
  recent: KaryaActivity[];
  today: KaryaActivity[];
  byWorkspace: Record<EntityId, KaryaActivity[]>;
  byProfile: Record<EntityId, KaryaActivity[]>;
  byObject: Record<string, KaryaActivity[]>;
  grouped: Array<{ key: string; items: KaryaActivity[]; count: number; latest: KaryaActivity }>;
}

export interface SettingsState {
  all: SettingDefinition[];
  active?: SettingDefinition;
  byId: Record<EntityId, SettingDefinition>;
}

export interface ShellState {
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  panelVisibility: Record<string, boolean>;
  activeSurface:
    | { type: "home" }
    | { type: "folder"; resourceId: EntityId }
    | { type: "profile"; profileId: EntityId }
    | { type: "workspace"; workspaceId: EntityId };
  breadcrumbs: Array<{
    id: EntityId;
    label: string;
    profileId?: EntityId;
    resourceId?: EntityId;
    workspaceId?: EntityId;
  }>;
  activeDialog?: string;
  systemStatus: "initializing" | "ready" | "degraded";
}

export interface KernelSnapshot {
  user: UserState;
  profiles: ProfileState;
  workspaces: WorkspaceState;
  resources: ResourceState;
  events: EventState;
  search: SearchState;
  applications: ApplicationState;
  continuity: ContinuityState;
  activity: ActivityState;
  notifications: NotificationState;
  settings: SettingsState;
  shell: ShellState;
}

export interface StateEngineHydration {
  applications: InstalledApplication[];
  profiles: Profile[];
  resources: Resource[];
  events: CalendarEvent[];
  activities: KaryaActivity[];
  commands: SearchDocument[];
  notifications: KaryaNotification[];
  session: ContinuitySession;
  settings: SettingDefinition[];
  user: UserState;
  workspaces: Workspace[];
}

export interface StateEngine {
  hydrate(input: StateEngineHydration): void;
  getSnapshot(): KernelSnapshot;
  subscribe(listener: (snapshot: KernelSnapshot) => void): () => void;
  start(): () => void;
  setSearch(query: string, results: SearchResult[]): void;
  selectResource(resourceId?: EntityId): void;
}
