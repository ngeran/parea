// Nearby — the people list behind the Nearby tab. Unlike the legacy Discover
// deck (one card at a time), this returns everyone worth meeting inside the
// viewer's radius, each annotated with the ping ("wave") state between us so
// the client can render Ping / Waiting / Accept without extra round-trips.
//
// Visibility: hidden here when discoverable = 0, incomplete (no photo or
// name), blocked, or already actively matched. The filter rides the existing
// extraExclusions knob — the base NEARBY_PROFILES_SQL stays untouched because
// its other consumer (fanOutNearby in routes/requests.ts) must still reach
// non-discoverable users with ambient request events.

import { Hono } from "hono";
import type { NearbyPersonDTO, NearbyPingState, PersonProfileDTO } from "@parea/shared";
import { AppError } from "../errors";
import { distanceKm, nearbyProfileRows } from "../lib/geo";
import { requestDto } from "../lib/dto";
import { areBlocked } from "../lib/relations";
import { publicProfile } from "../lib/serialize";
import { nowIso } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, PingRow, ProfileRow, RequestRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

app.get("/profiles", async (c) => {
  const me = c.get("user");
  const lat = numberOrNull(c.req.query("lat")) ?? me.lat;
  const lng = numberOrNull(c.req.query("lng")) ?? me.lng;
  if (lat === null || lng === null) {
    throw new AppError(400, "location_needed", "Share your location once to see people nearby.");
  }

  const rows = await nearbyProfileRows(
    c.env.DB,
    { id: me.id, lat, lng, radiusKm: me.radius_km },
    {
      requireComplete: true,
      limit: 50,
      extraExclusions: {
        sql: `
    AND p.discoverable = 1
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE m.status = 'active'
        AND ((m.user_a = p.id AND m.user_b = ?)
          OR (m.user_b = p.id AND m.user_a = ?)))`,
        params: [me.id, me.id],
      },
    },
  );

  // Ping states for everyone in one query, mapped in JS — the list is ≤50
  // rows and this keeps the hand-rolled parameterized geo SQL untouched.
  const { results: pings } = await c.env.DB.prepare(
    "SELECT id, from_id, to_id, status FROM pings WHERE from_id = ? OR to_id = ?",
  )
    .bind(me.id, me.id)
    .all<PingRow>();
  const byPair = new Map(pings.map((p) => [p.from_id < p.to_id ? `${p.from_id}|${p.to_id}` : `${p.to_id}|${p.from_id}`, p]));

  const people: NearbyPersonDTO[] = rows.map((r) => {
    const ping = byPair.get(me.id < r.id ? `${me.id}|${r.id}` : `${r.id}|${me.id}`);
    let state: NearbyPingState = "none";
    let pingId: string | undefined;
    if (ping) {
      if (ping.status === "accepted") {
        state = "accepted";
      } else if (ping.from_id === me.id) {
        // Outgoing, whatever its status: declined is silent by design, so the
        // sender just keeps seeing "Waiting…".
        state = "outgoing";
      } else if (ping.status === "pending") {
        state = "incoming";
        pingId = ping.id;
      }
    }
    return {
      ...publicProfile(r, r.distance_km),
      ping: state,
      ...(pingId ? { ping_id: pingId } : {}),
    };
  });
  return c.json({ people });
});

/**
 * One person's full profile page (the screen behind a tapped Nearby card,
 * chat name or responder row). Visibility mirrors the list: anyone already
 * matched sees it regardless of later changes; everyone else needs the
 * target to be discoverable + complete — and 404, never 403, so hidden
 * people keep no existence oracle. Their open invites ride along under the
 * same radius rule as GET /requests/:id, each with my response on it.
 */
app.get("/profiles/:id", async (c) => {
  const me = c.get("user");
  const targetId = c.req.param("id");
  const target = await c.env.DB.prepare(
    "SELECT * FROM profiles WHERE id = ? AND status = 'active'",
  )
    .bind(targetId)
    .first<ProfileRow>();
  if (!target) throw new AppError(404, "not_found", "Profile not found.");
  if (await areBlocked(c.env.DB, me.id, targetId)) {
    throw new AppError(404, "not_found", "Profile not found.");
  }

  const isSelf = targetId === me.id;

  // The wave/match state between us decides both the footer buttons and
  // whether the profile is visible at all.
  let connection: NearbyPingState = "none";
  let pingId: string | undefined;
  let matchId: string | undefined;
  if (!isSelf) {
    const match = await c.env.DB.prepare(
      `SELECT id FROM matches WHERE status = 'active'
         AND ((user_a = ? AND user_b = ?) OR (user_b = ? AND user_a = ?))`,
    )
      .bind(me.id, targetId, me.id, targetId)
      .first<{ id: string }>();
    if (match) {
      connection = "accepted";
      matchId = match.id;
    } else {
      const ping = await c.env.DB.prepare(
        `SELECT id, from_id, status FROM pings
         WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)`,
      )
        .bind(me.id, targetId, targetId, me.id)
        .first<PingRow>();
      if (ping) {
        if (ping.from_id === me.id) {
          connection = "outgoing";
        } else if (ping.status === "pending") {
          connection = "incoming";
          pingId = ping.id;
        }
      }
    }
  }

  const complete = target.photo_r2_key !== null && target.first_name !== "";
  if (!isSelf && connection !== "accepted" && (target.discoverable !== 1 || !complete)) {
    throw new AppError(404, "not_found", "Profile not found.");
  }

  const distance =
    !isSelf && me.lat !== null && me.lng !== null && target.lat !== null && target.lng !== null
      ? distanceKm({ lat: me.lat, lng: me.lng }, { lat: target.lat, lng: target.lng })
      : undefined;

  const { results: rows } = await c.env.DB.prepare(
    `SELECT r.*, res.status AS my_response
     FROM requests r
     LEFT JOIN responses res ON res.request_id = r.id AND res.responder_id = ?
     WHERE r.user_id = ? AND r.status = 'open' AND r.starts_at > ?
     ORDER BY r.starts_at
     LIMIT 3`,
  )
    .bind(me.id, targetId, nowIso())
    .all<RequestRow & { my_response: string | null }>();

  // "I could join this": inside the invite's own audience radius from my
  // stored position — the exact rule GET /requests/:id enforces. The owner
  // (self view) sees all their open invites.
  const canSee = (r: RequestRow) =>
    isSelf ||
    (me.lat !== null &&
      me.lng !== null &&
      distanceKm({ lat: me.lat, lng: me.lng }, { lat: r.lat, lng: r.lng }) <= r.radius_km);

  const response: PersonProfileDTO = {
    person: publicProfile(target, distance),
    member_since: target.created_at,
    connection,
    ...(pingId ? { ping_id: pingId } : {}),
    ...(matchId ? { match_id: matchId } : {}),
    requests: rows.filter(canSee).map((r) => ({
      ...requestDto(r, publicProfile(target, distance)),
      my_response: r.my_response,
    })),
  };
  return c.json(response);
});

function numberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
