// THE design tokens (plan §4) — the only place colors, sizes and spacing
// are defined. Three text sizes (user-selectable, minimum 20px body) and
// three themes. Every color pair here meets WCAG AAA (≥ 7:1) on its
// background; Phase 6 re-verifies with the audit checklist.
import { AccessibilityInfo, useColorScheme } from "react-native";
import { useEffect, useState } from "react";
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
  /**
   * Decorative 1 px edge for cards, fields and toasts. NOT the interactive
   * `border` (which must keep ≥ 3:1 per WCAG 1.4.11) — hairline only ever
   * separates content, so it has no contrast floor.
   */
  hairline: string;
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
    hairline: "#E3E7EC",
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
    hairline: "#2A2F36",
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
    hairline: "#FFFFFF",
  },
};

// px per text level (plan §4.1). Line-height ≈ 1.4 is applied by consumers.
// "normal" is a standard mobile scale (17 px body ≈ iOS default) so screens
// fit without scrolling; "large" ≈ the original plan's minimum (20 px body)
// and "xlarge" goes further — the accessibility ladder still ends big.
export const FONT: Record<TextSize, Record<string, number>> = {
  normal: { body: 17, label: 15, button: 18, title: 23, hero: 30 },
  large: { body: 20, label: 17, button: 21, title: 27, hero: 34 },
  xlarge: { body: 24, label: 20, button: 25, title: 32, hero: 40 },
};

// Touch sizes (plan §4.2) — absolute floors, never scaled down. 48 px is the
// Material/HIG floor at "normal"; rows and the hero action stay generous.
export const TOUCH = { min: 48, button: 56, row: 68, hero: 72 };
export const SPACE = { xs: 4, s: 8, m: 14, l: 18, xl: 20, xxl: 28, xxxl: 40 };
export const RADIUS = { sm: 12, md: 16, lg: 24, pill: 999 };

/**
 * Elevation presets (modern depth). react-native-web turns the shadow*
 * props into a CSS box-shadow; Android native reads `elevation`. Shadows
 * are pure decoration — they never carry meaning, so no contrast rules
 * apply — and the high-contrast theme simply skips them.
 */
export const ELEVATION = {
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;

/**
 * True while the OS "reduce motion" accessibility setting is on. The motion
 * rule (plan §4.4): the fade transitions and press animations are the only
 * motion in the app, and both disappear entirely under this flag.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

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
