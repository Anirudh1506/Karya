import type { KernelSnapshot } from "@karya/core";
import type { ContinueWorkingItem, Resource } from "@karya/types";

const emptyContinueWorking: ContinueWorkingItem[] = [];
const emptyResources: Resource[] = [];

export function selectHomeState(snapshot: KernelSnapshot | undefined) {
  const workspaceId = snapshot?.workspaces.active?.id;
  return {
    profile: snapshot?.profiles.active,
    workspace: snapshot?.workspaces.active,
    unreadNotificationCount:
      snapshot?.notifications.unread.filter((item) => item.profileId === snapshot?.profiles.active?.id).length ?? 0,
    continueWorking: snapshot?.continuity.continueWorking ?? emptyContinueWorking,
    recentResources: workspaceId
      ? (snapshot?.resources.recentModifiedByWorkspace[workspaceId] ?? emptyResources)
      : emptyResources,
  };
}
