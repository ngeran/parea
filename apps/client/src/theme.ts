// THE design tokens (plan §4) — the only place colors, sizes and spacing
// are defined. Three text sizes (user-selectable, minimum 20px body) and
// three themes. Every color pair here meets WCAG AAA (≥ 7:1) on its
// background; Phase 6 re-verifies with the audit checklist.
import { useColorScheme } from "react-native";
import { useStore } from "./store";
import type { TextSize, ThemeName } from "@parea/shared";

export interface ThemeColors {
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  /** Label color on primarySoft fills (soft buttons, selected chips/radios). */
  onSoft: string;
  success: string;
  danger: string;
  border: string;
}

export const COLORS: Record<ThemeName, ThemeColors> = {
  light: {
    bg: "#FFFFFF",
    surface: "#F5F7FA",
    text: "#1A1C1E",
    textSecondary: "#44474A",
    primary: "#0A4D8C",
    primarySoft: "#DCEAF8",
    onPrimary: "#FFFFFF",
    onSoft: "#1A1C1E",
    success: "#146038",
    // #9E1F19 is the lightest red that keeps ≥ 7:1 against white AND surface
    // (Phase 6 audit; #B3261E only reached 6.5:1).
    danger: "#9E1F19",
    // #6A7076 is the darkest gray still ≥ 3:1 on white and surface
    // (WCAG 1.4.11 non-text contrast; #C9CDD2 failed at 1.6:1).
    border: "#6A7076",
  },
  dark: {
    bg: "#101214",
    surface: "#1C1F22",
    text: "#FFFFFF",
    textSecondary: "#D5D8DC",
    primary: "#9CC9F5",
    primarySoft: "#17324D",
    onPrimary: "#0A2540",
    onSoft: "#FFFFFF",
    success: "#7FD8A4",
    danger: "#F2A196",
    // #71777D ≥ 3:1 on bg and surface (#3A3F44 failed at 1.8:1).
    border: "#71777D",
  },
  contrast: {
    bg: "#000000",
    surface: "#000000",
    text: "#FFFFFF",
    textSecondary: "#FFFFFF",
    primary: "#FFFFFF",
    primarySoft: "#FFFFFF",
    onPrimary: "#000000",
    // Soft fills are white here, so their labels must flip to black.
    onSoft: "#000000",
    success: "#FFFFFF",
    danger: "#FFFFFF",
    border: "#FFFFFF",
  },
};

// px per text level (plan §4.1). Line-height ≈ 1.4 is applied by consumers.
export const FONT: Record<TextSize, Record<string, number>> = {
  normal: { body: 20, label: 18, button: 22, title: 28, hero: 34 },
  large: { body: 23, label: 21, button: 25, title: 32, hero: 39 },
  xlarge: { body: 26, label: 23, button: 29, title: 36, hero: 44 },
};

// Touch sizes (plan §4.2) — absolute floors, never scaled down.
export const TOUCH = { min: 56, button: 64, row: 88, hero: 96 };
export const SPACE = { xs: 4, s: 8, m: 16, l: 20, xl: 24, xxl: 32, xxxl: 48 };
export const RADIUS = { sm: 12, md: 16, lg: 24, pill: 999 };

/**
 * The concrete theme in effect right now. "system" tracks the OS setting and
 * re-renders everything the moment it changes; light/dark/contrast are fixed
 * choices. Re-exported from the store so layout, screens and this module all
 * resolve identically.
 */
export function useResolvedThemeName(): ThemeName {
  const pref = useStore((s) => s.theme);
  const scheme = useColorScheme();
  if (pref === "system") return scheme === "dark" ? "dark" : "light";
  return pref;
}

/** Everything a screen needs, already resolved for the user's choices. */
export function useTheme() {
  const textSize = useStore((s) => s.textSize);
  const themeName = useResolvedThemeName();
  return {
    c: COLORS[themeName],
    f: FONT[textSize],
    touch: TOUCH,
    space: SPACE,
    radius: RADIUS,
    themeName,
    textSize,
  };
}
