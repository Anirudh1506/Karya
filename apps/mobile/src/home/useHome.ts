import { useContext } from "react";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";
import { selectHomeState } from "./home-state";

export function useHome() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);

  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    ...selectHomeState(snapshot),
  };
}
