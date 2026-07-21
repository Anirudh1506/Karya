import type { ContinuitySession, SearchResult } from "@karya/types";

export function rankSearchResultsByActivity(results: SearchResult[], session: ContinuitySession): SearchResult[] {
  const resourceRanks = new Map(session.recentResourceIds.map((resourceId, index) => [resourceId, 30 - index]));
  const applicationRanks = new Map(
    (session.recentApplicationIds ?? []).map((applicationId, index) => [applicationId, 20 - index]),
  );
  const workspaceRanks = new Map(
    Object.values(session.workspaceSessions ?? {})
      .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
      .map((workspaceSession, index) => [workspaceSession.workspaceId, 25 - index]),
  );

  return [...results].sort((left, right) => {
    const leftBoost = activityBoost(left, resourceRanks, workspaceRanks, applicationRanks);
    const rightBoost = activityBoost(right, resourceRanks, workspaceRanks, applicationRanks);
    return right.score + rightBoost - (left.score + leftBoost);
  });
}

export function activityBoost(
  result: SearchResult,
  resourceRanks: Map<string, number>,
  workspaceRanks: Map<string, number>,
  applicationRanks: Map<string, number>,
): number {
  const sourceId = result.document.sourceId;
  if (result.document.type === "resource") return resourceRanks.get(sourceId) ?? 0;
  if (result.document.type === "workspace") return workspaceRanks.get(sourceId) ?? 0;
  if (result.document.type === "application") return applicationRanks.get(sourceId) ?? 0;
  return 0;
}
