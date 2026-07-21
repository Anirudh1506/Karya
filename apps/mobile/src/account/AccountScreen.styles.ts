import { StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "@karya/design-tokens";
import type { KaryaColorScheme } from "@karya/design-tokens";

export function createAccountStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    content: { padding: spacing[5], gap: spacing[5], paddingBottom: spacing[10] },
    label: { ...typography.caption, color: palette.contentTertiary, letterSpacing: 1 },
    title: { ...typography.display, color: palette.contentPrimary },
    id: { ...typography.caption, color: palette.contentSecondary },
    card: {
      backgroundColor: palette.raised,
      borderColor: palette.borderSubtle,
      borderWidth: 1,
      borderRadius: radius.large,
      padding: spacing[4],
      gap: spacing[3],
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: palette.borderSubtle,
      borderRadius: radius.medium,
      color: palette.contentPrimary,
      paddingHorizontal: spacing[3],
    },
    button: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.medium,
      backgroundColor: palette.accent,
    },
    buttonText: { color: palette.raised, fontWeight: "600" },
    deviceName: { ...typography.bodyEmphasis, color: palette.contentPrimary },
    detail: { ...typography.body, color: palette.contentSecondary },
    error: { ...typography.label, color: palette.danger },
  });
}
