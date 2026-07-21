export type DesktopThemeMode = "light" | "dark" | "system";
export type DesktopAccentColor = "teal" | "graphite" | "blue" | "violet" | "amber";
export type DesktopSidebarWidth = "compact" | "standard" | "wide";

export interface DesktopPreferences {
  appearance: {
    theme: DesktopThemeMode;
    accent: DesktopAccentColor;
    fontScale: number;
    reduceMotion: boolean;
  };
  sidebar: {
    width: DesktopSidebarWidth;
  };
}

const DESKTOP_PREFERENCES_STORAGE_KEY = "karya.desktop.preferences.v1";

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  appearance: {
    theme: "dark",
    accent: "teal",
    fontScale: 1,
    reduceMotion: false,
  },
  sidebar: {
    width: "standard",
  },
};

export function readDesktopPreferences(): DesktopPreferences {
  if (typeof window === "undefined") return DEFAULT_DESKTOP_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(DESKTOP_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_DESKTOP_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<DesktopPreferences>;
    return {
      appearance: {
        ...DEFAULT_DESKTOP_PREFERENCES.appearance,
        ...parsed.appearance,
      },
      sidebar: {
        ...DEFAULT_DESKTOP_PREFERENCES.sidebar,
        ...parsed.sidebar,
      },
    };
  } catch {
    return DEFAULT_DESKTOP_PREFERENCES;
  }
}

function accentTokens(accent: DesktopAccentColor, dark: boolean): { accent: string; ring: string; ringSoft: string } {
  const darkTokens: Record<DesktopAccentColor, { accent: string; ring: string; ringSoft: string }> = {
    graphite: { accent: "#d6d3d1", ring: "rgba(214, 211, 209, 0.56)", ringSoft: "rgba(214, 211, 209, 0.14)" },
    blue: { accent: "#93c5fd", ring: "rgba(147, 197, 253, 0.62)", ringSoft: "rgba(147, 197, 253, 0.16)" },
    violet: { accent: "#c4b5fd", ring: "rgba(196, 181, 253, 0.58)", ringSoft: "rgba(196, 181, 253, 0.16)" },
    amber: { accent: "#f7d27a", ring: "rgba(247, 210, 122, 0.58)", ringSoft: "rgba(247, 210, 122, 0.16)" },
    teal: { accent: "#8be9f4", ring: "rgba(126, 205, 255, 0.72)", ringSoft: "rgba(126, 205, 255, 0.18)" },
  };
  const lightTokens: Record<DesktopAccentColor, { accent: string; ring: string; ringSoft: string }> = {
    graphite: { accent: "#4b5563", ring: "rgba(75, 85, 99, 0.42)", ringSoft: "rgba(75, 85, 99, 0.12)" },
    blue: { accent: "#2563eb", ring: "rgba(37, 99, 235, 0.42)", ringSoft: "rgba(37, 99, 235, 0.12)" },
    violet: { accent: "#7c3aed", ring: "rgba(124, 58, 237, 0.4)", ringSoft: "rgba(124, 58, 237, 0.12)" },
    amber: { accent: "#b7791f", ring: "rgba(183, 121, 31, 0.44)", ringSoft: "rgba(183, 121, 31, 0.14)" },
    teal: { accent: "#0f766e", ring: "rgba(15, 118, 110, 0.44)", ringSoft: "rgba(15, 118, 110, 0.14)" },
  };
  return dark ? darkTokens[accent] : lightTokens[accent];
}

export function sidebarWidthValue(width: DesktopSidebarWidth): string {
  if (width === "compact") return "72px";
  if (width === "wide") return "288px";
  return "240px";
}

export function applyDesktopPreferences(preferences: DesktopPreferences): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark =
    preferences.appearance.theme === "dark" || (preferences.appearance.theme === "system" && prefersDark);
  root.classList.toggle("dark", shouldUseDark);
  const tokens = accentTokens(preferences.appearance.accent, shouldUseDark);
  root.classList.toggle("karya-reduce-motion", preferences.appearance.reduceMotion);
  root.style.setProperty("--karya-accent", tokens.accent);
  root.style.setProperty("--karya-ring", tokens.ring);
  root.style.setProperty("--karya-ring-soft", tokens.ringSoft);
  root.style.setProperty("--karya-sidebar-width", sidebarWidthValue(preferences.sidebar.width));
  root.style.fontSize = `${Math.round(16 * preferences.appearance.fontScale)}px`;
  root.dataset.karyaSidebarWidth = preferences.sidebar.width;
  window.localStorage.setItem(DESKTOP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}
