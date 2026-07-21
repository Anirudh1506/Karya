import { colors, radius, spacing, typography, type KaryaColorScheme } from "@karya/design-tokens";
import { StyleSheet } from "react-native";

export function createCreateResourceStyles(scheme: KaryaColorScheme) {
  const palette = colors[scheme];
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.canvas },
    content: { padding: spacing[5] },
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
    error: { ...typography.label, color: palette.danger, marginTop: spacing[3] },
    button: {
      minHeight: 52,
      marginTop: spacing[6],
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.medium,
      backgroundColor: palette.accent,
    },
    buttonText: { ...typography.bodyEmphasis, color: scheme === "dark" ? palette.sunken : palette.raised },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
  });
}
