const light = {
  canvas: "#F7F7F5",
  raised: "#FFFFFF",
  sunken: "#EFEFED",
  contentPrimary: "#18181B",
  contentSecondary: "#5C5C62",
  contentTertiary: "#797980",
  borderSubtle: "#DEDEDA",
  accent: "#2563EB",
  accentSubtle: "#E8EFFD",
  success: "#16834A",
  warning: "#A45F06",
  danger: "#C33131",
  info: "#2563EB",
} as const;

const dark = {
  canvas: "#111113",
  raised: "#1A1A1D",
  sunken: "#0C0C0E",
  contentPrimary: "#F4F4F5",
  contentSecondary: "#B5B5BA",
  contentTertiary: "#929298",
  borderSubtle: "#303034",
  accent: "#6B9CFF",
  accentSubtle: "#1D2B49",
  success: "#51B879",
  warning: "#E4A84B",
  danger: "#F07474",
  info: "#76A4FF",
} as const;

export const colors = { light, dark } as const;
export type KaryaColorScheme = keyof typeof colors;
