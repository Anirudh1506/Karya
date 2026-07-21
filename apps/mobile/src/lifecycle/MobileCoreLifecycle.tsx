import { AppState, type AppStateStatus } from "react-native";
import { createContext, type PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { createMobileCompositionRoot, type MobileCompositionRoot } from "../composition/mobile-composition-root";

export interface MobileCoreLifecycleValue {
  root: MobileCompositionRoot;
  status: "starting" | "ready" | "failed";
  error?: Error;
}

export const MobileCompositionRootContext = createContext<MobileCoreLifecycleValue | undefined>(undefined);

export function MobileCoreLifecycle({ children }: PropsWithChildren) {
  const [compositionRoot] = useState(createMobileCompositionRoot);
  const [status, setStatus] = useState<MobileCoreLifecycleValue["status"]>("starting");
  const [error, setError] = useState<Error>();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let disposed = false;

    const applyState = async (nextState: AppStateStatus) => {
      if (disposed) return;
      const previousState = appState.current;
      appState.current = nextState;
      if (previousState === nextState) return;

      if (nextState === "active") {
        if (compositionRoot.getState() === "created") await compositionRoot.start();
        else if (compositionRoot.getState() === "suspended") await compositionRoot.resume();
        return;
      }

      // iOS reports `inactive` for short-lived system interruptions such as
      // Control Center, permission prompts, and the development menu. Treating
      // those as a full suspension causes avoidable stop/start cycles.
      if (nextState === "background") {
        await compositionRoot.suspend();
      }
    };

    void compositionRoot
      .start()
      .then(() => {
        if (!disposed) setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause : new Error("Karya Core failed to start"));
          setStatus("failed");
        }
      });
    const subscription = AppState.addEventListener("change", (nextState) => {
      void applyState(nextState).catch(() => undefined);
    });

    return () => {
      disposed = true;
      subscription.remove();
      // React development mode and Fast Refresh intentionally mount, clean up,
      // and remount effects. Shutting down the process-owned composition root
      // here leaves the remount holding a permanently stopped instance.
      // AppState owns suspend/resume; the operating system owns process exit.
    };
  }, [compositionRoot]);

  const value = useMemo(() => ({ root: compositionRoot, status, error }), [compositionRoot, error, status]);

  return <MobileCompositionRootContext.Provider value={value}>{children}</MobileCompositionRootContext.Provider>;
}
