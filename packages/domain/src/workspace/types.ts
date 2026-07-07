import type { Color, Identifier, Timestamp, DomainEvent } from "../common";

export type WorkspaceId = Identifier;
export type ResourceId = Identifier;
export type ApplicationId = Identifier;
export type ProfileId = Identifier;
export type OwnerId = Identifier;
export type UserId = Identifier;
export type WorkspaceLifecycle = "draft" | "open" | "closed" | "archived" | "deleted";
export type WorkspaceState = WorkspaceLifecycle;

export interface WorkspaceReference {
  id: WorkspaceId;
  name: string;
}

export interface WorkspaceLayout {
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  activeSurface: "home" | "workspace" | "search";
  panelVisibility: Record<string, boolean>;
}

export interface WorkspaceMetadata {
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: UserId;
  updatedBy?: UserId;
  color?: Color;
  icon?: string;
  summary?: string;
  templateId?: Identifier;
}

export interface WorkspaceSession {
  id: Identifier;
  workspaceId: WorkspaceId;
  openedAt: Timestamp;
  lastActiveAt: Timestamp;
  closedAt?: Timestamp;
  activeResourceIds: ResourceId[];
  layout: WorkspaceLayout;
}

export type WorkspaceLaunchResourceBehavior = "open" | "reveal" | "skip" | "open-pinned" | "open-background";
export type WorkspaceLaunchApplicationBehavior = "launch" | "launch-minimized" | "reuse-existing" | "new-instance" | "skip-if-running";

export interface WorkspaceLaunchApplicationItem {
  id: Identifier;
  kind: "application";
  applicationId: ApplicationId;
  behavior: WorkspaceLaunchApplicationBehavior;
  delayMs?: number;
}

export interface WorkspaceLaunchResourceItem {
  id: Identifier;
  kind: "resource";
  resourceId: ResourceId;
  behavior: WorkspaceLaunchResourceBehavior;
  applicationId?: ApplicationId;
  delayMs?: number;
}

export type WorkspaceLaunchSetItem = WorkspaceLaunchApplicationItem | WorkspaceLaunchResourceItem;

export interface WorkspaceLaunchSet {
  enabled: boolean;
  items: WorkspaceLaunchSetItem[];
  focusItemId?: Identifier;
  restoreInspector: boolean;
  updatedAt: Timestamp;
}

export interface WorkspacePermissions {
  ownerCanEdit: boolean;
  sharedWith: UserId[];
}

export interface WorkspaceContext {
  profileId: ProfileId;
  activeResourceIds: ResourceId[];
  pinnedApplicationIds: ApplicationId[];
}

export interface WorkspaceProps {
  id: WorkspaceId;
  name: string;
  metadata: WorkspaceMetadata;
  profileId: ProfileId;
  owner: OwnerId;
  resourceRefs: ResourceId[];
  pinnedApplicationIds: ApplicationId[];
  launchSet?: WorkspaceLaunchSet;
  activeSession?: WorkspaceSession;
  preservedSession?: WorkspaceSession;
  lifecycle: WorkspaceLifecycle;
  state: WorkspaceLifecycle;
  pinned: boolean;
  favorite: boolean;
  permissions: WorkspacePermissions;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  restoredAt?: Timestamp;
  archivedAt?: Timestamp;
  deletedAt?: Timestamp;
  lastOpenedAt?: Timestamp;
  lastClosedAt?: Timestamp;
}

export type WorkspaceDomainEvent =
  | DomainEvent<"WorkspaceCreated", { workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspaceOpened", { workspaceId: WorkspaceId; sessionId: Identifier }>
  | DomainEvent<"WorkspaceClosed", { workspaceId: WorkspaceId; sessionId?: Identifier }>
  | DomainEvent<"WorkspaceRenamed", { workspaceId: WorkspaceId; name: string }>
  | DomainEvent<"WorkspaceArchived", { workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspaceRestored", { workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspaceDeleted", { workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspacePinned", { workspaceId: WorkspaceId; pinned: boolean }>
  | DomainEvent<"WorkspaceFavorited", { workspaceId: WorkspaceId; favorite: boolean }>
  | DomainEvent<"WorkspaceResourceReferenceAdded", { workspaceId: WorkspaceId; resourceId: ResourceId }>
  | DomainEvent<"WorkspaceResourceReferenceRemoved", { workspaceId: WorkspaceId; resourceId: ResourceId }>
  | DomainEvent<"WorkspaceLayoutUpdated", { workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspaceLaunchSetUpdated", { workspaceId: WorkspaceId }>
  | DomainEvent<"WorkspaceApplicationPinned", { workspaceId: WorkspaceId; applicationId: ApplicationId }>
  | DomainEvent<"WorkspaceApplicationUnpinned", { workspaceId: WorkspaceId; applicationId: ApplicationId }>;

export interface CreateWorkspaceRequest {
  id: string;
  name: string;
  profileId: string;
  owner: string;
  description?: string;
  templateId?: string;
  createdBy?: string;
  occurredAt: string;
  layout?: Partial<WorkspaceLayout>;
}
