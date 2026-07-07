import type { ContinuityWorkspaceSession, EntityId, WorkspaceActivity } from "@karya/types";

export function createWorkspaceSession(workspaceId: EntityId, profileId: EntityId, now: string): ContinuityWorkspaceSession {
  return {
    id: `workspace-session-${workspaceId}`,
    workspaceId,
    profileId,
    startedAt: now,
    lastActiveAt: now,
    activeResourceIds: [],
    recentResourceIds: [],
    launchedApplicationIds: [],
    state: "active",
    lastResumeAt: now,
    resumeCount: 0,
    activityTimeline: [
      createActivity({ workspaceId, profileId, type: "workspace-opened", title: "Opened Workspace", occurredAt: now }),
    ],
  };
}

export function createActivity(input: Omit<WorkspaceActivity, "id">): WorkspaceActivity {
  return {
    id: `activity-${input.workspaceId}-${input.occurredAt}-${input.type}-${input.resourceId ?? input.applicationId ?? "workspace"}`,
    ...input,
  };
}

export function hasRecentEquivalentActivity(timeline: WorkspaceActivity[], activity: WorkspaceActivity): boolean {
  const duplicateWindowMs = 2_000;
  const subject = activity.resourceId ?? activity.applicationId ?? activity.workspaceId;
  const occurredAt = new Date(activity.occurredAt).getTime();

  return timeline.some((candidate) => {
    const candidateSubject = candidate.resourceId ?? candidate.applicationId ?? candidate.workspaceId;
    if (candidate.type !== activity.type || candidateSubject !== subject) return false;
    return Math.abs(new Date(candidate.occurredAt).getTime() - occurredAt) <= duplicateWindowMs;
  });
}
