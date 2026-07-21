import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createCreateWorkspaceStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    content: { padding: spacing[5], gap: spacing[2] },
    label: { ...typography.label, color: palette.contentPrimary, marginTop: spacing[4] },
    optional: { color: palette.contentTertiary, fontWeight: "400" },
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
    multiline: { minHeight: 88, paddingTop: spacing[3], textAlignVertical: "top" },
    swatches: { flexDirection: "row", gap: spacing[3], paddingVertical: spacing[2] },
    swatchOuter: {
      width: 44,
      height: 44,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    swatchSelected: { borderColor: palette.contentPrimary },
    swatch: { width: 30, height: 30, borderRadius: radius.full },
    error: { ...typography.label, color: palette.danger, marginTop: spacing[3] },
    createButton: {
      minHeight: 52,
      marginTop: spacing[6],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.medium,
      backgroundColor: palette.accent,
    },
    createText: { ...typography.bodyEmphasis, color: scheme === "dark" ? palette.sunken : palette.raised },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
  });
}
