import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createActivityTimelineStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    content: { padding: spacing[5], paddingBottom: spacing[12] },
    eyebrow: { ...typography.caption, color: palette.contentTertiary, letterSpacing: 1.4 },
    title: { ...typography.title, color: palette.contentPrimary, marginTop: spacing[1] },
    subtitle: { ...typography.body, color: palette.contentSecondary, marginTop: spacing[2], marginBottom: spacing[6] },
    card: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      padding: spacing[4],
      borderRadius: radius.medium,
      borderWidth: 1,
      borderColor: palette.borderSubtle,
      backgroundColor: palette.raised,
      marginBottom: spacing[3],
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radius.medium,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.sunken,
      marginRight: spacing[3],
    },
    iconText: { ...typography.bodyEmphasis, color: palette.accent },
    body: { flex: 1 },
    summary: { ...typography.bodyEmphasis, color: palette.contentPrimary },
    context: { ...typography.caption, color: palette.contentSecondary, marginTop: spacing[1] },
    timestamp: { ...typography.caption, color: palette.contentTertiary, marginTop: spacing[1] },
    arrow: { ...typography.body, color: palette.contentTertiary, marginLeft: spacing[2] },
    empty: { ...typography.body, color: palette.contentSecondary, marginTop: spacing[8] },
    error: { ...typography.label, color: palette.danger, marginBottom: spacing[4] },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.canvas },
  });
}
