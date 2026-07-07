import type { EntityId, ISODateString } from "./common";

export interface ResumeContext {
  profileId: EntityId;
  workspaceId?: EntityId;
  resourceIds: EntityId[];
  applicationIds?: EntityId[];
  workingDirectory?: string;
  launchArguments?: string[];
  capturedAt: ISODateString;
}

export interface ResumeHistoryEntry extends ResumeContext {
  id: EntityId;
}

export interface LayoutState {
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  activeSurface: "home" | "workspace" | "search";
}

export type WorkspaceNavigationSurface = "workspace" | "folder";

export interface WorkspaceNavigationContext {
  surface: WorkspaceNavigationSurface;
  workspaceId: EntityId;
  folderId?: EntityId;
  selectedResourceId?: EntityId;
  breadcrumbs?: Array<{ id: EntityId; label: string; profileId?: EntityId; resourceId?: EntityId; workspaceId?: EntityId }>;
  scrollTop?: number;
  capturedAt: ISODateString;
}

export type WorkspaceActivityType =
  | "workspace-opened"
  | "workspace-resumed"
  | "resource-created"
  | "resource-opened"
  | "resource-edited"
  | "resource-resumed"
  | "resource-viewed"
  | "resource-imported"
  | "folder-imported"
  | "resource-renamed"
  | "resource-moved"
  | "resource-archived"
  | "resource-referenced"
  | "application-launched";

export interface WorkspaceActivity {
  id: EntityId;
  workspaceId: EntityId;
  profileId: EntityId;
  type: WorkspaceActivityType;
  resourceId?: EntityId;
  applicationId?: EntityId;
  title: string;
  occurredAt: ISODateString;
}

export interface ContinuityWorkspaceSession {
  id: EntityId;
  workspaceId: EntityId;
  profileId: EntityId;
  startedAt: ISODateString;
  lastActiveAt: ISODateString;
  activeResourceIds: EntityId[];
  recentResourceIds: EntityId[];
  launchedApplicationIds: EntityId[];
  state: "active" | "preserved";
  lastResumeAt?: ISODateString;
  resumeCount: number;
  lastNavigationContext?: WorkspaceNavigationContext;
  lastSelectedResourceId?: EntityId;
  activityTimeline: WorkspaceActivity[];
}

export interface ContinuitySession {
  id: EntityId;
  activeProfileId: EntityId;
  activeWorkspaceId?: EntityId;
  recentResourceIds: EntityId[];
  recentApplicationIds?: EntityId[];
  workspaceSessions?: Record<EntityId, ContinuityWorkspaceSession>;
  interruptedSession?: {
    workspaceId: EntityId;
    profileId: EntityId;
    capturedAt: ISODateString;
  };
  resumeContext?: ResumeContext;
  resumeHistory?: ResumeHistoryEntry[];
  layout: LayoutState;
  startedAt: ISODateString;
  updatedAt: ISODateString;
}
