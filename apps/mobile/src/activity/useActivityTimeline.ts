import { useContext } from "react";
import type { KaryaActivity } from "@karya/types";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";

const emptyActivities: KaryaActivity[] = [];

export function useActivityTimeline() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);
  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    activities: snapshot?.activity.items ?? emptyActivities,
    profiles: snapshot?.profiles.all ?? [],
    workspaces: snapshot?.workspaces.all ?? [],
  };
}
