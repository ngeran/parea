# Parea — Deployment & Release Runbook (Phase 7)

Everything needed to go from this repo to production, in order. Each step is
copy-pasteable; placeholders you must fill in are marked `<...>`.

## 0. Accounts you need (plan §10, open questions 3–4)

| Account | Needed for | Notes |
|---|---|---|
| Cloudflare (paid or free) | Worker, D1, R2, Pages | The only hard requirement. |
| Twilio account + Greek number | SMS OTP + trusted-contact alerts | Not needed until step 5. |
| Expo account (free) | EAS builds + push notifications | `eas login`. |
| Apple Developer ($99/yr) | iOS store submission | Only for release. |
| Google Play ($25 once) | Android store submission | Only for release. |

## 1. Cloudflare resources (one-time)

```bash
cd apps/server
npx wrangler login
npx wrangler d1 create parea                 # → copy the real database_id
npx wrangler r2 bucket create parea-photos
```

Put the real `database_id` from the output into `wrangler.jsonc` (replacing
the zero placeholder), then apply the schema:

```bash
npx wrangler d1 migrations apply parea --remote
```

## 2. Secrets (Worker)

```bash
npx wrangler secret put OTP_PEPPER            # generate: openssl rand -hex 32
# — the Twilio live switch (step 5):
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER    # the +30… sender number
```

Push needs **no** server secret: Expo push tokens are project-bound and the
send endpoint accepts unauthenticated calls.

## 3. Production flags in `wrangler.jsonc` (at launch)

- `OTP_MOCK`: `"1"` → **`"0"`** (dev returns SMS codes in API responses — never in production)
- `ALLOWED_ORIGINS`: add the final web/Pages origin
- `ENVIRONMENT`: `"development"` → `"production"`

The deployed admin dashboard comes from `apps/admin/dist` (`npm run build:admin`
runs first in CI). The web client deploys separately to Cloudflare Pages
(`.github/workflows/deploy-web.yml`).

## 4. Twilio setup (the "live switch")

1. Buy a number with **SMS capability** in the Twilio console (Greece or any
   region you serve; the sender text templates are en+el).
2. Set the three `TWILIO_*` secrets above.
3. That's the whole switch — `src/lib/sms.ts` sends via the REST API whenever
   the secrets exist and stays a no-op (logged) when they don't. `OTP_MOCK=0`
   makes `/otp/request` fail with a clear error if SMS isn't configured, so
   production can never silently skip sending codes.

## 5. EAS builds + push

```bash
cd apps/client
npm i -g eas-cli && eas login
eas init                       # → prints a project id
```

Put that id into `app.json → extra.eas.projectId` (replacing the zero
placeholder — push registration reads it at runtime).

Decide the **bundle identifiers** before the first store upload (they are
permanent): `app.json → ios.bundleIdentifier` and `android.package`
currently `gr.parea.app` — change to a reverse-DNS domain you control if
that one isn't yours.

Local test build:

```bash
eas build --profile preview --platform android   # installable APK for pilots
```

CI builds on `v*` tags via `.github/workflows/eas-build.yml` (needs the
`EXPO_TOKEN` repo secret: Expo console → Access Tokens).

## 6. Web + admin URLs

- API + admin dashboard: the Worker (`parea-api.<subdomain>.workers.dev/admin`)
- Web client: Cloudflare Pages project `parea-web` (deploy-web.yml)
- Custom domain (optional, plan open question 4): add the domain to the Worker
  (`wrangler.jsonc routes`) and Pages, then update `ALLOWED_ORIGINS` and the
  `EXPO_PUBLIC_API_URL` env in `eas.json` (preview/production profiles).

## 7. GitHub secrets (CI/CD)

| Secret | Used by |
|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy-server.yml, deploy-web.yml (Workers + Pages + D1 permissions) |
| `EXPO_TOKEN` | eas-build.yml |

## 8. Store submissions

Listing texts, privacy-label answers and screenshot checklist:
`docs/STORE-LISTINGS.md`. Privacy policy (required by both stores):
`docs/PRIVACY-POLICY.md` — host it at a public URL and link it in both store
consoles + the app's privacy screen.

## 9. Verify a fresh deployment

```bash
curl https://<worker-domain>/health                                   # {"ok":true}
curl -X POST https://<worker-domain>/otp/request \
  -H 'content-type: application/json' -d '{"phone":"+30…"}'           # real SMS arrives
```

Then on a device: sign up → nearby/discover → chat (WS) → plan → check-in →
SOS SMS lands at the trusted contact. Admin queue at `/admin`.

## 10. Rollback

```bash
npx wrangler rollback                      # Worker to previous version
npx wrangler d1 time restore               # point-in-time D1 (30 days)
```

Client rollbacks are store-mediated (phased release / staged rollout); keep
the previous `version` in `app.json` for a fast re-submit.
