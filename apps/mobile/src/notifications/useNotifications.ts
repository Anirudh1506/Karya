import { useContext } from "react";
import { MobileCompositionRootContext } from "../lifecycle/MobileCoreLifecycle";
import { useCoreSnapshot } from "../profiles/useProfiles";

export function useNotifications() {
  const lifecycle = useContext(MobileCompositionRootContext);
  const core = lifecycle?.root.getCore();
  const snapshot = useCoreSnapshot(core);
  const profileId = snapshot?.profiles.active?.id;
  return {
    core,
    status: lifecycle?.status ?? "starting",
    startupError: lifecycle?.error,
    notifications: (snapshot?.notifications.items ?? []).filter(
      (item) => item.profileId === profileId && !["dismissed", "archived", "deleted"].includes(item.status),
    ),
  };
}
