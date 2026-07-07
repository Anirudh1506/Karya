import type { EntityId, ISODateString } from "./common";

export interface WorkspaceReference {
  id: EntityId;
  name: string;
}

export type WorkspaceLifecycleState = "draft" | "open" | "closed" | "archived" | "deleted";

export interface WorkspaceMetadata {
  name: string;
  description?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy?: EntityId;
  updatedBy?: EntityId;
  color?: string;
  icon?: string;
  summary?: string;
  templateId?: EntityId;
}

export interface WorkspaceLayoutState {
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  activeSurface: "home" | "workspace" | "search";
  panelVisibility: Record<string, boolean>;
}

export interface WorkspaceSession {
  id: EntityId;
  workspaceId: EntityId;
  openedAt: ISODateString;
  lastActiveAt: ISODateString;
  closedAt?: ISODateString;
  activeResourceIds: EntityId[];
  layout: WorkspaceLayoutState;
}

export type WorkspaceLaunchItemKind = "application" | "resource";
export type WorkspaceLaunchResourceBehavior = "open" | "reveal" | "skip" | "open-pinned" | "open-background";
export type WorkspaceLaunchApplicationBehavior = "launch" | "launch-minimized" | "reuse-existing" | "new-instance" | "skip-if-running";

export interface WorkspaceLaunchApplicationItem {
  id: EntityId;
  kind: "application";
  applicationId: EntityId;
  behavior: WorkspaceLaunchApplicationBehavior;
  delayMs?: number;
}

export interface WorkspaceLaunchResourceItem {
  id: EntityId;
  kind: "resource";
  resourceId: EntityId;
  behavior: WorkspaceLaunchResourceBehavior;
  applicationId?: EntityId;
  delayMs?: number;
}

export type WorkspaceLaunchSetItem = WorkspaceLaunchApplicationItem | WorkspaceLaunchResourceItem;

export interface WorkspaceLaunchSet {
  enabled: boolean;
  items: WorkspaceLaunchSetItem[];
  focusItemId?: EntityId;
  restoreInspector: boolean;
  updatedAt: ISODateString;
}

export interface WorkspacePermissions {
  ownerCanEdit: boolean;
  sharedWith: EntityId[];
}

export interface Workspace {
  id: EntityId;
  name: string;
  metadata: WorkspaceMetadata;
  profileId: EntityId;
  owner: EntityId;
  resourceRefs: EntityId[];
  pinnedApplicationIds: EntityId[];
  launchSet?: WorkspaceLaunchSet;
  activeSession?: WorkspaceSession;
  preservedSession?: WorkspaceSession;
  lifecycleState: WorkspaceLifecycleState;
  pinned: boolean;
  favorite: boolean;
  archivedAt?: ISODateString;
  deletedAt?: ISODateString;
  restoredAt?: ISODateString;
  lastOpenedAt?: ISODateString;
  lastClosedAt?: ISODateString;
  permissions?: WorkspacePermissions;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
