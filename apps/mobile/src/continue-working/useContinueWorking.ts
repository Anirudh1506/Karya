import { useContext } from "react";
import type { ContinueWorkingItem } from "@karya/types";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";

const emptyItems: ContinueWorkingItem[] = [];

export function useContinueWorking() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);

  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    items: snapshot?.continuity.continueWorking ?? emptyItems,
  };
}
