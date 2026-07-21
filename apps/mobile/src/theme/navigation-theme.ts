import { colors, type KaryaColorScheme } from "@karya/design-tokens";
import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

export function getNavigationTheme(scheme: KaryaColorScheme): Theme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const palette = colors[scheme];

  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.canvas,
      card: palette.raised,
      text: palette.contentPrimary,
      border: palette.borderSubtle,
      notification: palette.danger,
    },
  };
}
