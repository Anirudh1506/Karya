import { useContext, useSyncExternalStore } from "react";
import type { KaryaCore, KernelSnapshot } from "@karya/core";
import type { Profile } from "@karya/types";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";

const emptyProfiles: Profile[] = [];

export function useProfiles() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);

  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    active: snapshot?.profiles.active,
    profiles:
      snapshot?.profiles.all.filter((profile) => (profile.lifecycleState ?? "active") === "active") ?? emptyProfiles,
    archived: snapshot?.profiles.archived ?? emptyProfiles,
  };
}

export function useCoreSnapshot(core: KaryaCore | undefined): KernelSnapshot | undefined {
  return useSyncExternalStore(
    (listener) => core?.shell.subscribe(() => listener()) ?? (() => undefined),
    () => core?.shell.getSnapshotSync(),
    () => undefined,
  );
}
