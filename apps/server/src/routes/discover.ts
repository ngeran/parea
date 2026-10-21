// Discover — one profile card at a time, two huge buttons ("Yes, let's meet"
// / "Not now"; swipe optional). A mutual "Yes" opens a chat.

import { Hono } from "hono";
import { discoverDecisionSchema } from "@parea/shared";
import { AppError } from "../errors";
import { nearbyProfileRows } from "../lib/geo";
import { createMatchIfNew, notifyMatch } from "../lib/connections";
import { publicProfile } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, ProfileRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

app.get("/", async (c) => {
  const me = c.get("user");
  const lat = numberOrNull(c.req.query("lat")) ?? me.lat;
  const lng = numberOrNull(c.req.query("lng")) ?? me.lng;
  if (lat === null || lng === null) {
    throw new AppError(400, "location_needed", "Share your location once to discover people.");
  }

  // Hide anyone either of us already decided on, and anyone already matched.
  const rows = await nearbyProfileRows(
    c.env.DB,
    { id: me.id, lat, lng, radiusKm: me.radius_km },
    {
      requireComplete: true,
      limit: 1,
      extraExclusions: {
        sql: `
    AND NOT EXISTS (
      SELECT 1 FROM discover_decisions d
      WHERE (d.viewer_id = ? AND d.target_id = p.id)
         OR (d.viewer_id = p.id AND d.target_id = ?))
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE m.status = 'active'
        AND ((m.user_a = p.id AND m.user_b = ?)
          OR (m.user_b = p.id AND m.user_a = ?)))`,
        params: [me.id, me.id, me.id, me.id],
      },
    },
  );

  const row = rows[0];
  return c.json({ profile: row ? publicProfile(row, row.distance_km) : null });
});

app.post("/:userId/decision", async (c) => {
  const me = c.get("user");
  const { yes } = discoverDecisionSchema.parse(await c.req.json());
  const targetId = c.req.param("userId");
  if (targetId === me.id) throw new AppError(400, "own_profile", "That is you.");

  const target = await c.env.DB.prepare(
    "SELECT * FROM profiles WHERE id = ? AND status = 'active'",
  )
    .bind(targetId)
    .first<ProfileRow>();
  if (!target) throw new AppError(404, "not_found", "Profile not found.");

  const blockedPair = await c.env.DB.prepare(
    `SELECT 1 AS x FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
  )
    .bind(targetId, me.id, me.id, targetId)
    .first();
  if (blockedPair) throw new AppError(403, "blocked", "Not available.");

  // Decisions are final — a second one is a conflict, not an update.
  const res = await c.env.DB.prepare(
    "INSERT INTO discover_decisions (viewer_id, target_id, yes) VALUES (?, ?, ?)",
  )
    .bind(me.id, targetId, yes ? 1 : 0)
    .run();
  if (res.meta.changes === 0) {
    throw new AppError(409, "already_decided", "You already decided about this profile.");
  }

  if (!yes) return c.json({ matched: false });

  // Mutual "Yes"?
  const theirs = await c.env.DB.prepare(
    "SELECT yes FROM discover_decisions WHERE viewer_id = ? AND target_id = ?",
  )
    .bind(targetId, me.id)
    .first<{ yes: number }>();

  if (theirs?.yes === 1) {
    const outcome = await createMatchIfNew(c.env, me.id, targetId, "discover");
    await notifyMatch(c.env, c.executionCtx, outcome, me.id, targetId);
    return c.json({ matched: true, match_id: outcome.matchId });
  }
  return c.json({ matched: false });
});

function numberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
