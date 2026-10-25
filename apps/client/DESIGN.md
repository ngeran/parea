# Parea design system — "Warm Companion" (light) + "Luminous Hearth" (dark)

Two design systems, one token source: `src/theme.ts`. The high-contrast
theme is the mechanical black/white extension of the same roles. The
contrast gate — `npm run check:contrast` — asserts **127 color pairs**
across all three themes (AAA ≥ 7:1 for text, ≥ 3:1 for interactive
borders) and hard-fails CI on any drift, including the tint composites
(hex-exact). Builds are also gated by `npx tsc --noEmit`.

Accessibility ground rules live in `../docs/PHASE-6-A11Y.md` (touch
floors, read-aloud, reduce-motion, screen-reader semantics); this file
covers the visual system. The redesign plan source:
mockups (5 HTML pages) for layout, the two design.md files for palette.

---

## 1. Token architecture

`ThemeColors` = full M3-style role set + legacy aliases. Every theme is
spelled out as `ModernColors` and passed through `theme(m, accent)`,
which derives the aliases — they can never drift from the modern tokens.

| Group | Keys |
|---|---|
| Surfaces | `background`, `surfaceContainerLowest/Low/Container/High/Highest`, `surfaceDim` (scrims/launch), `surfaceBright` (decorative fills only) |
| Content | `onSurface`, `onSurfaceVariant` |
| Primary | `primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`, `primaryFixed`, `onPrimaryFixed`, `onPrimaryFixedVariant` |
| Secondary | `secondary`, `onSecondary`, `secondaryContainer`, `onSecondaryContainer` |
| Tertiary | `tertiary`, `onTertiary`, `tertiaryContainer`, `onTertiaryContainer` |
| Error | `error`, `onError`, `errorContainer`, `onErrorContainer` |
| Utility | `outline` (interactive borders, ≥3:1 everywhere), `outlineVariant` (decorative hairline), `inverseSurface`, `inverseOnSurface`, `inversePrimary` |
| App | `success`, `onSuccess`, `ctaFill`, `ctaLabel` (THE button pair), `primarySoft`, `onSoft` (selected chips/soft buttons/initials) |
| Legacy | `bg surface surfaceHigh text textSecondary accent danger border hairline` — aliases only, do NOT use in new code |

Derived values:

- `CTA_GRADIENT` — the two ember stops per theme (`light: #8A2F10→#7C280E`,
  `dark: #FF7A45→#F97316`). `ctaLabel` passes ≥7:1 on **both** stops
  (asserted). Never used raw in screens — only via `BigButton gradient`,
  the Avatar ring, and the two hero cards (home, nearby).
- `TINT[theme][hue]` — solid precomputed tile/pill fills for
  `hue ∈ {ember, cyan, amber, success, danger}` (see §3).
- Type scale `FONT` (17/20/24 body ladder × user choice), `TOUCH`
  (48/56/68/72 floors), `SPACE`, `RADIUS` (+`xl: 28`), `ELEVATION`
  (shadow* + elevation — react-native-web 0.21 ignores modern
  `boxShadow` strings, so the presets stay).

### Legacy alias mapping (transitional — 18 screens still compile through it)

| Legacy | Means | Modern replacement |
|---|---|---|
| `bg` | screen background | `background` |
| `surface` | card fill | `surfaceContainer` |
| `surfaceHigh` | pressed fill | `surfaceContainerHigh` |
| `text` | body text | `onSurface` |
| `textSecondary` | muted text | `onSurfaceVariant` |
| `accent` | highlight (light: warm brown, dark: amber) | `secondary` / `tertiary` |
| `danger` | error | `error` |
| `border` | interactive outline | `outline` |
| `hairline` | decorative separator | `outlineVariant` |

Alias removal = mechanical follow-up; nothing in new code may add
references.

## 2. The palettes

### Light "Warm Companion" (default)

Cool-white M3 surfaces, terracotta primary. `background #F7F9FF`,
container ladder `#FFFFFF → #F1F4F9 → #EBEEF3 → #E5E8EE → #E0E3E8`,
`onSurface #181C20`, `onSurfaceVariant #56423C` (warm brown), primary
`#8A2F10`, secondary `#6F3B0C`, tertiary `#544C46`, error `#971B15`,
`ctaFill #8A2F10` + white label (8.42:1).

### Dark "Luminous Hearth"

Obsidian navy surfaces, ember CTAs, cyan + amber accents.
`background #0B1325`, ladder `#060E1F → #131B2D → #171F31 → #222A3C →
#2D3548`, `surfaceBright #31394C`, `onSurface #DAE2FB`,
`onSurfaceVariant #DFC0B5`, primary `#FFB59A`, primaryContainer **ember
`#FF7A45`**, secondary `#7BD0FF`, tertiary amber `#F9BD22`, error
`#FFB4AB`, `ctaFill #FF7A45` + `#1A0600` label (7.59:1; also 7.00 on the
gradient's second stop).

### High contrast

All surfaces `#000000`, all content/fills/outlines `#FFFFFF`, all
`on*`/`ctaLabel`/`onSoft` `#000000`. Gradients and tints are skipped by
the components (3 px white borders carry the structure instead); TINT is
all-black so the same code paths keep working.

### Documented nudges (design.md → shipped)

Only **"on" colors / label carriers** were darkened to clear AAA; hues
are untouched. Light `primaryContainer #BD5630` is demoted to
decorative-only (white label caps at 4.6:1 there).

| # | Role | Design | Shipped | Why |
|---|---|---|---|---|
| L1 | light primary / ctaFill | `#9D3E1A` | `#8A2F10` | white label 6.69 → 8.42 |
| L2 | light secondary | `#8E4E14` | `#6F3B0C` | 6.46 → 9.10 |
| L3 | light tertiary | `#655A52` | `#544C46` | 6.69 → 8.40 |
| L4 | light error | `#BA1A1A` | `#971B15` | 6.46 → 8.46 |
| L5 | success (both uses) | app's `#146038` | light `#0F5A31` | as text on the container fill 6.54 → 7.15 (StatPill numbers) |
| D1 | dark onPrimary family | `#5B1B00`/`#672000` | `#1A0600` | 4.55 → 7.59 on ember; one label token covers both `#FFB59A` and `#FF7A45` fills |
| D2 | dark onTertiaryContainer | `#402D00` | `#1D1300` | 5.10 → 7.09 on `#CC9900` |

### Consciously accepted non-passes (asserted nowhere, on purpose)

- White on light `primaryContainer #BD5630` (4.6) — the container is
  decorative-only in light; labels use `ctaFill`/`primary` instead.
- `onSurfaceVariant` on dark `surfaceBright` (6.78) — `surfaceBright`
  never carries text; `onSurface` passes (asserted).
- Light nudged `error` on `errorContainer` — text there is
  `onErrorContainer #93000A` (7.24, asserted).
- Light `tertiaryContainer #7F726A` carries no text at all.

## 3. Tint discipline (emoji tiles, badges, tinted cards)

Icons are **emoji in tinted tiles** — no icon font. `IconTile` renders
the glyph hidden from assistive tech on a solid `TINT` fill; `TINT` is
precomputed (not runtime alpha) so the gate can assert the exact pair:

- **Light** mixes the *container* hue over white:
  ember `primaryContainer·12%`, cyan `secondaryContainer·18%`, amber
  `tertiaryContainer·18%`, success·12%, danger·12% → labels are
  `onSurface` (≥13:1), cyan may also use `onSecondaryContainer` (7.64).
- **Dark** mixes the *bright accent* over `surfaceContainer`:
  ember/cyan/success/danger 14%, amber 12% → StatusBadge labels are the
  bright accent of the same hue (7.14–7.84, asserted); body text
  (`onSurface`) also passes on every dark tint (≥9.2, asserted).
- **Contrast** skips tints: black fill + 3 px white border.
- Alphas are load-bearing (dark amber at 16% fails AAA). The gate
  recomputes every composite with `mix()` and hard-fails on a 1-channel
  drift against `TINT`.
- Never put colored text on a tint in light — colored text only on plain
  container surfaces (asserted pairs exist for exactly that).

## 4. Component inventory

All in `src/components/`, all backward-compatible:

- **`IconTile`** `{emoji, size 44|48|56, shape square|circle, hue}` —
  the workhorse; glyph a11y-hidden.
- **`bits`** — `StatusBadge` (tinted pill; dark labels = hue accent),
  `FilterPills` (single-select, all options visible, no horizontal
  scroll), `QuoteWell` (inset italic quote with CTA spine), `StatPill`
  (real number + label as one announcement; callers pass real counts or
  don't render), `TrustNote` (🔒 line).
- **`BigButton`** — primary wears `ctaFill`/`ctaLabel`; optional
  `eyebrow` (two-line CTA) and `gradient` (two-stop ember; skipped in
  contrast); each variant reads its own on-color (`onSuccess`,
  `onError`, `onSoft`). Spring press dies under reduce-motion.
  `IconAction` = cyan-tinted pill (read-aloud).
- **`ui`** — `Card` (+`variant: "amber"|"danger"|"cyan"` tint),
  `SettingsRow` (IconTile + `hue`), `Avatar` (3 px gradient ring, white
  ring in contrast, `badge: "verified"|"volunteer"` folded into the
  a11y label; expo-image Authorization header untouched),
  `Title/Body/EmptyState/ErrorState/ProfileLine`.
- **`fields`** — `TextField` (66 px rest height, 2 px CTA focus ring),
  `RadioRow` (selection card: 44 px tile bleached when selected, 2 px
  ctaFill border, primarySoft fill, rounded-square check), `Chip`
  (`as="select"` pill / `as="tag"` static), `SectionHeader`, `ChipGrid`.
- **`StepProgress`** — optional `steps: string[]` numbered pills; done
  pills invert (ctaFill + ctaLabel).
- **`Screen`** — flat circle nav buttons, 800-weight title, cyan
  read-aloud pill, footer on `surfaceContainerLowest`.
- **`Toast` / `DialogHost`** — token reskin only, behavior unchanged.

## 5. Honest-data rules (visuals may never invent facts)

- No fake counters: every StatPill/badge number comes from a live query
  (home counts, nearby hero count — absent entirely when zero).
- No unread dot on chats: the API has no read state; a dot would lie.
- No `tel:` to masked numbers: the settings emergency card shows name +
  `phone_masked` text and the SOS button — nothing dials.
- No dead controls: the nearby card's single action is "I can join"
  (chat requires a match, so there is no Message button).
- Filter-empty state says so instead of reusing the "nothing nearby"
  copy.

## 6. Type & motion decisions

- **Font**: Plus Jakarta Sans loads on web (public/index.html) but is
  NOT set as a global native font — RN has no default-font mechanism and
  ~0 `fontFamily` props exist, so a native rollout would mean touching
  every `Text`. Follow-up: an `<AppText>` wrapper migration, then PJS
  everywhere.
- **Motion**: the only animations are the ≤200 ms fade transitions and
  the 3% button spring — both vanish under the OS reduce-motion setting.

## 6b. Responsive & safe areas (phones + tablets, any orientation)

The app rotates freely (`app.json` orientation `"default"`,
`ios.supportsTablet`). Three primitives in `src/theme.ts`:

- `BREAKPOINTS { medium: 600, expanded: 900 }` + `useBreakpoint()` —
  wraps `useWindowDimensions`, re-renders on rotation.
- `COLUMN { width: "100%", maxWidth: 720, alignSelf: "center" }` — the
  **reading column**. Merged into every `Screen` body/footer and tab
  screen `contentContainerStyle`; phones never reach the cap (pixel-
  identical), tablets/landscape/desktop web get a centered column instead
  of stretched content. The floating tab bar caps/centers at the same
  width; toasts cap at 480; dialogs at 420.
- Grids **inside** the column, not layout swaps: home's two quick paths
  go two-up at `isWide`, `ChipGrid` wraps naturally, StatPills wrap on
  tiny widths. Nearby cards stay single-column (dense cards read better
  stacked). No two-pane anywhere — one task per screen, elderly-first.

Safe areas: `useSafeAreaInsets` everywhere spacing meets an edge —
`Screen` header/footer/body, tab bar + scenes, tab screens, welcome,
toasts, chat header/composer/list. Web insets are zero (no change there).
Keyboard: `Screen` has `avoidKeyboard` (iOS padding; Android resizes) —
used by wizard, details, contacts, feedback, phone, code; and
`keyboardShouldPersistTaps="handled"` always, so one tap works behind the
keyboard. `scroll={false}` lets a screen host its own virtualized list
(nearby is a FlatList — the only unbounded one). Avatars: `cachePolicy
="memory-disk"`, `transition` (0 under reduce-motion), initials fallback
on error, `recyclingKey` via `imageKey` in lists.

Deferred for lack of honest data: the mockup profile's **availability
schedule** (days + time slots) — no schema/API fields exist; needs server
work (a `profile_availability` table + endpoints) before any UI.

## 7. Verification loop

```sh
npm run check:contrast   # 127 pairs, all themes — CI gate
npx tsc --noEmit         # includes EL/EN i18n key parity
npx expo export --platform web   # build check
```

Manual matrix for redesigns: welcome → phone → code → profile → home →
wizard (3 steps) → nearby → chats → plan → sos → settings, in
light/dark/contrast × normal/large/xlarge, plus reduced-motion and a
screen-reader pass on the new pills (IconTile glyphs must stay hidden).
