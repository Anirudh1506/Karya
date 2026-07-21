import {
  Color,
  Identifier,
  Timestamp,
  Workspace as WorkspaceAggregate,
  type WorkspaceLaunchSet as DomainWorkspaceLaunchSet,
  type WorkspaceProps,
} from "@karya/domain";
import type { Workspace, WorkspaceLaunchSet } from "@karya/types";

export function toDomain(workspace: Workspace): WorkspaceAggregate {
  const createdAt = Timestamp.from(workspace.createdAt);
  const updatedAt = Timestamp.from(workspace.updatedAt);
  const metadata = workspace.metadata ?? {
    name: workspace.name,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };

  return WorkspaceAggregate.rehydrate({
    id: Identifier.from(workspace.id, "WorkspaceId"),
    name: workspace.name,
    metadata: {
      name: metadata.name,
      description: metadata.description,
      createdAt: Timestamp.from(metadata.createdAt),
      updatedAt: Timestamp.from(metadata.updatedAt),
      createdBy: metadata.createdBy ? Identifier.from(metadata.createdBy, "UserId") : undefined,
      updatedBy: metadata.updatedBy ? Identifier.from(metadata.updatedBy, "UserId") : undefined,
      color: metadata.color ? Color.from(metadata.color) : undefined,
      icon: metadata.icon,
      summary: metadata.summary,
      templateId: metadata.templateId ? Identifier.from(metadata.templateId, "WorkspaceTemplateId") : undefined,
    },
    profileId: Identifier.from(workspace.profileId, "ProfileId"),
    owner: Identifier.from(workspace.owner ?? workspace.profileId, "OwnerId"),
    resourceRefs: workspace.resourceRefs.map((id) => Identifier.from(id, "ResourceId")),
    pinnedApplicationIds: workspace.pinnedApplicationIds.map((id) => Identifier.from(id, "ApplicationId")),
    launchSet: workspace.launchSet ? toDomainLaunchSet(workspace.launchSet) : undefined,
    settings: workspace.settings ? toDomainSettings(workspace.settings) : undefined,
    activeSession: workspace.activeSession ? toDomainSession(workspace.activeSession) : undefined,
    preservedSession: workspace.preservedSession ? toDomainSession(workspace.preservedSession) : undefined,
    lifecycle: workspace.lifecycleState ?? "open",
    state: workspace.lifecycleState ?? "open",
    pinned: workspace.pinned ?? false,
    favorite: workspace.favorite ?? false,
    permissions: {
      ownerCanEdit: workspace.permissions?.ownerCanEdit ?? true,
      sharedWith: (workspace.permissions?.sharedWith ?? []).map((id) => Identifier.from(id, "UserId")),
    },
    createdAt,
    updatedAt,
    restoredAt: workspace.restoredAt ? Timestamp.from(workspace.restoredAt) : undefined,
    archivedAt: workspace.archivedAt ? Timestamp.from(workspace.archivedAt) : undefined,
    deletedAt: workspace.deletedAt ? Timestamp.from(workspace.deletedAt) : undefined,
    lastOpenedAt: workspace.lastOpenedAt ? Timestamp.from(workspace.lastOpenedAt) : undefined,
    lastClosedAt: workspace.lastClosedAt ? Timestamp.from(workspace.lastClosedAt) : undefined,
  });
}

export function toDto(workspace: WorkspaceAggregate): Workspace {
  const snapshot: WorkspaceProps = workspace.toSnapshot();
  return {
    id: snapshot.id.value,
    name: snapshot.name,
    metadata: {
      name: snapshot.metadata.name,
      description: snapshot.metadata.description,
      createdAt: snapshot.metadata.createdAt.value,
      updatedAt: snapshot.metadata.updatedAt.value,
      createdBy: snapshot.metadata.createdBy?.value,
      updatedBy: snapshot.metadata.updatedBy?.value,
      color: snapshot.metadata.color?.value,
      icon: snapshot.metadata.icon,
      summary: snapshot.metadata.summary,
      templateId: snapshot.metadata.templateId?.value,
    },
    profileId: snapshot.profileId.value,
    owner: snapshot.owner.value,
    resourceRefs: snapshot.resourceRefs.map((id) => id.value),
    pinnedApplicationIds: snapshot.pinnedApplicationIds.map((id) => id.value),
    launchSet: snapshot.launchSet ? toDtoLaunchSet(snapshot.launchSet) : undefined,
    settings: snapshot.settings ? toDtoSettings(snapshot.settings) : undefined,
    activeSession: snapshot.activeSession ? toDtoSession(snapshot.activeSession) : undefined,
    preservedSession: snapshot.preservedSession ? toDtoSession(snapshot.preservedSession) : undefined,
    lifecycleState: snapshot.lifecycle,
    pinned: snapshot.pinned,
    favorite: snapshot.favorite,
    permissions: {
      ownerCanEdit: snapshot.permissions.ownerCanEdit,
      sharedWith: snapshot.permissions.sharedWith.map((id) => id.value),
    },
    restoredAt: snapshot.restoredAt?.value,
    archivedAt: snapshot.archivedAt?.value,
    deletedAt: snapshot.deletedAt?.value,
    lastOpenedAt: snapshot.lastOpenedAt?.value,
    lastClosedAt: snapshot.lastClosedAt?.value,
    createdAt: snapshot.createdAt.value,
    updatedAt: snapshot.updatedAt.value,
  };
}

export function toDomainLaunchSet(launchSet: WorkspaceLaunchSet): DomainWorkspaceLaunchSet {
  return {
    enabled: launchSet.enabled,
    items: launchSet.items.map((item) =>
      item.kind === "application"
        ? {
            id: Identifier.from(item.id, "WorkspaceLaunchItemId"),
            enabled: item.enabled,
            kind: "application" as const,
            applicationId: Identifier.from(item.applicationId, "ApplicationId"),
            behavior: item.behavior,
            delayMs: item.delayMs,
          }
        : {
            id: Identifier.from(item.id, "WorkspaceLaunchItemId"),
            enabled: item.enabled,
            kind: "resource" as const,
            resourceId: Identifier.from(item.resourceId, "ResourceId"),
            behavior: item.behavior,
            applicationId: item.applicationId ? Identifier.from(item.applicationId, "ApplicationId") : undefined,
            delayMs: item.delayMs,
          },
    ),
    focusItemId: launchSet.focusItemId ? Identifier.from(launchSet.focusItemId, "WorkspaceLaunchItemId") : undefined,
    restoreInspector: launchSet.restoreInspector,
    executionMode: launchSet.executionMode,
    failureHandling: launchSet.failureHandling,
    restoreBehavior: launchSet.restoreBehavior,
    notifyWhenReady: launchSet.notifyWhenReady,
    updatedAt: Timestamp.from(launchSet.updatedAt),
  };
}

export function toDtoLaunchSet(launchSet: DomainWorkspaceLaunchSet): WorkspaceLaunchSet {
  return {
    enabled: launchSet.enabled,
    items: launchSet.items.map((item) =>
      item.kind === "application"
        ? {
            id: item.id.value,
            enabled: item.enabled,
            kind: "application" as const,
            applicationId: item.applicationId.value,
            behavior: item.behavior,
            delayMs: item.delayMs,
          }
        : {
            id: item.id.value,
            enabled: item.enabled,
            kind: "resource" as const,
            resourceId: item.resourceId.value,
            behavior: item.behavior,
            applicationId: item.applicationId?.value,
            delayMs: item.delayMs,
          },
    ),
    focusItemId: launchSet.focusItemId?.value,
    restoreInspector: launchSet.restoreInspector,
    executionMode: launchSet.executionMode,
    failureHandling: launchSet.failureHandling,
    restoreBehavior: launchSet.restoreBehavior,
    notifyWhenReady: launchSet.notifyWhenReady,
    updatedAt: launchSet.updatedAt.value,
  };
}

function toDomainSettings(settings: NonNullable<Workspace["settings"]>): NonNullable<WorkspaceProps["settings"]> {
  return {
    appearance: { ...settings.appearance },
    experience: { ...settings.experience },
    continuity: { ...settings.continuity },
    preferences: { ...settings.preferences },
  };
}

function toDtoSettings(settings: NonNullable<WorkspaceProps["settings"]>): NonNullable<Workspace["settings"]> {
  return {
    appearance: { ...settings.appearance },
    experience: { ...settings.experience },
    continuity: { ...settings.continuity },
    preferences: { ...settings.preferences },
  };
}

function toDomainSession(session: Workspace["activeSession"]): WorkspaceProps["activeSession"] {
  if (!session) return undefined;
  return {
    id: Identifier.from(session.id, "WorkspaceSessionId"),
    workspaceId: Identifier.from(session.workspaceId, "WorkspaceId"),
    openedAt: Timestamp.from(session.openedAt),
    lastActiveAt: Timestamp.from(session.lastActiveAt),
    closedAt: session.closedAt ? Timestamp.from(session.closedAt) : undefined,
    activeResourceIds: session.activeResourceIds.map((id) => Identifier.from(id, "ResourceId")),
    layout: session.layout,
  };
}

function toDtoSession(session: NonNullable<WorkspaceProps["activeSession"]>): NonNullable<Workspace["activeSession"]> {
  return {
    id: session.id.value,
    workspaceId: session.workspaceId.value,
    openedAt: session.openedAt.value,
    lastActiveAt: session.lastActiveAt.value,
    closedAt: session.closedAt?.value,
    activeResourceIds: session.activeResourceIds.map((id) => id.value),
    layout: session.layout,
  };
}
