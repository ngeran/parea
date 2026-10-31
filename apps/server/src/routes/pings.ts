// Pings — a one-way "wave" at someone in the Nearby list. The recipient
// accepts (a match opens, chat unlocked) or declines (silent — no event, no
// push — and permanent for the pair, enforced below by rejecting a ping in
// EITHER direction; the UNIQUE constraint only guards one).

import { Hono } from "hono";
import { pushText, type Lang, type PublicProfile } from "@parea/shared";
import { AppError } from "../errors";
import { distanceKm } from "../lib/geo";
import { createMatchIfNew } from "../lib/connections";
import { emitToUser } from "../lib/events";
import { pushToUser } from "../lib/push";
import { areBlocked } from "../lib/relations";
import { publicProfile } from "../lib/serialize";
import { HOUR, isoIn, nowIso } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, PingRow, ProfileRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

/** Pings per sender per hour — enough to greet a whole plaza, not spam a town. */
const MAX_PINGS_PER_HOUR = 10;

function langOf(row: ProfileRow): Lang {
  return row.language === "en" ? "en" : "el";
}

app.post("/:userId", async (c) => {
  const me = c.get("user");
  const targetId = c.req.param("userId");
  if (targetId === me.id) throw new AppError(400, "own_profile", "That is you.");
  if (me.lat === null || me.lng === null) {
    throw new AppError(400, "location_needed", "Share your location once to greet people.");
  }

  // 404 — not a 403 — for hidden/incomplete/disabled/gone profiles: no
  // existence oracle for people who opted out of being seen. No stored
  // position also 404s: they could never appear in a radius list anyway.
  const target = await c.env.DB.prepare(
    `SELECT * FROM profiles WHERE id = ? AND status = 'active'
       AND discoverable = 1 AND photo_r2_key IS NOT NULL AND first_name != ''`,
  )
    .bind(targetId)
    .first<ProfileRow>();
  if (!target || target.lat === null || target.lng === null) {
    throw new AppError(404, "not_found", "Profile not found.");
  }
  if (await areBlocked(c.env.DB, me.id, targetId)) {
    throw new AppError(403, "blocked", "Not available.");
  }

  const matched = await c.env.DB.prepare(
    `SELECT 1 AS x FROM matches WHERE status = 'active'
       AND ((user_a = ? AND user_b = ?) OR (user_b = ? AND user_a = ?))`,
  )
    .bind(me.id, targetId, me.id, targetId)
    .first();
  if (matched) throw new AppError(409, "already_matched", "You already have a chat open.");

  // Either direction: a declined ping makes the pair final, both ways.
  const existing = await c.env.DB.prepare(
    `SELECT status FROM pings
     WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)`,
  )
    .bind(me.id, targetId, targetId, me.id)
    .first<{ status: PingRow["status"] }>();
  if (existing) throw new AppError(409, "already_pinged", "A wave already exists between you.");

  // Same radius rule as /discover: the viewer's radius decides who they can
  // reach (grid-snapped coords are what's stored anyway).
  if (distanceKm({ lat: me.lat, lng: me.lng }, { lat: target.lat, lng: target.lng }) > me.radius_km) {
    throw new AppError(404, "not_found", "Profile not found.");
  }

  const sent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM pings WHERE from_id = ? AND created_at > ?",
  )
    .bind(me.id, isoIn(-HOUR))
    .first<{ n: number }>();
  if ((sent?.n ?? 0) >= MAX_PINGS_PER_HOUR) {
    throw new AppError(429, "ping_limit", "Too many waves in one hour.");
  }

  const id = crypto.randomUUID();
  const res = await c.env.DB.prepare(
    "INSERT INTO pings (id, from_id, to_id) VALUES (?, ?, ?)",
  )
    .bind(id, me.id, targetId)
    .run();
  if (res.meta.changes === 0) {
    throw new AppError(409, "already_pinged", "A wave already exists between you.");
  }

  const at = nowIso();
  await emitToUser(c.env, targetId, {
    type: "ping.new",
    at,
    payload: { ping_id: id, from: publicProfile(me) },
  });
  pushToUser(c.env, c.executionCtx, targetId, {
    title: "Parea",
    body: pushText.pingReceived(langOf(target), me.first_name),
    data: { ping_id: id },
  });
  return c.json({ ok: true }, 201);
});

app.get("/incoming", async (c) => {
  const me = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT p.id AS ping_id, p.created_at AS ping_created_at, u.*
     FROM pings p JOIN profiles u ON u.id = p.from_id AND u.status = 'active'
     WHERE p.to_id = ? AND p.status = 'pending'
     ORDER BY p.created_at DESC LIMIT 50`,
  )
    .bind(me.id)
    .all<ProfileRow & { ping_id: string; ping_created_at: string }>();
  const pings = results.map((row) => {
    const distance =
      row.lat !== null && row.lng !== null && me.lat !== null && me.lng !== null
        ? distanceKm({ lat: me.lat, lng: me.lng }, { lat: row.lat, lng: row.lng })
        : undefined;
    return {
      id: row.ping_id,
      created_at: row.ping_created_at,
      from: publicProfile(row, distance),
    };
  });
  return c.json({ pings });
});

app.post("/:id/accept", async (c) => {
  const me = c.get("user");
  const pingId = c.req.param("id");

  // Row-level security: only the recipient sees (and can act on) the ping.
  const ping = await c.env.DB.prepare("SELECT * FROM pings WHERE id = ? AND to_id = ?")
    .bind(pingId, me.id)
    .first<PingRow>();
  if (!ping) throw new AppError(404, "not_found", "Ping not found.");
  if (ping.status !== "pending") {
    throw new AppError(409, "already_handled", "This wave was already handled.");
  }
  if (await areBlocked(c.env.DB, ping.from_id, me.id)) {
    throw new AppError(403, "blocked", "Not available.");
  }

  const res = await c.env.DB.prepare(
    "UPDATE pings SET status = 'accepted' WHERE id = ? AND status = 'pending'",
  )
    .bind(pingId)
    .run();
  if (res.meta.changes === 0) {
    throw new AppError(409, "already_handled", "This wave was already handled.");
  }

  const sender = await c.env.DB.prepare(
    "SELECT * FROM profiles WHERE id = ? AND status = 'active'",
  )
    .bind(ping.from_id)
    .first<ProfileRow>();
  if (!sender) throw new AppError(404, "not_found", "Profile not found.");

  const outcome = await createMatchIfNew(c.env, ping.from_id, me.id, "ping");

  // Bespoke fan-out (not notifyMatch): the person who just tapped Accept
  // shouldn't receive the "it's a match!" push themselves.
  const at = nowIso();
  const mePublic: PublicProfile = publicProfile(me);
  const senderPublic: PublicProfile = publicProfile(sender);
  await emitToUser(c.env, ping.from_id, {
    type: "ping.updated",
    at,
    payload: { ping_id: pingId, status: "accepted" },
  });
  await emitToUser(c.env, ping.from_id, {
    type: "match.created",
    at,
    payload: { match_id: outcome.matchId, other: mePublic },
  });
  await emitToUser(c.env, me.id, {
    type: "match.created",
    at,
    payload: { match_id: outcome.matchId, other: senderPublic },
  });
  pushToUser(c.env, c.executionCtx, ping.from_id, {
    title: "Parea",
    body: pushText.pingAccepted(langOf(sender), me.first_name),
    data: { match_id: outcome.matchId },
  });

  return c.json({ ok: true, match_id: outcome.matchId });
});

app.post("/:id/decline", async (c) => {
  const me = c.get("user");
  const pingId = c.req.param("id");
  // Silent by design: no event, no push — a decline is simply a "no".
  const res = await c.env.DB.prepare(
    "UPDATE pings SET status = 'declined' WHERE id = ? AND to_id = ? AND status = 'pending'",
  )
    .bind(pingId, me.id)
    .run();
  if (res.meta.changes === 0) {
    throw new AppError(409, "already_handled", "This wave was already handled.");
  }
  return c.json({ ok: true });
});
