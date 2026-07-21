import { useContext } from "react";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";

export function useUniversalSearch() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);
  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    results: snapshot?.search.results ?? [],
    resultQuery: snapshot?.search.query ?? "",
    recentSearches: snapshot?.continuity.currentSession?.recentSearches ?? [],
  };
}
