// Geo helpers. There is no PostGIS in D1 — instead:
//   1. Locations are ALWAYS snapped to a ~500 m grid before storage
//      (privacy rule: exact positions never reach the database).
//   2. Radius queries use an index-friendly bounding-box prefilter, then an
//      exact haversine filter in SQL (D1 ships SQLite math functions).

import { nowIso } from "./time";
import type { NearbyProfileRow, NearbyRequestRow } from "../types";

/** ~500 m in degrees of latitude. */
export const GRID_STEP_DEG = 0.005;
const KM_PER_DEG_LAT = 111.32;

export interface Point {
  lat: number;
  lng: number;
}

export function snapToGrid(lat: number, lng: number): Point {
  const snap = (v: number) => Number((Math.round(v / GRID_STEP_DEG) * GRID_STEP_DEG).toFixed(4));
  return { lat: snap(lat), lng: snap(lng) };
}

export function clampLat(v: number): number {
  return Math.min(90, Math.max(-90, v));
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Note: no antimeridian handling — Greece is far from the ±180° line.
export function bbox(center: Point, radiusKm: number): BBox {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const cosLat = Math.max(0.01, Math.cos((center.lat * Math.PI) / 180));
  const dLng = radiusKm / (KM_PER_DEG_LAT * cosLat);
  return {
    minLat: clampLat(center.lat - dLat),
    maxLat: clampLat(center.lat + dLat),
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Great-circle distance in km (JS fallback / single-row checks). */
export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── Shared SQL fragments ────────────────────────────────────────────────────
// Haversine in SQL; min/max guard the acos() domain against float drift.

const HAVERSINE = (latCol: string, lngCol: string) => `
  (6371.0 * acos(min(1.0, max(-1.0,
    cos(radians(?)) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians(?))
    + sin(radians(?)) * sin(radians(${latCol}))
  ))))`;

// Params, in order: lat, lng, lat, nowIso, viewerId,
//   minLat, maxLat, minLng, maxLng, viewerId, viewerId (blocks),
//   viewerId (responses), viewerId, viewerId (matches),
//   viewerRadiusKm, limit
export const NEARBY_REQUESTS_SQL = `
SELECT * FROM (
  SELECT
    r.id, r.user_id AS owner_id, r.activity, r.starts_at, r.place_type,
    r.lat, r.lng, r.radius_km, r.status, r.created_at,
    p.first_name AS owner_first_name,
    p.photo_r2_key AS owner_photo,
    p.about AS owner_about,
    p.interests AS owner_interests,
    p.languages AS owner_languages,
    p.mobility AS owner_mobility,
    p.verified AS owner_verified,
    p.is_volunteer AS owner_is_volunteer,
    p.birth_year AS owner_birth_year,
    ${HAVERSINE("r.lat", "r.lng")} AS distance_km
  FROM requests r
  JOIN profiles p ON p.id = r.user_id AND p.status = 'active'
  WHERE r.status = 'open'
    AND r.starts_at > ?
    AND r.user_id != ?
    AND r.lat BETWEEN ? AND ?
    AND r.lng BETWEEN ? AND ?
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = ? AND b.blocked_id = r.user_id)
         OR (b.blocker_id = r.user_id AND b.blocked_id = ?))
    AND NOT EXISTS (
      SELECT 1 FROM responses res
      WHERE res.request_id = r.id AND res.responder_id = ?)
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE m.status = 'active'
        AND ((m.user_a = r.user_id AND m.user_b = ?)
          OR (m.user_b = r.user_id AND m.user_a = ?)))
)
WHERE distance_km <= ? AND distance_km <= radius_km
ORDER BY distance_km
LIMIT ?`;

// Params, in order: lat, lng, lat, viewerId,
//   minLat, maxLat, minLng, maxLng, viewerId, viewerId (blocks),
//   [extraExcludeIds...], viewerRadiusKm, limit
export const NEARBY_PROFILES_SQL = `
SELECT * FROM (
  SELECT
    p.id, p.first_name, p.photo_r2_key, p.about, p.interests, p.languages,
    p.mobility, p.verified, p.is_volunteer, p.birth_year,
    ${HAVERSINE("p.lat", "p.lng")} AS distance_km
  FROM profiles p
  WHERE p.status = 'active'
    AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND p.id != ?
    AND p.lat BETWEEN ? AND ?
    AND p.lng BETWEEN ? AND ?
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = ? AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = ?))
    ${"{{EXTRA_EXCLUSIONS}}"}
)
WHERE distance_km <= ?
ORDER BY distance_km
LIMIT ?`;

/**
 * Open requests the viewer could join: within the viewer's own radius AND
 * inside each request's audience radius, excluding blocked users, requests
 * already responded to, and people already matched with.
 */
export async function nearbyRequestRows(
  db: D1Database,
  viewer: { id: string; lat: number; lng: number; radiusKm: number },
  limit = 50,
): Promise<NearbyRequestRow[]> {
  const box = bbox(viewer, viewer.radiusKm);
  const { results } = await db
    .prepare(NEARBY_REQUESTS_SQL)
    .bind(
      viewer.lat,
      viewer.lng,
      viewer.lat,
      nowIso(),
      viewer.id,
      box.minLat,
      box.maxLat,
      box.minLng,
      box.maxLng,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.radiusKm,
      limit,
    )
    .all<NearbyRequestRow>();
  return results;
}

/**
 * Active profiles near the viewer. `requireComplete` (used by Discover)
 * hides profiles without a photo or name; `extraExclusions` lets callers
 * hide people with discover decisions or existing matches.
 */
export async function nearbyProfileRows(
  db: D1Database,
  viewer: { id: string; lat: number; lng: number; radiusKm: number },
  opts: {
    requireComplete?: boolean;
    extraExclusions?: { sql: string; params: unknown[] };
    limit?: number;
  } = {},
): Promise<NearbyProfileRow[]> {
  const box = bbox(viewer, viewer.radiusKm);
  const sql = NEARBY_PROFILES_SQL.replace(
    "AND p.lat IS NOT NULL AND p.lng IS NOT NULL",
    opts.requireComplete
      ? "AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.photo_r2_key IS NOT NULL AND p.first_name != ''"
      : "AND p.lat IS NOT NULL AND p.lng IS NOT NULL",
  ).replace("{{EXTRA_EXCLUSIONS}}", opts.extraExclusions?.sql ?? "");
  const { results } = await db
    .prepare(sql)
    .bind(
      viewer.lat,
      viewer.lng,
      viewer.lat,
      viewer.id,
      box.minLat,
      box.maxLat,
      box.minLng,
      box.maxLng,
      viewer.id,
      viewer.id,
      ...(opts.extraExclusions?.params ?? []),
      viewer.radiusKm,
      opts.limit ?? 50,
    )
    .all<NearbyProfileRow>();
  return results;
}
