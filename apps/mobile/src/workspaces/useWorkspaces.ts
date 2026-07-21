import { useContext } from "react";
import type { Workspace } from "@karya/types";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";

const emptyWorkspaces: Workspace[] = [];

export function useWorkspaces() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);
  const profileId = snapshot?.profiles.active?.id;
  const owned = snapshot?.workspaces.all.filter((workspace) => workspace.profileId === profileId) ?? emptyWorkspaces;

  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    profile: snapshot?.profiles.active,
    active: snapshot?.workspaces.active?.profileId === profileId ? snapshot?.workspaces.active : undefined,
    workspaces: owned.filter(
      (workspace) => workspace.lifecycleState !== "archived" && workspace.lifecycleState !== "deleted",
    ),
    archived: owned.filter((workspace) => workspace.lifecycleState === "archived"),
  };
}
