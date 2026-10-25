// THE design tokens — the only place colors, sizes and spacing are defined.
// Two design systems (see DESIGN.md): light "Warm Companion" (terracotta on
// cool-white M3 surfaces) and dark "Luminous Hearth" (obsidian surfaces,
// ember CTAs, cyan + amber accents), plus the pure black/white high-contrast
// theme. Three text sizes (user-selectable). Every color pair here meets
// WCAG AAA (≥ 7:1) for text and ≥ 3:1 for interactive borders; the audit
// re-verifies with scripts/contrast-check.mjs.
import { AccessibilityInfo, useColorScheme } from "react-native";
import { useEffect, useState } from "react";
import { useStore } from "./store";
import type { TextSize, ThemeName } from "@parea/shared";

/**
 * M3-style roles plus the app-specific ones (ctaFill/ctaLabel, success pair,
 * primarySoft pair). The legacy keys at the bottom (bg, surface, text, …) are
 * ALIASES kept for screens not yet migrated to the modern names — see the
 * mapping table in DESIGN.md. New code must use the modern keys only.
 */
export interface ThemeColors {
  // ── Surfaces ────────────────────────────────────────────────────────────
  background: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  /** Scrim / launch fills. Never text-bearing. */
  surfaceDim: string;
  /** Decorative fills only — onSurfaceVariant fails on it (dark). */
  surfaceBright: string;
  // ── Content ─────────────────────────────────────────────────────────────
  onSurface: string;
  onSurfaceVariant: string;
  // ── Primary (ember) ─────────────────────────────────────────────────────
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  primaryFixed: string;
  onPrimaryFixed: string;
  onPrimaryFixedVariant: string;
  // ── Secondary (electric cyan in dark, warm brown in light) ─────────────
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  // ── Tertiary (amber) ────────────────────────────────────────────────────
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  // ── Error ───────────────────────────────────────────────────────────────
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  // ── Utility ─────────────────────────────────────────────────────────────
  /** Interactive borders — ≥ 3:1 on every surface (WCAG 1.4.11). */
  outline: string;
  /** Decorative hairline — separates content, no contrast floor. */
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  // ── App-specific ────────────────────────────────────────────────────────
  success: string;
  onSuccess: string;
  /** THE primary-CTA pair (BigButton variant="primary"). Gradient-safe: the
   *  label passes ≥ 7:1 on BOTH ember stops in dark and the nudged primary
   *  in light. */
  ctaFill: string;
  ctaLabel: string;
  /** Selected chips/radios, soft buttons, pressed rows, avatar initials. */
  primarySoft: string;
  onSoft: string;

  // ── LEGACY ALIASES (DESIGN.md §mapping) — do not use in new code ────────
  bg: string;
  surface: string;
  surfaceHigh: string;
  text: string;
  textSecondary: string;
  /** Light: warm brown highlight · Dark: amber. */
  accent: string;
  danger: string;
  border: string;
  hairline: string;
}

/** The modern subset every theme must spell out; aliases are derived. */
type ModernColors = Omit<
  ThemeColors,
  "bg" | "surface" | "surfaceHigh" | "text" | "textSecondary" | "accent" | "danger" | "border" | "hairline"
>;

/**
 * Derive the legacy aliases from the modern tokens so they can never drift.
 * `accent` is the one deliberately per-theme mapping: the light system's
 * highlight is the warm-brown secondary, the dark system's is amber.
 */
function theme(m: ModernColors, accent: string): ThemeColors {
  return {
    ...m,
    bg: m.background,
    surface: m.surfaceContainer,
    surfaceHigh: m.surfaceContainerHigh,
    text: m.onSurface,
    textSecondary: m.onSurfaceVariant,
    accent,
    danger: m.error,
    border: m.outline,
    hairline: m.outlineVariant,
  };
}

export const COLORS: Record<ThemeName, ThemeColors> = {
  // "Warm Companion" — design tokens verbatim except the documented nudges
  // (DESIGN.md §nudges): only "on" colors are darkened to clear AAA; hues
  // stay recognizable.
  light: theme(
    {
      background: "#F7F9FF",
      surfaceContainerLowest: "#FFFFFF",
      surfaceContainerLow: "#F1F4F9",
      surfaceContainer: "#EBEEF3",
      surfaceContainerHigh: "#E5E8EE",
      surfaceContainerHighest: "#E0E3E8",
      surfaceDim: "#D7DADF",
      surfaceBright: "#FFFFFF",
      onSurface: "#181C20",
      onSurfaceVariant: "#56423C",
      // L1: design #9D3E1A — white label was 6.69:1; #8A2F10 gives 8.42.
      primary: "#8A2F10",
      onPrimary: "#FFFFFF",
      // Light primaryContainer never carries labels (white on #BD5630 caps
      // at 4.6:1) — decorative fills/tints only.
      primaryContainer: "#BD5630",
      onPrimaryContainer: "#FFFBFF",
      primaryFixed: "#FFDBCF",
      onPrimaryFixed: "#390C00",
      onPrimaryFixedVariant: "#802900",
      // L2: design #8E4E14 — 6.46:1 on white; #6F3B0C gives 9.10.
      secondary: "#6F3B0C",
      onSecondary: "#FFFFFF",
      secondaryContainer: "#FFAB69",
      onSecondaryContainer: "#783D01",
      // L3: design #655A52 — 6.69:1 on white; #544C46 gives 8.40.
      tertiary: "#544C46",
      onTertiary: "#FFFFFF",
      tertiaryContainer: "#7F726A",
      onTertiaryContainer: "#FFFFFF",
      // L4: design #BA1A1A — 6.46:1 on white; #971B15 gives 8.46. (The old
      // #9E1F19 also failed on the new container at 6.78.)
      error: "#971B15",
      onError: "#FFFFFF",
      errorContainer: "#FFDAD6",
      onErrorContainer: "#93000A",
      outline: "#8A726A",
      outlineVariant: "#DDC0B7",
      inverseSurface: "#181C20",
      inverseOnSurface: "#F7F9FF",
      inversePrimary: "#FFB59A",
      success: "#146038",
      onSuccess: "#FFFFFF",
      ctaFill: "#8A2F10",
      ctaLabel: "#FFFFFF",
      primarySoft: "#FFE7DB",
      onSoft: "#390C00",
    },
    // Light accent = the warm-brown secondary family.
    "#6F3B0C",
  ),
  // "Luminous Hearth" — design tokens verbatim except D1/D2 (DESIGN.md):
  // label colors darkened, container hues untouched.
  dark: theme(
    {
      background: "#0B1325",
      surfaceContainerLowest: "#060E1F",
      surfaceContainerLow: "#131B2D",
      surfaceContainer: "#171F31",
      surfaceContainerHigh: "#222A3C",
      surfaceContainerHighest: "#2D3548",
      surfaceDim: "#0B1325",
      surfaceBright: "#31394C",
      onSurface: "#DAE2FB",
      onSurfaceVariant: "#DFC0B5",
      primary: "#FFB59A",
      // D1 family: design onPrimary #5B1B00 → #1A0600 so ONE label token
      // covers both the #FFB59A and #FF7A45 fills (7.59+ on each; #5B1B00
      // was 4.55 on ember).
      onPrimary: "#1A0600",
      primaryContainer: "#FF7A45",
      onPrimaryContainer: "#1A0600",
      primaryFixed: "#FFDBCF",
      onPrimaryFixed: "#380D00",
      onPrimaryFixedVariant: "#802900",
      secondary: "#7BD0FF",
      onSecondary: "#00354A",
      secondaryContainer: "#00A6E0",
      onSecondaryContainer: "#00374D",
      tertiary: "#F9BD22",
      onTertiary: "#402D00",
      tertiaryContainer: "#CC9900",
      // D2: design #402D00 — 5.10:1 on #CC9900; #1D1300 gives 7.09.
      onTertiaryContainer: "#1D1300",
      error: "#FFB4AB",
      onError: "#690005",
      errorContainer: "#93000A",
      onErrorContainer: "#FFDAD6",
      outline: "#A78B81",
      outlineVariant: "#58423A",
      inverseSurface: "#DAE2FB",
      inverseOnSurface: "#283043",
      inversePrimary: "#A73A05",
      success: "#56E5A9",
      onSuccess: "#003018",
      ctaFill: "#FF7A45",
      ctaLabel: "#1A0600",
      // Ember 14% over surfaceContainer — the mockup's tinted selected card.
      primarySoft: "#372C34",
      onSoft: "#FFB59A",
    },
    // Dark accent = amber.
    "#F9BD22",
  ),
  // Pure black/white: every fill is white, every label black, so the same
  // code paths (and the 3 px border branches) keep working unchanged.
  contrast: theme(
    {
      background: "#000000",
      surfaceContainerLowest: "#000000",
      surfaceContainerLow: "#000000",
      surfaceContainer: "#000000",
      surfaceContainerHigh: "#000000",
      surfaceContainerHighest: "#000000",
      surfaceDim: "#000000",
      surfaceBright: "#000000",
      onSurface: "#FFFFFF",
      onSurfaceVariant: "#FFFFFF",
      primary: "#FFFFFF",
      onPrimary: "#000000",
      primaryContainer: "#FFFFFF",
      onPrimaryContainer: "#000000",
      primaryFixed: "#FFFFFF",
      onPrimaryFixed: "#000000",
      onPrimaryFixedVariant: "#000000",
      secondary: "#FFFFFF",
      onSecondary: "#000000",
      secondaryContainer: "#FFFFFF",
      onSecondaryContainer: "#000000",
      tertiary: "#FFFFFF",
      onTertiary: "#000000",
      tertiaryContainer: "#FFFFFF",
      onTertiaryContainer: "#000000",
      error: "#FFFFFF",
      onError: "#000000",
      errorContainer: "#FFFFFF",
      onErrorContainer: "#000000",
      outline: "#FFFFFF",
      outlineVariant: "#FFFFFF",
      inverseSurface: "#FFFFFF",
      inverseOnSurface: "#000000",
      inversePrimary: "#FFFFFF",
      success: "#FFFFFF",
      onSuccess: "#000000",
      ctaFill: "#FFFFFF",
      ctaLabel: "#000000",
      primarySoft: "#FFFFFF",
      onSoft: "#000000",
    },
    "#FFFFFF",
  ),
};

/**
 * Solid tinted fills for decorative tiles/pills ("emoji in tinted tiles").
 * These are PRE-COMPUTED composites (tint hue over white in light / over
 * surfaceContainer in dark) — not runtime alpha — so the contrast gate can
 * assert the exact pair. The alphas are load-bearing (dark amber at 16%
 * fails AAA); see DESIGN.md §tints. High contrast skips tints entirely:
 * components keep their 3px-border branches.
 */
export type TintHue = "ember" | "cyan" | "amber" | "success" | "danger";
export const TINT: Record<ThemeName, Record<TintHue, string>> = {
  light: {
    ember: "#F7EBE6", // primaryContainer 12% over white — onSurface 14.67
    cyan: "#FFF0E4", // secondaryContainer 18% over white — onSecondaryContainer 7.64
    amber: "#E8E6E4", // tertiaryContainer 18% over white — onSurface ≈13
    success: "#E3ECE7", // success 12% over white — onSurface ≈13
    danger: "#F3E4E3", // error 12% over white — onSurface ≈13
  },
  dark: {
    ember: "#372C34", // primaryContainer 14% over container — primary 7.84
    cyan: "#14324A", // secondaryContainer 14% — secondary 7.77
    amber: "#32322F", // tertiary 12% — tertiary 7.55
    success: "#203B42", // success 14% — success 7.46
    danger: "#373442", // error 14% — error 7.14
  },
  contrast: {
    ember: "#000000",
    cyan: "#000000",
    amber: "#000000",
    success: "#000000",
    danger: "#000000",
  },
};

/**
 * Solid-color surfaces can't use RN's rgba() token strings directly — this
 * converts a #RRGGBB token to a translucent fill. Decorative only — never
 * carry text in dark (the tint discipline is enforced through TINT).
 */
export function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// px per text level. Line-height ≈ 1.4 is applied by consumers.
// "normal" is a standard mobile scale (17 px body ≈ iOS default) so screens
// fit without scrolling; "large" ≈ 20 px body and "xlarge" goes further —
// the accessibility ladder still ends big.
export const FONT: Record<TextSize, Record<string, number>> = {
  normal: { body: 17, label: 15, button: 18, title: 23, hero: 30 },
  large: { body: 20, label: 17, button: 21, title: 27, hero: 34 },
  xlarge: { body: 24, label: 20, button: 25, title: 32, hero: 40 },
};

// Touch sizes — absolute floors, never scaled down. 48 px is the
// Material/HIG floor at "normal"; rows and the hero action stay generous.
export const TOUCH = { min: 48, button: 56, row: 68, hero: 72 };
export const SPACE = { xs: 4, s: 8, m: 14, l: 18, xl: 20, xxl: 28, xxxl: 40 };
export const RADIUS = { sm: 12, md: 16, lg: 24, xl: 28, pill: 999 };

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
 * rule: the fade transitions and press animations are the only motion in
 * the app, and both disappear entirely under this flag.
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
