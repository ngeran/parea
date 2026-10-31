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
import type { NearbyPersonDTO, NearbyPingState } from "@parea/shared";
import { AppError } from "../errors";
import { nearbyProfileRows } from "../lib/geo";
import { publicProfile } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, PingRow } from "../types";

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

function numberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
