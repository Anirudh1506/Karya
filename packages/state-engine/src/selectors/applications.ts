import type { ContinuitySession, EntityId, InstalledApplication, Workspace } from "@karya/types";
import type { ApplicationState } from "../types";

export function deriveApplications(
  applications: InstalledApplication[],
  runningApplications: InstalledApplication[] = [],
  workspaces: Workspace[] = [],
  session?: ContinuitySession,
): ApplicationState {
  const visible = applications.filter((application) =>
    application.lifecycleState === "available"
    && application.metadata.platform !== "karya"
    && !application.hidden,
  );
  const runningIds = new Set(runningApplications.map((application) => application.metadata.id));

  return {
    installed: visible,
    pinned: visible.filter((application) => application.pinned),
    favorite: visible.filter((application) => application.favorite),
    hidden: applications.filter((application) => application.hidden),
    recent: [...visible]
      .filter((application) => application.lastLaunchedAt)
      .sort((left, right) => (right.lastLaunchedAt ?? "").localeCompare(left.lastLaunchedAt ?? ""))
      .slice(0, 8),
    frequent: [...visible]
      .filter((application) => application.launchCount > 0)
      .sort((left, right) => right.launchCount - left.launchCount)
      .slice(0, 8),
    categories: visible.reduce<Record<string, InstalledApplication[]>>((categories, application) => {
      const category = application.metadata.category ?? "other";
      categories[category] = [...(categories[category] ?? []), application];
      return categories;
    }, {}),
    running: visible.filter((application) => runningIds.has(application.metadata.id)),
    preferredByWorkspace: deriveApplicationWorkspaceAssociations(workspaces),
    workspaceAssociations: deriveApplicationWorkspaceAssociations(workspaces),
    launchHistory: Object.values(session?.workspaceSessions ?? {}).flatMap((workspaceSession) =>
      workspaceSession.activityTimeline
        .filter((activity) => activity.type === "application-launched" && activity.applicationId)
        .map((activity) => ({
          applicationId: activity.applicationId as string,
          workspaceId: activity.workspaceId,
          profileId: activity.profileId,
          launchedAt: activity.occurredAt,
        })),
    ),
  };
}

function deriveApplicationWorkspaceAssociations(workspaces: Workspace[]): Record<EntityId, EntityId[]> {
  return Object.fromEntries(
    workspaces
      .filter((workspace) => workspace.lifecycleState !== "deleted")
      .map((workspace) => [workspace.id, workspace.pinnedApplicationIds]),
  );
}
