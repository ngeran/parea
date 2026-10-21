// Safety: reports, blocks and SOS. One tap away from every screen that
// involves another user — see §4 of the plan.

import { Hono } from "hono";
import { reportSchema, smsText, sosSchema } from "@together/shared";
import { AppError } from "../errors";
import { chatRoomStub } from "../lib/do";
import { formatWhen } from "../lib/format";
import { sendSms } from "../lib/sms";
import { DAY, isoIn } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, MatchRow, PlanRow, TrustedContactRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

app.post("/reports", async (c) => {
  const me = c.get("user");
  const input = reportSchema.parse(await c.req.json());
  if (input.target_id === me.id) {
    throw new AppError(400, "own_report", "You cannot report yourself.");
  }
  const target = await c.env.DB.prepare("SELECT id FROM profiles WHERE id = ?")
    .bind(input.target_id)
    .first();
  if (!target) throw new AppError(404, "not_found", "User not found.");

  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created_at > ?",
  )
    .bind(me.id, isoIn(-DAY))
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) {
    throw new AppError(429, "rate_limited", "Too many reports today.");
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO reports (id, reporter_id, target_id, reason, details) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, me.id, input.target_id, input.reason, input.details ?? null)
    .run();
  await c.env.DB.prepare(
    "INSERT INTO moderation_events (id, type, actor_id, target_id, meta) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), "report_filed", me.id, input.target_id, JSON.stringify({ report_id: id }))
    .run();

  return c.json({ ok: true }, 201);
});

app.post("/blocks", async (c) => {
  const me = c.get("user");
  const body = await c.req.json<{ blocked_id?: string }>();
  const blockedId = body.blocked_id;
  if (!blockedId || blockedId === me.id) {
    throw new AppError(400, "bad_request", "Give a user to block.");
  }
  const target = await c.env.DB.prepare("SELECT id FROM profiles WHERE id = ?")
    .bind(blockedId)
    .first();
  if (!target) throw new AppError(404, "not_found", "User not found.");

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)",
  )
    .bind(me.id, blockedId)
    .run();

  // Any conversation between the two is closed for good — and its live
  // sockets are shut so neither side stays connected.
  const match = await c.env.DB.prepare(
    `SELECT * FROM matches WHERE status = 'active'
       AND ((user_a = ? AND user_b = ?) OR (user_b = ? AND user_a = ?))`,
  )
    .bind(me.id, blockedId, me.id, blockedId)
    .first<MatchRow>();
  if (match) {
    await c.env.DB.prepare("UPDATE matches SET status = 'ended' WHERE id = ?")
      .bind(match.id)
      .run();
    c.executionCtx.waitUntil(chatRoomStub(c.env, match.id).closeAll());
  }

  return c.json({ ok: true });
});

/** SOS: SMS every trusted contact immediately. Also dial 112 — the app shows it. */
app.post("/sos", async (c) => {
  const me = c.get("user");
  const input = sosSchema.parse((await c.req.json().catch(() => ({}))) ?? {});

  let placeText = "";
  if (input.plan_id) {
    const plan = await c.env.DB.prepare(
      `SELECT pl.* FROM plans pl JOIN matches m ON m.id = pl.match_id
       WHERE pl.id = ? AND (m.user_a = ? OR m.user_b = ?)`,
    )
      .bind(input.plan_id, me.id, me.id)
      .first<PlanRow>();
    if (plan) {
      placeText = ` (${plan.place_name}, ${formatWhen(plan.starts_at, me.language)})`;
    }
  }
  const noteText = input.note ? ` Message: ${input.note}` : "";
  const details = `${placeText}${noteText}`.trim() || "No meeting details.";

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM trusted_contacts WHERE user_id = ? AND notify = 1",
  )
    .bind(me.id)
    .all<TrustedContactRow>();

  let sent = 0;
  for (const contact of results) {
    // SOS is urgent — always bilingual (EN + EL) in one message, since any
    // trusted contact may read it.
    const ok = await sendSms(
      c.env,
      contact.phone,
      `${sosEn(me.first_name, details)} ${sosEl(me.first_name, details)}`,
    );
    if (ok) sent += 1;
  }

  await c.env.DB.prepare(
    "INSERT INTO moderation_events (id, type, actor_id, meta) VALUES (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), "sos", me.id, JSON.stringify({ notified: sent, plan_id: input.plan_id ?? null }))
    .run();

  return c.json({ notified: sent, contacts: results.length, names: namesOf(results) });
});

/**
 * The stand-down: after an SOS the senior taps "I'm OK" and every alerted
 * contact gets the all-clear. Same audience as the alarm (notify = 1).
 */
app.post("/sos/ok", async (c) => {
  const me = c.get("user");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM trusted_contacts WHERE user_id = ? AND notify = 1",
  )
    .bind(me.id)
    .all<TrustedContactRow>();

  let sent = 0;
  for (const contact of results) {
    const ok = await sendSms(c.env, contact.phone, smsText.sosOk(me.first_name));
    if (ok) sent += 1;
  }

  await c.env.DB.prepare(
    "INSERT INTO moderation_events (id, type, actor_id, meta) VALUES (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), "sos_ok", me.id, JSON.stringify({ notified: sent }))
    .run();

  return c.json({ notified: sent, contacts: results.length, names: namesOf(results) });
});

function namesOf(contacts: TrustedContactRow[]): string[] {
  return contacts.map((contact) => contact.name);
}

function sosEn(name: string, details: string): string {
  return `Together SOS: ${name} is asking for urgent help. ${details}`;
}
function sosEl(name: string, details: string): string {
  return `Together ΣΟΣ: ο/η ${name} ζητά άμεση βοήθεια. ${details}`;
}
