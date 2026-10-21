// Phone + SMS-code authentication. No passwords, ever.
// Flow: POST /otp/request → code by SMS (or dev_code in mock mode)
//       POST /otp/verify  → session token (+ new profile on first sign-in)

import { Hono } from "hono";
import { otpRequestSchema, otpVerifySchema, smsText } from "@together/shared";
import { AppError } from "../errors";
import { createSession, revokeSession } from "../lib/auth";
import { hmacHex, randomOtpCode, secretsEqual } from "../lib/crypto";
import { selfProfile } from "../lib/serialize";
import { sendSms } from "../lib/sms";
import { HOUR, MIN, isoIn, nowIso, secondsSince } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, ProfileRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

const CODE_TTL_MS = 5 * MIN;
const RESEND_COOLDOWN_S = 60;
const MAX_PER_HOUR = 3;
const MAX_ATTEMPTS = 5;

app.post("/otp/request", async (c) => {
  const { phone } = otpRequestSchema.parse(await c.req.json());

  const pepper = c.env.OTP_PEPPER;
  if (!pepper) {
    throw new AppError(500, "config_missing", "OTP_PEPPER secret is not set.");
  }

  // Per-phone limits: 60 s cooldown, at most MAX_PER_HOUR codes per hour.
  const existing = await c.env.DB.prepare(
    "SELECT last_sent_at, hour_start, hour_count FROM otp_codes WHERE phone = ?",
  )
    .bind(phone)
    .first<{ last_sent_at: string; hour_start: string; hour_count: number }>();
  if (existing && secondsSince(existing.last_sent_at) < RESEND_COOLDOWN_S) {
    throw new AppError(429, "otp_cooldown", "Wait a minute before asking for a new code.");
  }
  const hourWindowOpen = existing !== null && existing.hour_start > isoIn(-HOUR);
  if (hourWindowOpen && existing.hour_count >= MAX_PER_HOUR) {
    throw new AppError(429, "otp_limit", "Too many codes for this number. Try again later.");
  }

  // Per-IP limit: at most 20 codes per hour ( abused devices get cut off ).
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const ipRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM otp_ip_log WHERE ip = ? AND at > ?",
  )
    .bind(ip, isoIn(-HOUR))
    .first<{ n: number }>();
  if ((ipRow?.n ?? 0) >= 20) {
    throw new AppError(429, "otp_limit", "Too many attempts. Try again later.");
  }

  const code = randomOtpCode();
  const codeHash = await hmacHex(pepper, `${phone}:${code}`);
  const hourStart = hourWindowOpen ? existing.hour_start : nowIso();
  const hourCount = hourWindowOpen ? existing.hour_count + 1 : 1;

  await c.env.DB.prepare(
    `INSERT INTO otp_codes
       (phone, code_hash, expires_at, attempts, last_sent_at, hour_start, hour_count)
     VALUES (?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       last_sent_at = excluded.last_sent_at,
       hour_start = excluded.hour_start,
       hour_count = excluded.hour_count`,
  )
    .bind(phone, codeHash, isoIn(CODE_TTL_MS), nowIso(), hourStart, hourCount)
    .run();

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO otp_ip_log (ip, at) VALUES (?, ?)").bind(ip, nowIso()),
    c.env.DB.prepare("DELETE FROM otp_ip_log WHERE at < ?").bind(isoIn(-2 * HOUR)),
  ]);

  let devCode: string | undefined;
  // ENVIRONMENT is a literal type from wrangler vars, hence the cast.
  if (c.env.OTP_MOCK === "1" && (c.env.ENVIRONMENT as string) !== "production") {
    // Mock mode: no SMS is sent, the code comes back in the response so
    // development is not blocked on a Twilio account.
    devCode = code;
  } else {
    const sent = await sendSms(c.env, phone, smsText.otp(code));
    if (!sent) {
      throw new AppError(503, "sms_failed", "Could not send the SMS. Please try again.");
    }
  }

  return c.json({ ok: true, ...(devCode ? { dev_code: devCode } : {}) });
});

app.post("/otp/verify", async (c) => {
  const { phone, code, consent_version } = otpVerifySchema.parse(await c.req.json());
  const pepper = c.env.OTP_PEPPER;
  if (!pepper) {
    throw new AppError(500, "config_missing", "OTP_PEPPER secret is not set.");
  }

  const row = await c.env.DB.prepare(
    "SELECT code_hash, expires_at, attempts FROM otp_codes WHERE phone = ?",
  )
    .bind(phone)
    .first<{ code_hash: string; expires_at: string; attempts: number }>();

  const invalid = new AppError(400, "otp_invalid", "That code is not valid. Try again.");
  if (!row) throw invalid;
  if (row.expires_at < nowIso()) {
    await c.env.DB.prepare("DELETE FROM otp_codes WHERE phone = ?").bind(phone).run();
    throw new AppError(400, "otp_expired", "The code expired. Please ask for a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await c.env.DB.prepare("DELETE FROM otp_codes WHERE phone = ?").bind(phone).run();
    throw new AppError(429, "otp_locked", "Too many tries. Please ask for a new code.");
  }

  const calculated = await hmacHex(pepper, `${phone}:${code}`);
  if (!(await secretsEqual(calculated, row.code_hash))) {
    await c.env.DB.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?")
      .bind(phone)
      .run();
    throw invalid;
  }
  await c.env.DB.prepare("DELETE FROM otp_codes WHERE phone = ?").bind(phone).run();

  let profile = await c.env.DB.prepare("SELECT * FROM profiles WHERE phone = ?")
    .bind(phone)
    .first<ProfileRow>();
  let isNewUser = false;
  if (!profile) {
    if (!consent_version) {
      throw new AppError(400, "consent_required", "Consent is required to create an account.");
    }
    isNewUser = true;
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO profiles (id, phone, consent_version, consent_at) VALUES (?, ?, ?, ?)",
    )
      .bind(id, phone, consent_version, nowIso())
      .run();
    profile = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
      .bind(id)
      .first<ProfileRow>();
  }
  if (!profile) throw new AppError(500, "internal", "Could not load the profile.");
  if (profile.status !== "active") {
    throw new AppError(403, "account_disabled", "This account is disabled.");
  }

  const token = await createSession(c.env.DB, profile.id);
  return c.json({ token, is_new_user: isNewUser, profile: selfProfile(profile) });
});

app.post("/logout", requireAuth, async (c) => {
  const header = c.req.header("Authorization") ?? "";
  await revokeSession(c.env.DB, header.slice("Bearer ".length));
  return c.json({ ok: true });
});
