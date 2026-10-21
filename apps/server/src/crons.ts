// Scheduled jobs (see the triggers block in wrangler.jsonc):
//   every 15 min → safety net: "I'm safe" never confirmed → alert trusted contacts
//   hourly       → maintenance: expire stale requests, trim the OTP IP log
//   0 16 * * *   → daily plan reminders (16:00 UTC ≈ 18:00 Greece time)

import { pushText, smsText, type Lang } from "@parea/shared";
import { formatWhen } from "./lib/format";
import { pushToUser } from "./lib/push";
import { sendSms } from "./lib/sms";
import { DAY, HOUR, isoIn, nowIso } from "./lib/time";
import type { PlanRow, ProfileRow } from "./types";

export async function runCron(env: Env, cron: string, ctx: ExecutionContext): Promise<void> {
  if (cron === "*/15 * * * *") await sweepCheckins(env, ctx);
  else if (cron === "30 * * * *") await hourlyMaintenance(env);
  else if (cron === "0 16 * * *") await sendPlanReminders(env, ctx);
}

async function matchParticipants(env: Env, matchId: string): Promise<ProfileRow[]> {
  const match = await env.DB.prepare("SELECT user_a, user_b FROM matches WHERE id = ?")
    .bind(matchId)
    .first<{ user_a: string; user_b: string }>();
  if (!match) return [];
  const { results } = await env.DB.prepare(
    "SELECT * FROM profiles WHERE id IN (?, ?) AND status = 'active'",
  )
    .bind(match.user_a, match.user_b)
    .all<ProfileRow>();
  return results;
}

function lang(p: ProfileRow): Lang {
  return p.language === "en" ? "en" : "el";
}

/**
 * The safety net. A meeting that was shared with a trusted contact ended at
 * least 2 hours ago and the senior never tapped "I'm safe" → ask them in the
 * app AND text their trusted contacts. Runs every 15 minutes, marks each plan
 * once (checkin_missed_notified_at).
 */
async function sweepCheckins(env: Env, ctx: ExecutionContext): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM plans
     WHERE status = 'planned'
       AND starts_at <= ?
       AND starts_at >= ?
       AND shared_with_contact_at IS NOT NULL
       AND safe_checkin_at IS NULL
       AND checkin_missed_notified_at IS NULL`,
  )
    .bind(isoIn(-2 * HOUR), isoIn(-30 * DAY))
    .all<PlanRow>();

  for (const plan of results) {
    const participants = await matchParticipants(env, plan.match_id);
    for (const p of participants) {
      const l = lang(p);
      const when = formatWhen(plan.starts_at, l);
      pushToUser(env, ctx, p.id, {
        title: "Parea",
        body: pushText.checkinAsk(l),
        data: { plan_id: plan.id },
      });
      const { results: contacts } = await env.DB.prepare(
        "SELECT phone FROM trusted_contacts WHERE user_id = ? AND notify = 1",
      )
        .bind(p.id)
        .all<{ phone: string }>();
      for (const contact of contacts) {
        await sendSms(env, contact.phone, smsText.checkinMissed(l, p.first_name, plan.place_name, when));
      }
    }
    await env.DB.prepare("UPDATE plans SET checkin_missed_notified_at = ? WHERE id = ?")
      .bind(nowIso(), plan.id)
      .run();
  }
}

/** Housekeeping that never needs to be instant. */
async function hourlyMaintenance(env: Env): Promise<void> {
  await env.DB.batch([
    // Requests whose time passed without a match simply expire.
    env.DB.prepare("UPDATE requests SET status = 'done' WHERE status = 'open' AND starts_at <= ?").bind(
      nowIso(),
    ),
    env.DB.prepare("DELETE FROM otp_ip_log WHERE at < ?").bind(isoIn(-2 * HOUR)),
  ]);
}

/**
 * One reminder per plan, the evening before (or early the same day): a push
 * to both participants with place and time. Runs daily at 18:00 Greece time.
 */
async function sendPlanReminders(env: Env, ctx: ExecutionContext): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM plans
     WHERE status = 'planned' AND starts_at >= ? AND starts_at <= ?
       AND reminder_sent_at IS NULL`,
  )
    .bind(isoIn(6 * HOUR), isoIn(30 * HOUR))
    .all<PlanRow>();

  for (const plan of results) {
    const participants = await matchParticipants(env, plan.match_id);
    for (const p of participants) {
      const l = lang(p);
      pushToUser(env, ctx, p.id, {
        title: "Parea",
        body: pushText.planReminder(l, plan.place_name, formatWhen(plan.starts_at, l)),
        data: { plan_id: plan.id },
      });
    }
    await env.DB.prepare("UPDATE plans SET reminder_sent_at = ? WHERE id = ?")
      .bind(nowIso(), plan.id)
      .run();
  }
}
