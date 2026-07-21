import { Identifier, Label, Timestamp } from "../common";
import type {
  WorkspaceId,
  WorkspaceLaunchSet,
  WorkspaceLayout,
  WorkspaceProps,
  WorkspaceSession,
  WorkspaceSettings,
} from "./types";

export function normalizeProps(props: WorkspaceProps): WorkspaceProps {
  return {
    ...props,
    name: Label.from(props.name).value,
    metadata: {
      ...props.metadata,
      name: Label.from(props.metadata.name).value,
    },
    resourceRefs: uniqueByValue(props.resourceRefs),
    pinnedApplicationIds: uniqueByValue(props.pinnedApplicationIds),
    launchSet: props.launchSet ? cloneLaunchSet(props.launchSet) : undefined,
    settings: props.settings ? cloneWorkspaceSettings(props.settings) : undefined,
    activeSession: props.activeSession ? cloneSession(props.activeSession) : undefined,
    preservedSession: props.preservedSession ? cloneSession(props.preservedSession) : undefined,
    permissions: {
      ownerCanEdit: props.permissions.ownerCanEdit,
      sharedWith: uniqueByValue(props.permissions.sharedWith),
    },
  };
}

export function createSession(
  workspaceId: WorkspaceId,
  occurredAt: Timestamp,
  layout?: Partial<WorkspaceLayout>,
): WorkspaceSession {
  return {
    id: Identifier.from(`workspace-session-${workspaceId.value}-${occurredAt.value}`, "WorkspaceSessionId"),
    workspaceId,
    openedAt: occurredAt,
    lastActiveAt: occurredAt,
    activeResourceIds: [],
    layout: createWorkspaceLayout(layout),
  };
}

export function createWorkspaceLayout(layout: Partial<WorkspaceLayout> = {}): WorkspaceLayout {
  return {
    sidebarCollapsed: layout.sidebarCollapsed ?? false,
    inspectorOpen: layout.inspectorOpen ?? true,
    activeSurface: layout.activeSurface ?? "workspace",
    panelVisibility: {
      sidebar: !(layout.sidebarCollapsed ?? false),
      inspector: layout.inspectorOpen ?? true,
      ...(layout.panelVisibility ?? {}),
    },
  };
}

export function cloneLaunchSet(launchSet: WorkspaceLaunchSet): WorkspaceLaunchSet {
  return {
    ...launchSet,
    items: launchSet.items.map((item) => ({ ...item })),
  };
}

export function cloneWorkspaceSettings(settings: WorkspaceSettings): WorkspaceSettings {
  return {
    appearance: { ...settings.appearance },
    experience: { ...settings.experience },
    continuity: { ...settings.continuity },
    preferences: { ...settings.preferences },
  };
}

export function cloneSession(session: WorkspaceSession): WorkspaceSession {
  return {
    ...session,
    activeResourceIds: [...session.activeResourceIds],
    layout: {
      ...session.layout,
      panelVisibility: { ...session.layout.panelVisibility },
    },
  };
}

export function uniqueByValue<TItem extends { value: string }>(items: TItem[]): TItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}
