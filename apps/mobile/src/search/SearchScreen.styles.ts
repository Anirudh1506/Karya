import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createSearchStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.canvas },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      paddingTop: spacing[12],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.borderSubtle,
    },
    close: { minHeight: 44, justifyContent: "center" },
    closeText: { ...typography.label, color: palette.accent },
    input: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: spacing[4],
      backgroundColor: palette.sunken,
      borderRadius: radius.full,
      color: palette.contentPrimary,
      ...typography.body,
    },
    clearQuery: { minHeight: 44, justifyContent: "center" },
    clearQueryText: { ...typography.label, color: palette.accent },
    content: { padding: spacing[5], paddingBottom: spacing[12] },
    section: { marginBottom: spacing[6] },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing[2],
    },
    sectionTitle: { ...typography.label, color: palette.contentSecondary, marginBottom: spacing[2] },
    clearText: { ...typography.label, color: palette.accent },
    group: {
      backgroundColor: palette.raised,
      borderRadius: radius.large,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.borderSubtle,
      overflow: "hidden",
    },
    row: { minHeight: 68, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4] },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.borderSubtle },
    resultBody: { flex: 1 },
    resultTitle: { ...typography.bodyEmphasis, color: palette.contentPrimary },
    highlight: { color: palette.accent },
    subtitle: { ...typography.caption, color: palette.contentSecondary, marginTop: 2 },
    arrow: { ...typography.heading, color: palette.contentTertiary },
    empty: { alignItems: "center", paddingVertical: spacing[16], paddingHorizontal: spacing[5] },
    emptyTitle: { ...typography.heading, color: palette.contentPrimary },
    emptyBody: { ...typography.body, color: palette.contentSecondary, textAlign: "center", marginTop: spacing[2] },
    loader: { marginTop: spacing[12] },
    error: { ...typography.label, color: palette.danger, marginBottom: spacing[4] },
  });
}
