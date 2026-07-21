import { createContext, type PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type {
  ApplicationStateBoundary,
  AuthenticationStateBoundary,
  ContextStateBoundary,
  SynchronizationStateBoundary,
} from "../state/contracts";
import { MobileCoreLifecycle } from "../lifecycle/MobileCoreLifecycle";

export const ApplicationStateContext = createContext<ApplicationStateBoundary | undefined>(undefined);
export const AuthenticationStateContext = createContext<AuthenticationStateBoundary | undefined>(undefined);
export const ContextStateContext = createContext<ContextStateBoundary | undefined>(undefined);
export const SynchronizationStateContext = createContext<SynchronizationStateBoundary | undefined>(undefined);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <MobileCoreLifecycle>{children}</MobileCoreLifecycle>
    </SafeAreaProvider>
  );
}
