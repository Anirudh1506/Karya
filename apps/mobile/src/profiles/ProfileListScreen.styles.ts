import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createProfileListStyles(scheme: KaryaColorScheme) {
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
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[4] },
    eyebrow: { ...typography.caption, color: palette.contentTertiary, letterSpacing: 1.4 },
    title: { ...typography.display, color: palette.contentPrimary },
    intro: {
      ...typography.body,
      color: palette.contentSecondary,
      marginTop: spacing[2],
      marginBottom: spacing[8],
      maxWidth: 420,
    },
    addButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing[4],
      backgroundColor: palette.accent,
      borderRadius: radius.full,
    },
    addButtonText: { ...typography.label, color: scheme === "dark" ? palette.sunken : palette.raised },
    sectionTitle: {
      ...typography.label,
      color: palette.contentSecondary,
      marginBottom: spacing[2],
      marginTop: spacing[6],
    },
    group: {
      backgroundColor: palette.raised,
      borderRadius: radius.large,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.borderSubtle,
      overflow: "hidden",
    },
    row: { minHeight: 72, flexDirection: "row", alignItems: "center", marginLeft: spacing[4] },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSubtle },
    rowMain: { flex: 1, minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing[3] },
    avatar: { width: 40, height: 40, borderRadius: radius.medium, alignItems: "center", justifyContent: "center" },
    avatarText: { ...typography.heading, color: "#FFFFFF" },
    rowText: { flex: 1 },
    name: { ...typography.bodyEmphasis, color: palette.contentPrimary },
    meta: { ...typography.caption, color: palette.contentSecondary, marginTop: 1 },
    secondaryAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[4] },
    secondaryActionText: { ...typography.label, color: palette.danger },
    error: { ...typography.label, color: palette.danger, marginVertical: spacing[3] },
  });
}
