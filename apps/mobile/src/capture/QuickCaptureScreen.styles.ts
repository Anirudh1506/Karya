import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createQuickCaptureStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    content: { flex: 1, padding: spacing[5] },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[8] },
    eyebrow: { ...typography.caption, color: palette.contentTertiary },
    title: { ...typography.title, color: palette.contentPrimary, marginTop: spacing[1] },
    cancel: { minHeight: 44, minWidth: 60, alignItems: "flex-end", justifyContent: "center" },
    cancelText: { ...typography.bodyEmphasis, color: palette.accent },
    context: { ...typography.caption, color: palette.contentSecondary, marginBottom: spacing[4] },
    label: { ...typography.label, color: palette.contentPrimary, marginBottom: spacing[2] },
    input: {
      minHeight: 52,
      paddingHorizontal: spacing[4],
      borderWidth: 1,
      borderColor: palette.borderSubtle,
      borderRadius: radius.medium,
      backgroundColor: palette.raised,
      color: palette.contentPrimary,
      ...typography.body,
    },
    preparing: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[3] },
    preparingText: { ...typography.caption, color: palette.contentSecondary },
    create: {
      minHeight: 52,
      marginTop: spacing[5],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.medium,
      backgroundColor: palette.accent,
    },
    createText: { ...typography.bodyEmphasis, color: scheme === "dark" ? palette.sunken : palette.raised },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
    message: { ...typography.body, color: palette.contentSecondary, lineHeight: 24 },
    error: { ...typography.label, color: palette.danger, marginTop: spacing[3] },
    workspaceAction: {
      minHeight: 48,
      marginTop: spacing[5],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.medium,
      borderWidth: 1,
      borderColor: palette.borderSubtle,
      backgroundColor: palette.raised,
    },
    workspaceActionText: { ...typography.bodyEmphasis, color: palette.contentPrimary },
  });
}
