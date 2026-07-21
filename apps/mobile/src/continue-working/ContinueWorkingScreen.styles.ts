import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createContinueWorkingStyles(scheme: KaryaColorScheme) {
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
    content: { paddingHorizontal: spacing[5], paddingTop: spacing[16], paddingBottom: spacing[12] },
    eyebrow: { ...typography.caption, color: palette.contentTertiary, letterSpacing: 1.4 },
    title: { ...typography.display, color: palette.contentPrimary, marginTop: spacing[1] },
    intro: { ...typography.body, color: palette.contentSecondary, marginTop: spacing[2], marginBottom: spacing[8] },
    list: {
      backgroundColor: palette.raised,
      borderRadius: radius.large,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.borderSubtle,
      overflow: "hidden",
    },
    card: {
      minHeight: 88,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      marginLeft: spacing[4],
      paddingVertical: spacing[3],
      paddingRight: spacing[4],
    },
    cardBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSubtle },
    icon: {
      width: 44,
      height: 44,
      borderRadius: radius.medium,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accentSubtle,
    },
    iconText: { ...typography.heading, color: palette.accent },
    cardBody: { flex: 1 },
    name: { ...typography.bodyEmphasis, color: palette.contentPrimary },
    meta: { ...typography.caption, color: palette.contentSecondary, marginTop: spacing[1] },
    activity: { ...typography.caption, color: palette.contentTertiary, marginTop: 2 },
    error: { ...typography.label, color: palette.danger, marginVertical: spacing[3] },
    empty: { ...typography.body, color: palette.contentSecondary, paddingVertical: spacing[8], textAlign: "center" },
  });
}
