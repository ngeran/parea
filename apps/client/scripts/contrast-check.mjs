// Accessibility audit — WCAG contrast verification.
//
// Every color pair the UI can actually produce, for all three themes.
// The bar is AAA (≥ 7:1) for text; interactive borders/icons need ≥ 3:1
// (WCAG 1.4.11 non-text contrast).
//
// Run: npm run check:contrast  (from apps/client)
// Exit code 1 if any TEXT pair is below its threshold.
//
// Keep in sync with src/theme.ts (COLORS + TINT). The legacy alias keys
// (bg, surface, text, …) are identities of the modern tokens, so checking
// the modern pair checks the alias too.

const SURFACE_LEVELS = [
  "background",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
];

// Keep in sync with src/theme.ts COLORS.
const THEMES = {
  light: {
    background: "#F7F9FF", surfaceContainerLowest: "#FFFFFF", surfaceContainerLow: "#F1F4F9",
    surfaceContainer: "#EBEEF3", surfaceContainerHigh: "#E5E8EE", surfaceContainerHighest: "#E0E3E8",
    surfaceDim: "#D7DADF", surfaceBright: "#FFFFFF",
    onSurface: "#181C20", onSurfaceVariant: "#56423C",
    primary: "#8A2F10", onPrimary: "#FFFFFF", primaryContainer: "#BD5630", onPrimaryContainer: "#FFFBFF",
    primaryFixed: "#FFDBCF", onPrimaryFixed: "#390C00", onPrimaryFixedVariant: "#802900",
    secondary: "#6F3B0C", onSecondary: "#FFFFFF", secondaryContainer: "#FFAB69", onSecondaryContainer: "#783D01",
    tertiary: "#544C46", onTertiary: "#FFFFFF", tertiaryContainer: "#7F726A", onTertiaryContainer: "#FFFFFF",
    error: "#971B15", onError: "#FFFFFF", errorContainer: "#FFDAD6", onErrorContainer: "#93000A",
    outline: "#8A726A", outlineVariant: "#DDC0B7",
    inverseSurface: "#181C20", inverseOnSurface: "#F7F9FF", inversePrimary: "#FFB59A",
    success: "#146038", onSuccess: "#FFFFFF",
    ctaFill: "#8A2F10", ctaLabel: "#FFFFFF", primarySoft: "#FFE7DB", onSoft: "#390C00",
    // BigButton gradient (second stop) — the label must pass on BOTH stops.
    ctaGradientStop2: "#7C280E",
    // TINT composites (src/theme.ts) — solid fills the gate asserts here.
    tints: {
      ember: "#F7EBE6", cyan: "#FFF0E4", amber: "#E8E6E4", success: "#E3ECE7", danger: "#F3E4E3",
    },
  },
  dark: {
    background: "#0B1325", surfaceContainerLowest: "#060E1F", surfaceContainerLow: "#131B2D",
    surfaceContainer: "#171F31", surfaceContainerHigh: "#222A3C", surfaceContainerHighest: "#2D3548",
    surfaceDim: "#0B1325", surfaceBright: "#31394C",
    onSurface: "#DAE2FB", onSurfaceVariant: "#DFC0B5",
    primary: "#FFB59A", onPrimary: "#1A0600", primaryContainer: "#FF7A45", onPrimaryContainer: "#1A0600",
    primaryFixed: "#FFDBCF", onPrimaryFixed: "#380D00", onPrimaryFixedVariant: "#802900",
    secondary: "#7BD0FF", onSecondary: "#00354A", secondaryContainer: "#00A6E0", onSecondaryContainer: "#00374D",
    tertiary: "#F9BD22", onTertiary: "#402D00", tertiaryContainer: "#CC9900", onTertiaryContainer: "#1D1300",
    error: "#FFB4AB", onError: "#690005", errorContainer: "#93000A", onErrorContainer: "#FFDAD6",
    outline: "#A78B81", outlineVariant: "#58423A",
    inverseSurface: "#DAE2FB", inverseOnSurface: "#283043", inversePrimary: "#A73A05",
    success: "#56E5A9", onSuccess: "#003018",
    ctaFill: "#FF7A45", ctaLabel: "#1A0600", primarySoft: "#372C34", onSoft: "#FFB59A",
    ctaGradientStop2: "#F97316",
    tints: {
      ember: "#372C34", cyan: "#14324A", amber: "#32322F", success: "#203B42", danger: "#373442",
    },
  },
  contrast: {
    background: "#000000", surfaceContainerLowest: "#000000", surfaceContainerLow: "#000000",
    surfaceContainer: "#000000", surfaceContainerHigh: "#000000", surfaceContainerHighest: "#000000",
    surfaceDim: "#000000", surfaceBright: "#000000",
    onSurface: "#FFFFFF", onSurfaceVariant: "#FFFFFF",
    primary: "#FFFFFF", onPrimary: "#000000", primaryContainer: "#FFFFFF", onPrimaryContainer: "#000000",
    primaryFixed: "#FFFFFF", onPrimaryFixed: "#000000", onPrimaryFixedVariant: "#000000",
    secondary: "#FFFFFF", onSecondary: "#000000", secondaryContainer: "#FFFFFF", onSecondaryContainer: "#000000",
    tertiary: "#FFFFFF", onTertiary: "#000000", tertiaryContainer: "#FFFFFF", onTertiaryContainer: "#000000",
    error: "#FFFFFF", onError: "#000000", errorContainer: "#FFFFFF", onErrorContainer: "#000000",
    outline: "#FFFFFF", outlineVariant: "#FFFFFF",
    inverseSurface: "#FFFFFF", inverseOnSurface: "#000000", inversePrimary: "#FFFFFF",
    success: "#FFFFFF", onSuccess: "#000000",
    ctaFill: "#FFFFFF", ctaLabel: "#000000", primarySoft: "#FFFFFF", onSoft: "#000000",
    ctaGradientStop2: "#FFFFFF",
    tints: { ember: "#000000", cyan: "#000000", amber: "#000000", success: "#000000", danger: "#000000" },
  },
};

// mix("##RRGGBB", alpha, overHex) → the composite hex. Mirrors how TINT in
// src/theme.ts was derived, so a drift between the two fails here.
function mix(hex, alpha, over) {
  const p = (h) => {
    const n = h.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const [f, b] = [p(hex), p(over)];
  return (
    "#" +
    f
      .map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

// [description, foreground, background, threshold]
// 7 = AAA normal text (the bar) · 3 = non-text (borders, icons).
// Consciously accepted non-passes (documented in DESIGN.md, never asserted):
//   · white on light primaryContainer #BD5630 (4.6 — decorative fill only)
//   · onSurfaceVariant on dark surfaceBright (6.78 — surfaceBright is fill-only)
//   · light error-as-text on errorContainer (use onErrorContainer #93000A there)
//   · light tertiaryContainer #7F726A carries no text at all
function pairs(c, name) {
  const out = [];
  // Content colors on every text-bearing surface level.
  for (const level of SURFACE_LEVELS) {
    out.push([`body text on ${level}`, c.onSurface, c[level], 7]);
    out.push([`secondary text on ${level}`, c.onSurfaceVariant, c[level], 7]);
  }
  // surfaceBright (dark) is fill-only for onSurfaceVariant; onSurface passes.
  out.push(["body text on surfaceBright", c.onSurface, c.surfaceBright, 7]);
  // THE CTA pair + both gradient stops.
  out.push(["primary CTA label on ctaFill", c.ctaLabel, c.ctaFill, 7]);
  out.push(["primary CTA label on gradient stop 2", c.ctaLabel, c.ctaGradientStop2, 7]);
  // Label on a plain primary fill (legacy onPrimary semantics — dark
  // onPrimary #1A0600 covers both #FFB59A and #FF7A45 fills).
  out.push(["label on primary fill", c.onPrimary, c.primary, 7]);
  // Error / success fills and their container pairs.
  out.push(["error button label", c.onError, c.error, 7]);
  out.push(["success button label", c.onSuccess, c.success, 7]);
  out.push(["text on errorContainer", c.onErrorContainer, c.errorContainer, 7]);
  // Soft pair: selected chips/radios, soft buttons, pressed rows, initials.
  out.push(["label on primarySoft (soft button, selected chip, initial)", c.onSoft, c.primarySoft, 7]);
  // Accent colors AS TEXT only ever sit on plain surfaces (never on tints
  // in light — the tint rule puts onSurface there instead).
  out.push(["primary as text on bg", c.primary, c.background, 7]);
  out.push(["primary as text on containerLow", c.primary, c.surfaceContainerLow, 7]);
  out.push(["primary as text on container", c.primary, c.surfaceContainer, 7]);
  out.push(["secondary as text on bg", c.secondary, c.background, 7]);
  out.push(["secondary as text on container", c.secondary, c.surfaceContainer, 7]);
  out.push(["tertiary as text on bg", c.tertiary, c.background, 7]);
  out.push(["tertiary as text on container", c.tertiary, c.surfaceContainer, 7]);
  out.push(["error as text on bg", c.error, c.background, 7]);
  out.push(["error as text on container", c.error, c.surfaceContainer, 7]);
  // Interactive borders (≥ 3:1, WCAG 1.4.11) on every surface level.
  for (const level of SURFACE_LEVELS) {
    out.push([`outline border on ${level} (non-text)`, c.outline, c[level], 3]);
  }
  out.push(["ctaFill as border on bg (non-text)", c.ctaFill, c.background, 3]);
  out.push(["ctaFill as border on container (non-text)", c.ctaFill, c.surfaceContainer, 3]);
  // Tinted tiles/pills — the composites must match theme.ts TINT exactly,
  // and their labels must clear AAA:
  //   dark → bright accent of the same hue · light/contrast → onSurface.
  // Recipe per hue: [source token, alpha, over, label token]. Dark mixes the
  // bright accent over surfaceContainer; light mixes the container hue over
  // white; contrast uses alpha 0 (pure black, like TINT).
  const recipes = {
    dark: {
      ember: [c.primaryContainer, 0.14, c.surfaceContainer, c.primary],
      cyan: [c.secondaryContainer, 0.14, c.surfaceContainer, c.secondary],
      amber: [c.tertiary, 0.12, c.surfaceContainer, c.tertiary],
      success: [c.success, 0.14, c.surfaceContainer, c.success],
      danger: [c.error, 0.14, c.surfaceContainer, c.error],
    },
    light: {
      ember: [c.primaryContainer, 0.12, "#FFFFFF", c.onSurface],
      cyan: [c.secondaryContainer, 0.18, "#FFFFFF", c.onSurface],
      amber: [c.tertiaryContainer, 0.18, "#FFFFFF", c.onSurface],
      success: [c.success, 0.12, "#FFFFFF", c.onSurface],
      danger: [c.error, 0.12, "#FFFFFF", c.onSurface],
    },
    contrast: {
      ember: [c.primaryContainer, 0, c.surfaceContainer, c.onSurface],
      cyan: [c.secondaryContainer, 0, c.surfaceContainer, c.onSurface],
      amber: [c.tertiaryContainer, 0, c.surfaceContainer, c.onSurface],
      success: [c.success, 0, c.surfaceContainer, c.onSurface],
      danger: [c.error, 0, c.surfaceContainer, c.onSurface],
    },
  }[name];
  for (const [hue, [src, alpha, over, label]] of Object.entries(recipes)) {
    const got = mix(src, alpha, over).toUpperCase();
    const want = c.tints[hue].toUpperCase();
    if (got !== want) {
      // Drift: recipe and TINT table disagree — a ratio check can't tell
      // 1.0 from 1.01, so compare the hexes and hard-fail on any difference.
      out.push([`${hue} tint DRIFT — theme.ts ${want} vs recipe ${got}`, "#000000", "#FFFFFF", 999]);
    } else if (name === "dark") {
      out.push([`${hue} accent label on ${hue} tint ${got}`, label, got, 7]);
    } else {
      out.push([`${hue} tint ${got} carries onSurface`, c.onSurface, got, 7]);
    }
  }
  // Light cyan pills may also use onSecondaryContainer (7.64).
  if (c === THEMES.light) {
    out.push(["cyan tint carries onSecondaryContainer", c.onSecondaryContainer, c.tints.cyan, 7]);
  }
  return out;
}

function lum(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg, bg) {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

let fail = 0;
for (const [name, c] of Object.entries(THEMES)) {
  console.log(`\n${name} theme`);
  console.log("-".repeat(64));
  for (const [desc, fg, bg, min] of pairs(c, name)) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${desc}  ` +
        `[${fg} on ${bg}]`,
    );
  }
}
console.log("-".repeat(64));
console.log(fail === 0 ? "\nAll pairs pass." : `\n${fail} pair(s) below threshold.`);
process.exit(fail === 0 ? 0 : 1);
