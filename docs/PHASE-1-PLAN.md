# Together — Phase 1: Architecture & Design Plan

Companionship app for seniors (65+). iOS, Android and web from one codebase.
Not a dating app — help lonely seniors find nearby people for everyday company and practical help.

Working title: **Together** (repo: `ngeran/together`).

---

## 1. Confirmed decisions

| Decision | Choice | Notes |
|---|---|---|
| Client | Expo (React Native) + TypeScript + Expo Router | One codebase: iOS, Android, web (React Native Web) |
| Styling | NativeWind (Tailwind) + central design-token file | Tokens are the single source of truth (§4) |
| Backend | **Cloudflare Workers + D1 (SQLite)** | User decision — overrides the prompt's Supabase default. D1 is only a database, so the backend is a Worker API in front of it |
| Realtime chat | Durable Objects (WebSocket per match) | Replaces Supabase Realtime |
| Live in-app updates | `UserEvents` Durable Object — one WebSocket per user, foreground | New responses, matches and nearby requests appear in-place; push covers background |
| Photo storage | Cloudflare R2 | Replaces Supabase Storage; uploads go through the Worker |
| Auth | Phone number + SMS OTP (Twilio), session tokens | Replaces Supabase Auth. No passwords, ever |
| Admin dashboard | Vite + React | User decision. Served as static assets, calls the same Worker API |
| Push notifications | Expo Push (APNs / FCM) | Unchanged from prompt |
| Languages | English + Greek at launch, i18next | Unchanged from prompt |

### What the Cloudflare pivot changes (vs. the prompt's Supabase spec)

| Prompt assumed (Supabase) | We build instead |
|---|---|
| PostGIS radius queries | Lat/lng REAL columns snapped to a ~500 m grid, bounding-box prefilter + exact haversine (§3.1) |
| Row Level Security on every table | Clients **never** talk to the database. All access goes through the Worker API, which enforces an explicit per-endpoint authorization matrix, proven by automated tests (§3.2) |
| Supabase Auth (phone OTP) | Worker endpoints + Twilio SMS + hashed OTP codes + session table (§3.3) |
| Supabase Realtime | Durable Object per match: WebSocket fan-out, history persisted to D1 (§3.4) |
| Edge Functions | Regular Worker routes + Cron Triggers for scheduled jobs (§3.6) |
| Supabase Storage | R2 bucket, uploads proxied through the Worker (§3.5) |

Everything else in the product spec (UX rules, safety features, screens, data model shape) is unchanged.

---

## 2. Architecture

```
                        ┌──────────────────────────────────────┐
                        │            Cloudflare                │
                        │                                      │
 Expo app (iOS/Android) │   ┌────────────────────────────┐     │
 web (RN Web) ──────────┼──▶│  Worker API (Hono router)  │     │
                        │   │                            │     │
                        │   │  /auth /me /requests       │──┐  │
 Vite admin (browser) ──┼──▶│  /discover /matches /chat  │  │  │
   (static assets,      │   │  /plans /safety /admin     │  │  │
    /admin path,        │   └───────┬──────────┬─────────┘  │  │
    admin-role gated)   │           │          │            │  ▼
                        │           ▼          ▼            │  Twilio
                        │   ┌──────────┐ ┌───────────────┐ │  (SMS OTP,
                        │   │   D1     │ │ Durable Objs: │ │   trusted-
                        │   │ (SQLite) │ │  ChatRoom     │ │   contact
                        │   └──────────┘ │  UserEvents   │ │   alerts)
                        │                │  (chat + live │ │
                        │                │   events per  │ │
                        │                │   user)       │ │
                        │                └───────────────┘ │
                        │   ┌──────────┐ ┌───────────────┐ │
                        │   │    R2    │ │ Cron Triggers │ │
                        │   │ (photos) │ │ (§3.6)        │ │
                        │   └──────────┘ └───────────────┘ │
                        │                                  │
                        │   Worker ──▶ Expo Push API ──▶ APNs / FCM
                        └──────────────────────────────────────┘
```

- **One Worker** serves the JSON API, the admin static assets, and the WebSocket upgrade (routed to the Durable Object).
- **D1** is the single source of truth. The ChatRoom DO is a live fan-out hub; every message is written to D1 first, then broadcast.
- The mobile/web client never holds database credentials — only its session token.

### 3.1 Geo without PostGIS

- `profiles.lat/lng` and `requests.lat/lng` are `REAL`, **snapped to a ~500 m grid** before storage (round to 0.005°). Exact home location is never persisted — approximate by design, per the privacy rules.
- Radius query = two stages in one SQL statement:
  1. **Bounding-box prefilter** (index-friendly): `lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?` computed from `radius_km`.
  2. **Exact haversine filter** in SQL (D1 has SQLite math functions: `cos`, `sin`, `acos`, `radians`, `pi`). Fallback if any function is unavailable: fetch bbox candidates and filter in TypeScript in the Worker — trivial at this app's scale.
- Matching radius is user-controlled, 1–50 km (the radius slider).

### 3.2 Authorization (the "RLS replacement")

Every endpoint declares its rule; the matrix lives in `apps/server/test/auth-matrix.test.ts` and fails CI if an endpoint is untested. Examples:

| Endpoint | Rule |
|---|---|
| `GET /requests/nearby` | Any active, verified-session user; blocked users filtered out |
| `PATCH /requests/:id` | Owner only |
| `GET /matches/:id/messages` | Session user must be `user_a` or `user_b` of the match |
| `POST /plans/:id/safe-checkin` | Participant only |
| `GET /admin/*` | `profiles.role = 'admin'` only |

Plus: blocks are respected everywhere (no visibility in either direction), reports are write-only for users, OTP endpoints are rate-limited per phone and per IP.

### 3.3 Auth flow

1. `POST /auth/otp/request {phone}` → generate 6-digit code, store **hash** + expiry (5 min) + attempt counter in D1, send via Twilio. Rate limit: 3/phone/hour, 10/IP/hour.
2. `POST /auth/otp/verify {phone, code}` → on success create `sessions` row (random 256-bit token, only its hash stored), return token. Client stores it in secure storage (expo-secure-store / localStorage on web).
3. All requests carry `Authorization: Bearer <token>`; middleware resolves the session, rejects revoked/expired.
4. Dev mode: `OTP_MOCK=1` env makes the endpoint return the code in the response (never in production) so Phase 2–3 development is not blocked on a Twilio account.

### 3.4 Realtime — chat and live in-app updates

Two Durable Object classes; both plain WebSocket, identical on native and web.

**ChatRoom** — one per match.
- Client opens `WS /matches/:id/ws`.
- Send path: client → DO → `INSERT INTO messages` in D1 → broadcast to both participants' sockets → ack to sender.
- Reconnect/offline: on socket open the client fetches recent history from `GET /matches/:id/messages` (D1) — the DO is only a hub, never the store.
- Blocked users' sockets are closed server-side on block.

**UserEvents** — one per signed-in user (`WS /events`), the "live everywhere" channel:
- Connects while the app is in the foreground, closes on background (battery-friendly); same reconnect/backoff as chat.
- After every relevant D1 write, the Worker pushes an event to the affected users' DO, which fans out to their sockets.
- The client applies events straight into the TanStack Query cache (insert/invalidate) with a gentle cue — respecting reduced-motion and notification settings.

| Event | Sent to | Client does |
|---|---|---|
| `response.created` (someone joined my request) | request owner | live card appears |
| `request.accepted` (owner accepted → match) | responder | match + chat appear live |
| `match.created` (mutual Discover yes) | both users | chat appears live |
| `request.nearby` (new request within my radius) | users within radius, blocks excluded | insert into Nearby list |
| `message.new` | chat partner when that chat isn't the active screen | unread badge / cue |
| `plan.updated` / `checkin.confirmed` | match participants | live plan screen |

Nearby fan-out: on `request.created` the Worker runs the same bbox + haversine query (§3.1) and notifies only matching users — cheap at pilot scale (requests are day-scale, not second-scale). Everything also still goes out as a push notification when the app is backgrounded; UserEvents only removes the need to tap or refresh while the app is open.

### 3.5 Photos

- `PUT /me/photo` (multipart) → Worker validates type/size (≤ 5 MB, jpeg/png/heic) → `r2.put(key, body)` with key `photos/<user-id>/<uuid>`. Public read via Worker cache or public R2 domain; deletion on account delete / photo replace.

### 3.6 Scheduled jobs (Cron Triggers)

| Schedule | Job |
|---|---|
| every 15 min | **Safe check-in sweep**: plans whose `starts_at + 2h` passed with no `safe_checkin_at` → notify trusted contact (SMS and/or push) |
| hourly | Expire open requests past `starts_at` |
| daily 18:00 local | Reminder push for tomorrow's plans (opt-out in settings) |

### 3.7 Moderation (rule-based MVP)

On every message send: regex/heuristic scan — money-request patterns ("send money", IBAN/card numbers, crypto terms) are **held + flagged**, links are delivered but flagged. Flags land in the reports/moderation tables for the admin queue. Rate limits on messages and requests. ML scoring is a later phase.

### 3.8 Privacy / GDPR

- Consent checkbox (with version + timestamp stored) during sign-up before anything else.
- `GET /me/export` → JSON of every row belonging to the user + photo.
- `DELETE /me` → cascade delete profile, requests, messages, plans, photos; reports retained with the reporter's content anonymized (legal retention), never the deleted user's.
- Minimal collection: no exact location ever stored (§3.1), no contacts upload, no analytics beyond privacy-friendly counters.

---

## 3. Folder structure (npm workspaces monorepo)

```
together/
├── package.json                 # npm workspaces root (lint/test/typecheck scripts)
├── tsconfig.base.json
├── .github/workflows/
│   ├── ci.yml                   # lint + typecheck + tests on every PR
│   ├── deploy-server.yml        # wrangler deploy on main
│   ├── eas-build.yml            # iOS/Android builds on tag
│   └── deploy-web.yml           # client web + admin deploy
│
├── packages/shared/             # shared by client, server, admin
│   └── src/
│       ├── types.ts             # Profile, Request, Match, Plan, …
│       ├── schemas.ts           # zod validation schemas (API contract)
│       ├── activities.ts        # activity catalog + i18n keys
│       └── notifications.ts     # push/SMS text templates (en/el)
│
├── apps/client/                 # Expo app (iOS / Android / web)
│   ├── app/                     # expo-router file-based routes
│   │   ├── _layout.tsx          # providers: theme, text size, i18n, query
│   │   ├── index.tsx            # auth gate → onboarding or tabs
│   │   ├── onboarding/
│   │   │   ├── welcome.tsx      # + text size picker (screen 1)
│   │   │   ├── phone.tsx        # phone sign-in (screen 2)
│   │   │   ├── code.tsx         # SMS code entry
│   │   │   └── profile.tsx      # profile setup (screen 3)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx      # 3 labeled tabs: Home / My plans / Settings
│   │   │   ├── home.tsx         # three large buttons
│   │   │   ├── plans.tsx        # plan list
│   │   │   └── settings.tsx
│   │   ├── requests/new.tsx     # create-request 3-step wizard
│   │   ├── nearby.tsx           # nearby requests list + map toggle
│   │   ├── discover.tsx         # one-card-at-a-time, Yes / Not now
│   │   ├── chat/[matchId].tsx
│   │   ├── plans/[id].tsx       # plan details + I'm safe
│   │   └── settings/…           # text size, radius, trusted contacts, privacy…
│   ├── src/
│   │   ├── components/          # BigButton, Screen, ConfirmDialog, Chip,
│   │   │                        # LabeledRow, SizeSlider… (all accessibility-
│   │   │                        # preconfigured: roles, labels, min sizes)
│   │   ├── features/            # TanStack Query hooks per feature
│   │   ├── lib/                 # api.ts, session.ts, speech.ts, voice.ts,
│   │   │                        # location.ts, calendar.ts
│   │   ├── theme/tokens.ts      # ← THE design tokens (§4)
│   │   ├── i18n/                # en.json, el.json, index.ts
│   │   └── store/               # zustand: session, textSize, language
│   ├── metro.config.js          # monorepo watchFolders
│   ├── tailwind.config.js       # reads theme/tokens.ts
│   ├── app.json
│   └── package.json
│
├── apps/server/                 # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts             # Hono app, mounts routes, error handler
│   │   ├── env.ts               # typed bindings (DB, R2, DO, secrets)
│   │   ├── middleware/auth.ts   # session → user; requireAdmin
│   │   ├── routes/
│   │   │   ├── auth.ts          # otp/request, otp/verify, logout
│   │   │   ├── me.ts            # profile, photo, location, export, delete
│   │   │   ├── requests.ts      # create, nearby, respond, accept
│   │   │   ├── discover.ts      # cards, decision (mutual yes → match)
│   │   │   ├── matches.ts       # list, messages, ws upgrade
│   │   │   ├── plans.ts         # create, update, share, safe-checkin
│   │   │   ├── safety.ts        # report, block, sos
│   │   │   └── admin.ts         # users, reports, verifications, stats
│   │   ├── geo.ts               # snap-to-grid, bbox + haversine SQL builder
│   │   ├── moderation.ts        # scam heuristics
│   │   ├── push.ts              # Expo Push sender
│   │   ├── sms.ts               # Twilio sender
│   │   └── do/
│   │       ├── ChatRoom.ts      # Durable Object: chat fan-out per match
│   │       └── UserEvents.ts    # Durable Object: live events per user
│   ├── migrations/0001_init.sql # D1 schema (§5)
│   ├── seed.sql                 # dev/test seed users around a center point
│   ├── test/                    # vitest + @cloudflare/vitest-pool-workers
│   │   ├── auth-matrix.test.ts  # the authorization matrix (§3.2)
│   │   ├── geo.test.ts
│   │   └── moderation.test.ts
│   ├── wrangler.jsonc           # d1 binding, r2 bucket, DO, cron, secrets
│   └── package.json
│
├── apps/admin/                  # Vite + React dashboard
│   ├── src/
│   │   ├── pages/               # Login, Users, Reports, Verifications, Stats
│   │   ├── api.ts               # same Worker API, admin token
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json             # build output served by the Worker at /admin
│
└── docs/                        # this file, phase notes, audit checklists
```

No heavy monorepo tooling (no turborepo/nx) — plain npm workspaces.

---

## 4. Design tokens

Single source: `apps/client/src/theme/tokens.ts`, consumed by NativeWind via `tailwind.config.js`. Three user-selectable text levels chosen at onboarding, changeable in Settings.

### 4.1 Typography (px, per text level)

| Token | Normal | Large | Extra large | Usage |
|---|---|---|---|---|
| `font.body` | 20 | 23 | 26 | all body text (minimum 20 always) |
| `font.label` | 18 | 21 | 23 | chips, secondary labels (absolute floor 18) |
| `font.button` | 22 | 25 | 29 | every button label |
| `font.title` | 28 | 32 | 36 | screen titles |
| `font.hero` | 34 | 39 | 44 | welcome headline |

Line height ≈ 1.4 everywhere. Font: system font stack (largest, most legible option on every platform; no custom font in MVP).

### 4.2 Touch & spacing

| Token | Value |
|---|---|
| `touch.min` | 56 × 56 px (absolute floor for anything tappable) |
| `touch.button` | height 64, full width for primary actions |
| `touch.row` | list rows ≥ 88 px tall |
| `touch.gap` | ≥ 16 px between adjacent targets |
| `space` scale | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 |
| `screen.padding` | 24 |
| radius | `sm 12` · `md 16` (cards) · `lg 24` · `pill 999` (buttons) |

### 4.3 Colors (light theme draft; every pair validated ≥ 7:1 in the Phase 6 audit)

| Role | Value | Contrast (vs. its background) |
|---|---|---|
| `bg` | `#FFFFFF` | — |
| `surface` | `#F5F7FA` | — |
| `text` | `#1A1C1E` on `bg` | ≈ 16.9:1 |
| `textSecondary` | `#44474A` on `bg` | ≈ 9.5:1 |
| `primary` | `#0A4D8C` (buttons) — white label on it | ≈ 8.6:1 |
| `primarySoft` | `#DCEAF8` / text `#0A3A6B` | ≈ 9:1 |
| `success` | `#146038` — white label | ≈ 7.4:1 |
| `danger` | `#B3261E` — white label | ≈ 7:1 |
| `focusRing` | `#0A4D8C`, 3 px, always visible for keyboard/switch control | — |

Themes: `light` (default), `dark` (`bg #101214`, text `#FFFFFF`, primary `#9CC9F5`), `highContrast` (pure black/white, 3 px borders on all interactive elements). User picks in Settings; OS dark-mode and reduced-motion are always respected.

### 4.4 Motion

Fade/opacity only, ≤ 200 ms. No parallax, no swipe-required gestures, everything animatable is disabled under reduced motion.

---

## 5. Data model (D1 / SQLite)

Shape follows the prompt's model; SQLite types + Cloudflare adaptations noted.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (uuid, = auth id), `phone` UNIQUE, `first_name`, `photo_r2_key`, `about`, `interests` (JSON), `languages` (JSON), `mobility` CHECK(`walk`/`ride`/`home`), `verified` INT, `role` (`user`/`admin`), `lat` REAL, `lng` REAL (snapped), `radius_km` INT (1–50), `text_size`, `theme`, `language`, `status` (`active`/`disabled`), `consent_version`, `consent_at`, `created_at` | |
| `trusted_contacts` | `id`, `user_id`, `name`, `phone`, `relationship`, `notify` INT | family member; may not be an app user → SMS |
| `otp_codes` | `phone` PK, `code_hash`, `expires_at`, `attempts`, `last_sent_at` | |
| `sessions` | `token_hash` PK, `user_id`, `expires_at`, `revoked` | logout/revocation supported |
| `devices` | `user_id`, `push_token`, `platform` | multiple devices per user |
| `requests` | `id`, `user_id`, `activity`, `starts_at`, `place_type`, `lat`, `lng` (snapped), `radius_km`, `status` (`open`/`matched`/`done`/`cancelled`), `created_at` | idx on `lat`,`lng`,`status` |
| `responses` | `id`, `request_id`, `responder_id`, `status` (`offered`/`accepted`/`declined`), UNIQUE(`request_id`,`responder_id`) | |
| `matches` | `id`, `user_a`, `user_b`, `source` (`discover`/`request`), `created_at`, `status` (`active`/`ended`) | **unified**: both a mutual discover-yes and an accepted request-response create one row — chat and plans always attach here |
| `messages` | `id`, `match_id`, `sender_id`, `body`, `flagged` INT, `created_at` | idx (`match_id`,`created_at`) |
| `plans` | `id`, `match_id`, `place_name`, `place_lat`, `place_lng`, `starts_at`, `status` (`planned`/`done`/`cancelled`), `safe_checkin_at`, `shared_with_contact_at` | public place names only |
| `reports` | `id`, `reporter_id`, `target_id`, `reason`, `details`, `status` (`open`/`actioned`/`dismissed`), `created_at` | |
| `blocks` | `blocker_id`, `blocked_id`, PK both | |
| `verification_submissions` | `id`, `user_id`, `r2_key`, `status`, `reviewed_by`, `created_at` | photo/ID badge review |
| `moderation_events` | `id`, `type`, `actor_id`, `target_id`, `meta` JSON, `created_at` | audit trail |

Cascade rules: deleting a user removes their profile, requests, responses, messages, plans, devices, sessions, photo objects; reports keep an anonymized reference.

---

## 6. API surface (sketch)

```
POST /auth/otp/request       { phone }
POST /auth/otp/verify        { phone, code }  → { token, profile }
POST /auth/logout

GET    /me                   PATCH /me        PUT /me/photo
POST   /me/location          { lat, lng }     # server snaps to grid
GET    /me/export            DELETE /me
GET/POST/PATCH/DELETE /me/trusted-contacts[/:id]

POST /requests               GET /requests/nearby?lat&lng&radius
GET  /requests/:id           POST /requests/:id/responses     # "I can join"
POST /responses/:id/accept   # owner accepts → creates match + thread

GET  /discover               # one card at a time, filtered by radius/blocks
POST /discover/:userId/decision   { yes | no }    # mutual yes → match

GET  /matches
GET  /matches/:id/messages   WS /matches/:id/ws               # ChatRoom DO
WS   /events                                                  # UserEvents DO (live updates)
POST /matches/:id/messages   # fallback when WS is down

POST /matches/:id/plan       PATCH /plans/:id
POST /plans/:id/share        # notify trusted contact (name, place, time)
POST /plans/:id/safe-checkin

POST /reports                POST /blocks      POST /sos

GET  /admin/users            POST /admin/users/:id/verify | disable
GET  /admin/reports          POST /admin/reports/:id/action
GET  /admin/verifications    POST /admin/verifications/:id/approve | reject
GET  /admin/stats
```

---

## 7. Screen-by-screen wireframes

Conventions for every screen: min body 20 px, targets ≥ 56 px, one primary action per screen, visible Back + Home, plain language, icons always with text labels.

### 7.1 Welcome + text size picker (screen 1 of onboarding)

```
┌──────────────────────────────────┐
│                                  │
│               🤝                 │
│                                  │
│        Welcome to Together       │        (font.hero)
│   Find company for everyday      │
│     things, with people near     │
│             you.                 │
│                                  │
│   How big should the text be?    │
│  ┌────────────────────────────┐  │
│  │ Aa   Normal                │  │   ← radio rows, 64 px tall,
│  └────────────────────────────┘  │     whole screen re-renders
│  ┌────────────────────────────┐  │     live at the chosen size
│  │ Aa   Large                 │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ Aa   Extra large           │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │         Continue           │  │   ← primary, 64 px
│  └────────────────────────────┘  │
│        Language: English ▾       │
└──────────────────────────────────┘
```

### 7.2 Phone sign-in (screen 2)

```
┌──────────────────────────────────┐
│  ← Back                          │
│                                  │
│    Sign in with your phone       │
│                                  │
│    Your phone number             │
│  ┌────────────────────────────┐  │
│  │ 🇬🇷 +30   69Χ ΧΧΧ ΧΧΧΧ     │  │   64 px input, big digits
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │        Send my code        │  │
│  └────────────────────────────┘  │
│                                  │
│  We send a code by SMS.          │
│  No password needed.             │
│  ☐ I agree to the privacy policy │   (consent stored w/ version)
└──────────────────────────────────┘

Code screen: 6 large boxes (auto-advance), "Wrong number? Go back",
big "Send a new code" — no silent timeouts, code never lost on typo.
```

### 7.3 Profile setup (screen 3 — 3 short steps, Back on each)

```
Step 1: Photo (big round upload button, skippable) + First name
Step 2: "About me" (voice input button) + interests as large chips,
        multi-select: ☕ Coffee  🌿 Garden  🚶 Walks  🍽 Cooking
        🎵 Music  📖 Books  🧵 Crafts  ⛪ Church  …
Step 3: Languages (Ελληνικά / English chips) + mobility, one choice:
        ( ) 🚶 I can walk easily
        ( ) 🚗 I need a ride
        ( ) 🏠 I prefer to stay close to home
        → [ Finish ] → Home
```

### 7.4 Home (tab 1)

```
┌──────────────────────────────────┐
│  Hi, Maria! 👋                   │
│                                  │
│  ┌────────────────────────────┐  │
│  │  ☕  I'D LIKE COMPANY       │  │   primary, 96 px tall
│  │      Ask people nearby     │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  👥  SEE WHO IS NEARBY     │  │   88 px
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  📅  MY PLANS          (2) │  │   88 px
│  └────────────────────────────┘  │
│                                  │
│  ┌──────┬──────────┬──────────┐  │
│  │ Home │ My plans │ Settings │  │   ← bottom bar, icons + labels,
│  └──────┴──────────┴──────────┘  │     64 px tall, labeled tab bar
└──────────────────────────────────┘
```

### 7.5 Create request (3 steps + confirm; Back + Home always visible)

```
Step 1 — What?        big activity chips, one tap selects
Step 2 — When?        Today / Tomorrow / Pick a day (calendar strip)
                      + Morning / Midday / Afternoon / Evening (or exact time)
Step 3 — Where?       place type chips: ☕ Café · 🛒 Supermarket · 🌳 Park
                      · 🚶 Walk route · 🏠 My home area · 📞 Just a call
                      + radius slider 1–50 km, big numbers read aloud
Confirm dialog: "Send this request? Maria, 68, within 10 km will see it."
                      [ Yes, send ]   [ No, go back ]
```

### 7.6 Nearby requests (list + map toggle)

```
┌──────────────────────────────────┐
│  ← Back     Nearby requests      │
│  Within: 10 km ▾     [List|Map]  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ☕ Coffee with company      │  │
│  │ Nikos, 71 · Tomorrow 11:00 │  │
│  │ ≈ 2 km away · Café         │  │
│  │ ┌──────────────────────┐   │  │
│  │ │     I can join       │   │  │  ← primary per card
│  │ └──────────────────────┘   │  │
│  └────────────────────────────┘  │
│  …                               │
│  Map view: Leaflet on web,       │
│  react-native-maps on native;    │
│  dots only, never addresses.     │
└──────────────────────────────────┘
```

### 7.7 Discover (one card, two huge buttons; swipe optional)

```
┌──────────────────────────────────┐
│  ← Back        Discover    3 km  │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │         ( photo )          │  │
│  │       Maria, 68            │  │
│  │  "I love gardens and the   │  │
│  │   sea. I make good bread." │  │
│  │  🚶 I can walk · Ελληνικά  │  │
│  │  ✔ Verified                │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌──────────────┐ ┌────────────┐ │
│  │ ✔ YES, LET'S │ │  ✖ NOT NOW │ │   each ≈ half width,
│  │    MEET      │ │            │ │   96 px tall
│  └──────────────┘ └────────────┘ │
│  Mutual "Yes" opens a chat —     │
│  both get a push notification.   │
└──────────────────────────────────┘
```

### 7.8 Chat

```
┌──────────────────────────────────┐
│ ← Maria   [ ⚠ Report ] [ ⛔ Block ]│  ← safety always one tap away
│                                  │
│        ┌──────────────────────┐  │
│        │ Kalimera, Maria! ☕  │  │   ≥ 22 px bubbles
│        └──────────────────────┘  │
│ ┌──────────────────────┐         │
│ │ Kalimera! Shall we?  │  [ ▶ ]  │  ▶ = read aloud (expo-speech)
│ └──────────────────────┘         │
│                                  │
│ Quick replies:                   │
│ [ Good morning! ] [ I'm on my    │
│  way! ] [ See you there! ]       │
│                                  │
│ ┌────────────────────┐ ┌───┐┌───┐│
│ │ Type or tap 🎤 …   │ │ 🎤││ ➤ ││  64 px input row,
│ └────────────────────┘ └───┘└───┘│  mic = speech-to-text
└──────────────────────────────────┘
Money-request / link patterns are filtered server-side (§3.7).
```

### 7.9 Plan details

```
┌──────────────────────────────────┐
│  ← Back         Our plan         │
│                                  │
│  ☕ Coffee with Maria             │
│  📅 Tomorrow, 11:00              │
│  📍 "Kafeneio Filion"            │     public place name only
│     (app suggests public places  │
│      for first meetings)         │
│                                  │
│  ┌────────────────────────────┐  │
│  │   📅 Add to calendar       │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 👨‍👩‍👧 Tell my trusted contact│  │  ← sends name+place+time
│  └────────────────────────────┘  │
│                                  │
│  After you meet:                 │
│  ┌────────────────────────────┐  │
│  │      ✓ I'M SAFE            │  │  big, green
│  └────────────────────────────┘  │
│  If we don't hear from you in    │
│  2 hours, we notify your         │
│  trusted contact.                │
│  [ 🆘 SOS ]                      │  always visible on this screen
└──────────────────────────────────┘
```

### 7.10 Settings

Plain rows, 64 px each, grouped:
**My account** (name, photo, about, interests) · **Text size** (3 big preview buttons — same as onboarding) · **Theme** (Light / Dark / High contrast) · **Search distance** (1–50 km slider) · **Notifications** · **Language** (Ελληνικά / English) · **My trusted contact** (name, phone, relationship) · **Privacy** (see my data / delete my account — both behind large Yes/No confirm dialogs) · **Log out**.

### 7.11 Admin dashboard (Vite, served at `/admin`, admin-role gated)

- **Login**: phone OTP (same API), checked against `role='admin'`.
- **Users**: search, view profile, verify / unverify, disable.
- **Reports queue**: open reports with message context, actions: dismiss / warn user / disable user.
- **Verifications**: submitted photo/ID review, approve / reject → sets `verified` badge.
- **Stats**: sign-ups, active users, open requests, matches, plans, safe check-ins missed — simple tables/counters (privacy-friendly, no tracking).

---

## 8. i18n

- i18next, `apps/client/src/i18n/en.json` + `el.json`; language picked at Welcome, stored in profile.
- Greek is a first-class launch language: every string, including push notifications and SMS texts (templates in `packages/shared/src/notifications.ts`), exists in both languages from day one. No icons without text labels in either language.
- Speech features use the right voice per message: `el-GR` / `en-US`.

## 9. Testing & CI mapping

| Layer | Tool |
|---|---|
| Client units + components | Jest + React Native Testing Library (tokens/a11y assertions: min sizes, labels) |
| Client web e2e | Playwright |
| Mobile e2e | Maestro |
| Worker API + authorization matrix | Vitest + `@cloudflare/vitest-pool-workers` (real D1/DO via miniflare) |
| Admin | Playwright |
| CI | GitHub Actions: lint + strict tsc + tests on PR; deploy Worker on main; EAS build on tag |

Sentry for crash reporting (client + worker), privacy-friendly counters only.

## 10. Assumptions

1. "cloudflare D1" is read as **Cloudflare Workers + D1 + Durable Objects + R2** — D1 is a database only; a Worker in front of it is required for auth, chat and file handling. Same product spec otherwise.
2. Twilio for SMS (OTP + trusted-contact alerts). Dev mock mode (§3.3) means no Twilio account is needed until release prep. A real account + number is needed before public testing.
3. Trusted contacts without the app get plain SMS alerts; users who install the app get push instead (cheaper — SMS cost is the only per-use external cost).
4. npm workspaces, Node LTS, npm (no pnpm/yarn, no monorepo tooling).
5. Age 65+ is self-declared at sign-up (no age verification in MVP).
6. D1 free/paid tier limits are comfortable for a pilot (single location hint EU).
7. Maps: Apple Maps on iOS (no key), Google Maps key on Android, Leaflet + OpenStreetMap on web (no key).

## 11. Phase mapping (adjusted for Cloudflare)

| Phase | Deliverable |
|---|---|
| 1. Plan | ✅ this document |
| 2. Backend | D1 migrations, Worker API (all routes), authorization-matrix tests, ChatRoom DO, haversine radius query, seed data, wrangler config |
| 3. Client MVP | onboarding → requests → nearby → discover → chat → plans, tokens + i18n |
| 4. Safety | trusted contact, check-in + cron sweep, SOS, report/block, moderation filter |
| 5. Admin | Vite dashboard + admin API |
| 6. Accessibility audit | VoiceOver/TalkBack checklist, contrast verification, fixes |
| 7. Release | EAS config, store listings, privacy policy template, Twilio live switch |

## 12. Open questions (non-blocking — none stop Phase 2)

1. Brand name/logo — "Together" assumed as working title.
2. Preferred SMS provider (Twilio assumed).
3. App Store / Google Play developer accounts exist? (needed only for Phase 7)
4. Custom domain for the Worker, or `*.workers.dev` for now?
