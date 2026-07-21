import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createNotificationStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    content: { padding: spacing[5], paddingBottom: spacing[12] },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[5] },
    title: { ...typography.title, color: palette.contentPrimary },
    action: { ...typography.label, color: palette.accent },
    card: {
      padding: spacing[4],
      borderRadius: radius.medium,
      borderWidth: 1,
      borderColor: palette.borderSubtle,
      backgroundColor: palette.raised,
      marginBottom: spacing[3],
    },
    row: { flexDirection: "row", alignItems: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent, marginRight: spacing[2] },
    cardTitle: { ...typography.bodyEmphasis, color: palette.contentPrimary, flex: 1 },
    description: { ...typography.body, color: palette.contentSecondary, marginTop: spacing[2] },
    timestamp: { ...typography.caption, color: palette.contentTertiary, marginTop: spacing[2] },
    dismiss: { ...typography.label, color: palette.danger, marginTop: spacing[3] },
    empty: { ...typography.body, color: palette.contentSecondary, marginTop: spacing[8] },
    error: { ...typography.label, color: palette.danger, marginBottom: spacing[4] },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.canvas },
  });
}
