# Parea — Phase 6: Accessibility Audit

Date: 2026-10-21 · Scope: `apps/client` (all 26 screens + shared components).
Method: programmatic WCAG contrast verification (script, all 3 themes × 15
pairs) + line-by-line review of every screen against the plan's conventions
(§4 tokens, §7 screen rules) and WCAG 2.2 AA/AAA where applicable.

**Result: 11 contrast failures and 35 usability findings found → all fixed.
Remaining manual work: on-device VoiceOver/TalkBack pass (checklist at the
end — cannot be automated here).**

---

## 1. Contrast verification (WCAG ≥ 7:1 text, ≥ 3:1 non-text)

Automated: `npm run check:contrast -w @together/client`
(`scripts/contrast-check.mjs`) — verifies every color pair the UI can
produce, in all three themes, and fails CI on any regression. Keep its
`THEMES` table in sync with `src/theme.ts`.

### Fixed in this phase

| Token | Before | After | Why |
|---|---|---|---|
| `light.danger` | `#B3261E` (6.5:1) | `#9E1F19` (7.9:1 / 7.4:1 on surface) | White labels on danger buttons + error text both failed AAA |
| `light.border` | `#C9CDD2` (1.6:1) | `#6A7076` (5.0:1) | Input/chip borders failed WCAG 1.4.11 non-text (3:1) |
| `dark.border` | `#3A3F44` (1.8:1) | `#71777D` (4.2:1) | Same — inputs were effectively invisible in dark mode |
| success label | hardcoded `#FFFFFF` | `c.onPrimary` | Dark mode: white on light-green was **1.7:1**; high contrast: white on white |
| soft/selected labels | `c.text` | new `c.onSoft` | High-contrast theme: `primarySoft` is white → white-on-white (**1:1**) on soft buttons, selected chips/radios, pressed rows |
| avatar initial | `c.primary` | `c.onSoft` | Same white-on-white failure in high contrast |

New token: **`onSoft`** — the label color for `primarySoft` fills. Equals
`text` in light/dark, `#000000` in the high-contrast theme.

## 2. Touch targets (≥ 56 px everywhere)

| Where | Was | Now |
|---|---|---|
| `Screen` Back / Home | 48 px | 56 px (+ horizontal padding) |
| Chat header Back / 📅 Make plan / 🚩 Report | 48 px | 56 px min |
| Chat 🔊 read-aloud per message | ~36 px, padding only | 56 × 56, icon + state |
| Home/Plans list cards | unbounded | `minHeight: 88` (`touch.row`) |

`BigButton`, `IconAction`, `SettingsRow`, `RadioRow`, `Chip`, `TextField`,
quick replies were already compliant.

## 3. Text sizes (3-level token scale, floors 20/18)

| Where | Was | Now |
|---|---|---|
| Tab bar labels | `max(14, label−3)` → 15 px | `f.label` (18–23 px); tab bar grown to 92 px |
| Chat header 📅/🚩 captions | `max(13, label−4)` → 14 px | `f.label` |
| `IconAction` caption | `max(14, label−4)` → 14 px | `f.label` |

## 4. Navigation: Back/Home visible everywhere

Four screens had **no Back control at all** (headers hidden globally):

- Discover → now uses the `Screen` shell (Back + 🔊 read-aloud of the card text)
- Nearby requests → `Screen` shell
- Request detail → `Screen` shell on all branches (loading, error, success)
- Plan detail → `Screen` shell on all branches

## 5. Errors never look like "empty" (rule: fail loudly)

- New shared `ErrorState` component: ⚠️ + danger text + **Try again** button,
  wrapped in `accessibilityLiveRegion="assertive"`.
- Added error+retry to: Home (my requests), Chats, Plans, Chat messages,
  Nearby, Discover, Request detail (+ its offers list), Plan detail,
  Trusted contacts. Previously every one of these rendered an empty state
  (or nothing) on failure.
- Discover Yes/Not-now failures were **swallowed silently** → now alerted.
- SOS outcome phases (sending / sent / nobody / failed) are now announced:
  live region + `AccessibilityInfo.announceForAccessibility` per phase —
  safety-critical feedback a screen-reader user can actually hear.

## 6. Destructive actions & dialogs

- Report screen: "Also block" (default ON, irreversible) now asks an explicit
  Yes/No before blocking (`confirmBlockTitle/Body`, en+el).
- SOS "I'm OK" stand-down now asks Yes/No before standing an active alert down.
- Alert-then-navigate fixed on 6 screens (discover, request new/detail, plan
  new, report, SOS): navigation now happens **on the OK tap**, never under a
  live alert — screen readers previously lost the announcement when the
  screen vanished.
- SOS send itself intentionally stays confirmation-free (speed beats
  friction when unsafe); documented at `sos.tsx:1-5`.

## 7. Motion, high-contrast theme, i18n

- Screen fade (200 ms) now **switches off entirely** when the OS
  reduce-motion setting is on (`reduceMotionChanged` listener in the root
  layout).
- High-contrast theme: all interactive elements (inputs, chips, radios,
  quiet buttons, cards, settings rows) get **3 px borders** (plan §4.3) —
  surface == bg there, so cards/rows were previously indistinguishable.
- All new strings exist in **both** English and Greek (`confirmBlock*`,
  `sosImOkConfirm*`).

## 8. Already compliant (verified, no change needed)

- Roles/labels/states on every button, radio, chip, switch, consent checkbox
- Screen-reader-friendly `ProfileLine` (name · age · verified as plain text)
- Chat bubbles read as one element with sender prefix; per-message 🔊
- Quick replies, tab bar (icon + text on all 4 tabs)
- OTP resend is a manual button (no silent countdown)
- No `Animated`/`LayoutAnimation` anywhere; fades only

## 9. Accepted deviations / follow-ups

| Item | Decision |
|---|---|
| `live.ts` reconnects silently forever | Accepted for MVP: queries refetch on focus, and any screen shows its own error state. Follow-up: a small "reconnecting…" pill. |
| Loading screens show the title twice (header "Loading" + body text) | Cosmetic; kept for Back availability on every branch. |
| Avatar initials are now near-black in light theme instead of blue | Consequence of the onSoft fix; contrast improved 7.0→14.0. |
| `IconAction` caption sits at the 18 px floor, larger than before | Intended: the old 14 px caption violated the label floor. |

## 10. Manual on-device checklist (Phase 6 remainder)

Cannot be verified from code — run with VoiceOver (iOS) and TalkBack (Android):

1. **Onboarding**: text-size picker re-renders live; consent checkbox announces
   its state; OTP code boxes auto-advance and are reachable in order.
2. **Home**: all five big buttons reachable with sensible labels; "Hi, {name}"
   announced as heading.
3. **Create request**: 3 wizard steps — Back works from every step; confirm
   dialog reads both buttons ("Yes, send" / "No, go back").
4. **Discover**: card read-aloud speaks name, age, about; both huge buttons
   announce; mutual-match alert announces before the chat opens (OK-tap
   navigation).
5. **Chat**: incoming message is announced automatically; 🔊 toggles to ⏹ and
   actually stops speech; Report/Block confirm reads the name.
6. **Plan**: "I'M SAFE" announces confirmation; SOS phases are spoken
   (sending → sent, with contact names).
7. **Settings**: theme switch to Dark and High contrast — walk 3 screens and
   confirm no invisible borders/text (verified programmatically, spot-check
   visually); text size applies everywhere immediately.
8. **Reduce motion**: enable OS setting → screen transitions are instant.
9. **Greek**: repeat 2–3 flows in el; check RTL-independent layout is fine
   (Greek is LTR — trivially yes) and no truncated labels at Extra large.
