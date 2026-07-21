import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createSyncStatusStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing[6],
      backgroundColor: palette.canvas,
    },
    content: { padding: spacing[5], paddingBottom: spacing[12] },
    eyebrow: { ...typography.caption, color: palette.contentTertiary, letterSpacing: 1.2 },
    title: { ...typography.display, color: palette.contentPrimary, marginTop: spacing[1] },
    body: { ...typography.body, color: palette.contentSecondary, marginTop: spacing[2], marginBottom: spacing[6] },
    card: {
      backgroundColor: palette.raised,
      borderRadius: radius.large,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.borderSubtle,
      overflow: "hidden",
    },
    row: {
      minHeight: 60,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.borderSubtle,
    },
    lastRow: { borderBottomWidth: 0 },
    label: { ...typography.caption, color: palette.contentTertiary },
    value: { ...typography.bodyEmphasis, color: palette.contentPrimary, marginTop: spacing[1] },
    device: { fontFamily: "Menlo", ...typography.caption },
    error: { ...typography.label, color: palette.danger },
  });
}
