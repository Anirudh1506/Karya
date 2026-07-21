import type {
  ContinuitySession,
  ContinuityWorkspaceSession,
  EntityId,
  Profile,
  Workspace,
  WorkspaceActivity,
} from "@karya/types";
import type { KernelSnapshot, WorkspaceInsights } from "../types";

const DESKTOP_HOME_DEFAULT_SPACE_ID = "workspace-desktop-home-default-space";

export function createFolderParentBreadcrumbs(
  workspace: Workspace,
  profile?: Profile,
): KernelSnapshot["shell"]["breadcrumbs"] {
  if (workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID) {
    return [
      { id: "surface:home", label: "Home" },
      { id: `workspace:${workspace.id}`, label: displayWorkspaceName(workspace), workspaceId: workspace.id },
    ];
  }

  return [
    profile
      ? { id: `profile:${profile.id}`, label: profile.name, profileId: profile.id }
      : { id: "surface:home", label: "Home" },
    { id: `workspace:${workspace.id}`, label: displayWorkspaceName(workspace), workspaceId: workspace.id },
  ];
}

export function deriveContinueWorkingByWorkspace(
  session: ContinuitySession,
): KernelSnapshot["continuity"]["continueWorkingByWorkspace"] {
  return Object.fromEntries(
    Object.entries(session.workspaceSessions ?? {}).map(([workspaceId, workspaceSession]) => [
      workspaceId,
      {
        resourceIds: workspaceSession.recentResourceIds,
        applicationIds: workspaceSession.launchedApplicationIds,
      },
    ]),
  );
}

export function deriveContinuityState(
  session: ContinuitySession,
  workspaces: Workspace[],
): Omit<KernelSnapshot["continuity"], "recentSessions"> {
  const activeWorkspaceSession = session.activeWorkspaceId
    ? session.workspaceSessions?.[session.activeWorkspaceId]
    : undefined;
  const lastWorkspaceId = Object.values(session.workspaceSessions ?? {}).sort((left, right) =>
    right.lastActiveAt.localeCompare(left.lastActiveAt),
  )[0]?.workspaceId;

  return {
    continueWorking: [],
    currentSession: session,
    activeWorkspaceSession,
    resumeContext: session.resumeContext,
    continueWorkingByWorkspace: deriveContinueWorkingByWorkspace(session),
    activityByWorkspace: deriveActivityByWorkspace(session),
    workspaceInsightsByWorkspace: deriveWorkspaceInsightsByWorkspace(session),
    lastWorkspace: lastWorkspaceId ? workspaces.find((workspace) => workspace.id === lastWorkspaceId) : undefined,
    resumeQueue: Object.values(session.workspaceSessions ?? {})
      .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
      .map((workspaceSession) => workspaceSession.workspaceId),
    interruptedSession: session.interruptedSession,
    lastNavigationContext: activeWorkspaceSession?.lastNavigationContext,
    lastSelectedResourceId: activeWorkspaceSession?.lastSelectedResourceId,
  };
}

export function deriveActivityByWorkspace(
  session: ContinuitySession,
): KernelSnapshot["continuity"]["activityByWorkspace"] {
  return Object.fromEntries(
    Object.entries(session.workspaceSessions ?? {}).map(([workspaceId, workspaceSession]) => [
      workspaceId,
      workspaceSession.activityTimeline,
    ]),
  );
}

export function deriveWorkspaceInsightsByWorkspace(
  session: ContinuitySession,
): KernelSnapshot["continuity"]["workspaceInsightsByWorkspace"] {
  return Object.fromEntries(
    Object.entries(session.workspaceSessions ?? {}).map(([workspaceId, workspaceSession]) => [
      workspaceId,
      deriveWorkspaceInsights(workspaceSession),
    ]),
  );
}

export function deriveWorkspaceInsights(workspaceSession: ContinuityWorkspaceSession): WorkspaceInsights {
  const applicationMap = new Map<
    EntityId,
    { applicationId: EntityId; name: string; launchCount: number; lastOpenedAt: string }
  >();
  const resources: WorkspaceInsights["resources"] = {
    opened: 0,
    edited: 0,
    created: 0,
    renamed: 0,
    archived: 0,
    moved: 0,
    referenced: 0,
    viewed: 0,
    resumed: 0,
  };
  const imports: WorkspaceInsights["imports"] = {
    folders: 0,
    files: 0,
  };
  const groupedByType: Record<string, number> = {};
  const sortedActivities = dedupeInsightActivities(
    [...workspaceSession.activityTimeline].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
  );

  for (const activity of sortedActivities) {
    groupedByType[activity.type] = (groupedByType[activity.type] ?? 0) + 1;
    if (activity.type === "application-launched" && activity.applicationId) {
      const existing = applicationMap.get(activity.applicationId);
      applicationMap.set(activity.applicationId, {
        applicationId: activity.applicationId,
        name: activity.title,
        launchCount: (existing?.launchCount ?? 0) + 1,
        lastOpenedAt:
          existing?.lastOpenedAt && existing.lastOpenedAt > activity.occurredAt
            ? existing.lastOpenedAt
            : activity.occurredAt,
      });
      continue;
    }

    incrementResourceInsight(resources, activity);
    if (activity.type === "resource-imported" || activity.type === "folder-imported") {
      if (activity.type === "folder-imported") imports.folders += 1;
      if (activity.type === "resource-imported") imports.files += 1;
      if (!imports.mostRecentAt || activity.occurredAt > imports.mostRecentAt) {
        imports.mostRecentAt = activity.occurredAt;
        imports.mostRecentTitle = activity.title;
      }
    }
  }

  return {
    applications: [...applicationMap.values()]
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
      .slice(0, 5),
    resources,
    imports,
    session: {
      resumeCount: workspaceSession.resumeCount,
      lastActiveAt: workspaceSession.lastActiveAt,
      currentSessionStartedAt: workspaceSession.startedAt,
    },
    lastActivity: toMeaningfulActivity(sortedActivities[0]),
    groupedByType,
  };
}

export function dedupeInsightActivities(activities: WorkspaceActivity[]): WorkspaceActivity[] {
  const duplicateWindowMs = 2_000;
  const accepted: WorkspaceActivity[] = [];

  for (const activity of activities) {
    const subject = activity.resourceId ?? activity.applicationId ?? activity.workspaceId;
    const occurredAt = new Date(activity.occurredAt).getTime();
    const duplicate = accepted.some((candidate) => {
      const candidateSubject = candidate.resourceId ?? candidate.applicationId ?? candidate.workspaceId;
      if (candidate.type !== activity.type || candidateSubject !== subject) return false;
      return Math.abs(new Date(candidate.occurredAt).getTime() - occurredAt) <= duplicateWindowMs;
    });

    if (!duplicate) {
      accepted.push(activity);
    }
  }

  return accepted;
}

export function incrementResourceInsight(resources: WorkspaceInsights["resources"], activity: WorkspaceActivity): void {
  if (activity.type === "resource-created") resources.created += 1;
  if (activity.type === "resource-opened") resources.opened += 1;
  if (activity.type === "resource-edited") resources.edited += 1;
  if (activity.type === "resource-renamed") resources.renamed += 1;
  if (activity.type === "resource-moved") resources.moved += 1;
  if (activity.type === "resource-archived") resources.archived += 1;
  if (activity.type === "resource-referenced") resources.referenced += 1;
  if (activity.type === "resource-viewed") resources.viewed += 1;
  if (activity.type === "resource-resumed") resources.resumed += 1;
}

export function toMeaningfulActivity(activity: WorkspaceActivity | undefined): WorkspaceInsights["lastActivity"] {
  if (!activity) return undefined;
  return {
    title: activity.title,
    type: activity.type,
    occurredAt: activity.occurredAt,
  };
}

export function restoreShellFromSession(
  snapshot: KernelSnapshot,
  session: ContinuitySession,
): KernelSnapshot["shell"] | undefined {
  const workspaceId = session.activeWorkspaceId;
  if (!workspaceId) return undefined;
  const workspaceSession = session.workspaceSessions?.[workspaceId];
  const navigation = workspaceSession?.lastNavigationContext;
  const workspace = snapshot.workspaces.all.find((candidate) => candidate.id === workspaceId);
  if (!workspace) return undefined;
  const profile = snapshot.profiles.all.find((candidate) => candidate.id === workspace.profileId);
  const baseShell = {
    ...snapshot.shell,
    sidebarCollapsed: session.layout.sidebarCollapsed,
    inspectorOpen: session.layout.inspectorOpen,
    panelVisibility: {
      ...snapshot.shell.panelVisibility,
      inspector: session.layout.inspectorOpen,
      sidebar: !session.layout.sidebarCollapsed,
    },
  };

  if (navigation?.surface === "folder" && navigation.folderId) {
    const folder = snapshot.resources.all.find((resource) => resource.id === navigation.folderId);
    if (folder) {
      return {
        ...baseShell,
        activeSurface: { type: "folder", resourceId: folder.id },
        breadcrumbs: navigation.breadcrumbs ?? [
          ...createFolderParentBreadcrumbs(workspace, profile),
          { id: `folder:${folder.id}`, label: folder.metadata.title, resourceId: folder.id },
        ],
      };
    }
  }

  return {
    ...baseShell,
    activeSurface: { type: "workspace", workspaceId },
    breadcrumbs: [
      { id: "surface:home", label: "Home" },
      { id: `workspace:${workspace.id}`, label: displayWorkspaceName(workspace), workspaceId: workspace.id },
    ],
  };
}

export function displayWorkspaceName(workspace: Workspace): string {
  return workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID ? "Default Space" : workspace.name;
}
