// Phase 6 accessibility audit — WCAG contrast verification (plan §4.3).
//
// Every color pair the UI can actually produce, for all three themes.
// The plan's bar is AAA (≥ 7:1) for text; UI borders need ≥ 3:1 (WCAG
// 1.4.11 non-text contrast).
//
// Run: npm run check:contrast  (from apps/client)
// Exit code 1 if any TEXT pair is below its threshold.

// Keep in sync with src/theme.ts COLORS.
const THEMES = {
  light: {
    bg: "#FFFFFF", surface: "#F5F7FA", text: "#1A1C1E", textSecondary: "#44474A",
    primary: "#0A4D8C", primarySoft: "#DCEAF8", onPrimary: "#FFFFFF", onSoft: "#1A1C1E",
    success: "#146038", danger: "#9E1F19", border: "#6A7076", hairline: "#E3E7EC",
  },
  dark: {
    bg: "#101214", surface: "#1C1F22", text: "#FFFFFF", textSecondary: "#D5D8DC",
    primary: "#9CC9F5", primarySoft: "#17324D", onPrimary: "#0A2540", onSoft: "#FFFFFF",
    success: "#7FD8A4", danger: "#F2A196", border: "#71777D", hairline: "#2A2F36",
  },
  contrast: {
    bg: "#000000", surface: "#000000", text: "#FFFFFF", textSecondary: "#FFFFFF",
    primary: "#FFFFFF", primarySoft: "#FFFFFF", onPrimary: "#000000", onSoft: "#000000",
    success: "#FFFFFF", danger: "#FFFFFF", border: "#FFFFFF", hairline: "#FFFFFF",
  },
};

// [description, foreground, background, threshold]
// 7 = AAA normal text (the plan's bar) · 4.5 = AA normal · 3 = large text /
// non-text (borders, icons). Button labels are ≥ 22 px bold → WCAG "large",
// but we hold them to 7:1 anyway; the 4.5 entries are cases we consciously
// accept at AA (noted in docs/PHASE-6-A11Y.md).
function pairs(c) {
  return [
    ["body text on bg", c.text, c.bg, 7],
    ["body text on surface (cards, rows)", c.text, c.surface, 7],
    ["secondary text on bg", c.textSecondary, c.bg, 7],
    ["secondary text on surface", c.textSecondary, c.surface, 7],
    ["primary/danger button label", c.onPrimary, c.primary, 7],
    ["success button label", c.onPrimary, c.success, 7],
    ["danger button label", c.onPrimary, c.danger, 7],
    ["soft button / selected chip / pressed row label", c.onSoft, c.primarySoft, 7],
    ["quiet button + Back link on bg", c.primary, c.bg, 7],
    ["quiet button + Back link on surface", c.primary, c.surface, 7],
    ["error text on bg", c.danger, c.bg, 7],
    ["error text on surface", c.danger, c.surface, 7],
    ["avatar initial", c.onSoft, c.primarySoft, 4.5],
    ["input border on bg (non-text)", c.border, c.bg, 3],
    ["chip/radio border on bg (non-text)", c.border, c.bg, 3],
  ];
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
  for (const [desc, fg, bg, min] of pairs(c)) {
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
