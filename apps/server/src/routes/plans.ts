// Plans — who, where (public place), when. Sharing tells the trusted
// contact; the "I'm safe" check-in closes the loop after the meeting.

import { Hono } from "hono";
import { planCreateSchema, planUpdateSchema, pushText, smsText, type Lang } from "@together/shared";
import { AppError } from "../errors";
import { emitToUser } from "../lib/events";
import { formatWhen } from "../lib/format";
import { pushToUser, type WaitUntilCtx } from "../lib/push";
import { getMatchForParticipant, otherUserId } from "../lib/relations";
import { planDto } from "../lib/dto";
import { photoUrl } from "../lib/serialize";
import { sendSms } from "../lib/sms";
import { nowIso } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, PlanRow, ProfileRow, TrustedContactRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

async function planForParticipant(
  env: { DB: D1Database },
  planId: string,
  userId: string,
): Promise<PlanRow> {
  const plan = await env.DB.prepare(
    `SELECT pl.* FROM plans pl
     JOIN matches m ON m.id = pl.match_id
     WHERE pl.id = ? AND m.status = 'active' AND (m.user_a = ? OR m.user_b = ?)`,
  )
    .bind(planId, userId, userId)
    .first<PlanRow>();
  if (!plan) throw new AppError(404, "not_found", "Plan not found.");
  return plan;
}

async function notifyOtherPlanChanged(
  env: Env,
  ctx: WaitUntilCtx,
  plan: PlanRow,
  watcherId: string,
  watcher: ProfileRow,
): Promise<void> {
  const lang: Lang = watcher.language === "en" ? "en" : "el";
  await emitToUser(env, watcherId, {
    type: "plan.updated",
    at: nowIso(),
    payload: { plan: planDto(plan) },
  });
  pushToUser(env, ctx, watcherId, {
    title: "Together",
    body: pushText.planChanged(lang, plan.place_name),
    data: { plan_id: plan.id },
  });
}

/** All upcoming plans in the viewer's active matches, soonest first. */
app.get("/", async (c) => {
  const me = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT pl.*, CASE WHEN m.user_a = ? THEN m.user_b ELSE m.user_a END AS other_id
     FROM plans pl JOIN matches m ON m.id = pl.match_id
     WHERE m.status = 'active' AND (m.user_a = ? OR m.user_b = ?) AND pl.status = 'planned'
     ORDER BY pl.starts_at LIMIT 50`,
  )
    .bind(me.id, me.id, me.id)
    .all<PlanRow & { other_id: string }>();

  const plans = [];
  for (const row of results) {
    const other = await c.env.DB.prepare(
      "SELECT id, first_name, photo_r2_key FROM profiles WHERE id = ?",
    )
      .bind(row.other_id)
      .first<{ id: string; first_name: string; photo_r2_key: string | null }>();
    if (!other) continue;
    plans.push({
      ...planDto(row),
      other: { id: other.id, first_name: other.first_name, photo_url: photoUrl(other.photo_r2_key) },
    });
  }
  return c.json({ plans });
});

/** One plan — only its match participants can see it. */
app.get("/:id", async (c) => {
  const me = c.get("user");
  const plan = await planForParticipant(c.env, c.req.param("id"), me.id);
  const match = await getMatchForParticipant(c.env.DB, plan.match_id, me.id);
  if (!match) throw new AppError(404, "not_found", "Plan not found.");
  const other = await c.env.DB.prepare(
    "SELECT id, first_name, photo_r2_key FROM profiles WHERE id = ?",
  )
    .bind(otherUserId(match, me.id))
    .first<{ id: string; first_name: string; photo_r2_key: string | null }>();
  return c.json({
    plan: {
      ...planDto(plan),
      other: {
        id: other?.id ?? "",
        first_name: other?.first_name ?? "",
        photo_url: photoUrl(other?.photo_r2_key ?? null),
      },
    },
  });
});

/** Create the plan for a conversation (one planned plan per match). */
app.post("/:matchId/plan", async (c) => {
  const me = c.get("user");
  const match = await getMatchForParticipant(c.env.DB, c.req.param("matchId"), me.id);
  if (!match) throw new AppError(404, "not_found", "Conversation not found.");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM plans WHERE match_id = ? AND status = 'planned'",
  )
    .bind(match.id)
    .first();
  if (existing) throw new AppError(409, "plan_exists", "A plan already exists for this chat.");

  const input = planCreateSchema.parse(await c.req.json());
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO plans (id, match_id, place_name, place_lat, place_lng, starts_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, match.id, input.place_name, input.place_lat ?? null, input.place_lng ?? null, input.starts_at)
    .run();
  const plan = await planForParticipant(c.env, id, me.id);

  await notifyOtherPlanChanged(c.env, c.executionCtx, plan, otherUserId(match, me.id), me);
  return c.json({ plan: planDto(plan) }, 201);
});

app.patch("/:id", async (c) => {
  const me = c.get("user");
  const plan = await planForParticipant(c.env, c.req.param("id"), me.id);
  const match = await getMatchForParticipant(c.env.DB, plan.match_id, me.id);
  if (!match) throw new AppError(404, "not_found", "Conversation not found.");

  const patch = planUpdateSchema.parse(await c.req.json());
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of ["place_name", "place_lat", "place_lng", "starts_at", "status"] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) throw new AppError(400, "nothing_to_update", "Nothing to update.");
  values.push(plan.id);
  await c.env.DB.prepare(`UPDATE plans SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await planForParticipant(c.env, plan.id, me.id);
  await notifyOtherPlanChanged(c.env, c.executionCtx, updated, otherUserId(match, me.id), me);
  return c.json({ plan: planDto(updated) });
});

/** Tell my trusted contact: name, place, time (SMS — they may not have the app). */
app.post("/:id/share", async (c) => {
  const me = c.get("user");
  const plan = await planForParticipant(c.env, c.req.param("id"), me.id);

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM trusted_contacts WHERE user_id = ? AND notify = 1",
  )
    .bind(me.id)
    .all<TrustedContactRow>();
  if (results.length === 0) {
    throw new AppError(400, "no_trusted_contact", "Add a trusted contact first.");
  }

  const lang: Lang = me.language === "en" ? "en" : "el";
  const whenText = formatWhen(plan.starts_at, lang);
  let sent = 0;
  for (const contact of results) {
    const ok = await sendSms(
      c.env,
      contact.phone,
      smsText.planShared(lang, me.first_name, plan.place_name, whenText),
    );
    if (ok) sent += 1;
  }

  if (!plan.shared_with_contact_at) {
    await c.env.DB.prepare("UPDATE plans SET shared_with_contact_at = ? WHERE id = ?")
      .bind(nowIso(), plan.id)
      .run();
  }
  return c.json({ notified: sent });
});

/** The big green button after a meeting. */
app.post("/:id/safe-checkin", async (c) => {
  const me = c.get("user");
  const plan = await planForParticipant(c.env, c.req.param("id"), me.id);
  const match = await getMatchForParticipant(c.env.DB, plan.match_id, me.id);
  if (!match) throw new AppError(404, "not_found", "Conversation not found.");

  if (plan.safe_checkin_at) {
    return c.json({ ok: true, already: true });
  }
  await c.env.DB.prepare("UPDATE plans SET safe_checkin_at = ? WHERE id = ?")
    .bind(nowIso(), plan.id)
    .run();

  await emitToUser(c.env, otherUserId(match, me.id), {
    type: "checkin.confirmed",
    at: nowIso(),
    payload: { plan_id: plan.id },
  });
  return c.json({ ok: true, already: false });
});
