import { useContext } from "react";
import type { Resource, Workspace } from "@karya/types";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";

const emptyResources: Resource[] = [];
const emptyWorkspaces: Workspace[] = [];

export function useResources() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);
  const profile = snapshot?.profiles.active;
  const workspace = snapshot?.workspaces.active;
  const resources = workspace
    ? (snapshot?.resources.all.filter((resource) => resource.workspaceRefs.includes(workspace.id)) ?? emptyResources)
    : emptyResources;
  const workspaces = profile
    ? (snapshot?.workspaces.all.filter(
        (candidate) =>
          candidate.profileId === profile.id &&
          candidate.lifecycleState !== "archived" &&
          candidate.lifecycleState !== "deleted",
      ) ?? emptyWorkspaces)
    : emptyWorkspaces;

  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    profile,
    workspace,
    workspaces,
    active: resources.filter((resource) => resource.lifecycleState === "active"),
    archived: resources.filter((resource) => resource.lifecycleState === "archived"),
  };
}
