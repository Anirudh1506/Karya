import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { NativeModules, useColorScheme } from "react-native";
import { AppProviders } from "./providers/AppProviders";
import { RootNavigation } from "./navigation/RootNavigation";
import { getNavigationTheme } from "./theme/navigation-theme";

export function App() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const theme = getNavigationTheme(scheme);

  useEffect(() => {
    if (!__DEV__) return;

    // React Native 0.83 can leave its native Fast Refresh banner visible after
    // the bundle has finished applying. Clear only that completed development
    // overlay; this does not disable Fast Refresh or affect release builds.
    const devLoadingView = NativeModules.DevLoadingView as { hide?: () => void } | undefined;
    const frame = requestAnimationFrame(() => devLoadingView?.hide?.());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <AppProviders>
      <RootNavigation theme={theme} />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </AppProviders>
  );
}
