// Geo: the ~500 m privacy grid, the bounding box, haversine sanity, and the
// two radius queries against a real (per-test isolated) D1.

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { bbox, distanceKm, nearbyProfileRows, nearbyRequestRows, snapToGrid } from "../src/lib/geo";
import { HOUR, isoIn } from "../src/lib/time";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

const CENTER = { lat: 40.64, lng: 22.945 }; // Thessaloniki centre
const NEAR = { lat: 40.645, lng: 22.95 }; // ≈ 0.7 km away
const MID = { lat: 40.655, lng: 22.955 }; // ≈ 1.9 km away

async function insertRequest(
  ownerId: string,
  at: { lat: number; lng: number },
  radiusKm: number,
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO requests (id, user_id, activity, starts_at, place_type, lat, lng, radius_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, ownerId, "coffee", isoIn(HOUR), "cafe", at.lat, at.lng, radiusKm)
    .run();
  return id;
}

describe("snapToGrid", () => {
  it("snaps onto the ~500 m grid", () => {
    const p = snapToGrid(40.6402137, 22.9450234);
    expect(p.lat).toBeCloseTo(40.64, 4);
    expect(p.lng).toBeCloseTo(22.945, 4);
  });

  it("collapses two nearby points into one cell (privacy)", () => {
    expect(snapToGrid(40.64001, 22.94501)).toEqual(snapToGrid(40.64099, 22.94599));
  });
});

describe("bbox + distance", () => {
  it("covers the radius symmetrically on both axes", () => {
    const box = bbox(CENTER, 10);
    expect(box.maxLat - CENTER.lat).toBeCloseTo(CENTER.lat - box.minLat, 5);
    expect(box.maxLat).toBeGreaterThan(40.7);
    expect(box.maxLng - CENTER.lng).toBeGreaterThan(0.1);
  });

  it("measures Thessaloniki → Athens ≈ 300 km", () => {
    const d = distanceKm(CENTER, { lat: 37.9838, lng: 23.7275 });
    expect(d).toBeGreaterThan(280);
    expect(d).toBeLessThan(320);
  });
});

describe("nearby requests (D1)", () => {
  it("respects both radii, blocks and self-exclusion", async () => {
    const viewer = await createUser({ ...CENTER });
    const owner = await createUser({ ...NEAR, first_name: "Owner" });

    await insertRequest(owner.id, NEAR, 10); // 0.7 km away → visible
    await insertRequest(owner.id, MID, 1); // 1.9 km away, radius 1 km → hidden
    await insertRequest(viewer.id, CENTER, 10); // own request → never listed

    const rows = await nearbyRequestRows(env.DB, { id: viewer.id, ...CENTER, radiusKm: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_id).toBe(owner.id);
    expect(rows[0].distance_km).toBeLessThan(1);

    // Blocking the owner makes even the visible request disappear.
    await env.DB.prepare("INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)")
      .bind(viewer.id, owner.id)
      .run();
    const after = await nearbyRequestRows(env.DB, { id: viewer.id, ...CENTER, radiusKm: 10 });
    expect(after).toHaveLength(0);
  });

  it("hides requests the viewer already answered", async () => {
    const viewer = await createUser({ ...CENTER });
    const owner = await createUser({ ...NEAR });
    const requestId = await insertRequest(owner.id, NEAR, 10);
    await env.DB.prepare("INSERT INTO responses (id, request_id, responder_id) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), requestId, viewer.id)
      .run();

    const rows = await nearbyRequestRows(env.DB, { id: viewer.id, ...CENTER, radiusKm: 10 });
    expect(rows).toHaveLength(0);
  });
});

describe("nearby profiles (D1)", () => {
  it("filters by completeness and extra exclusions", async () => {
    const viewer = await createUser({ ...CENTER });
    const complete = await createUser({ ...NEAR, first_name: "Nikos", photo_r2_key: "photos/n.jpg" });
    const incomplete = await createUser({ ...MID, first_name: "", photo_r2_key: null });

    // Discover mode: no photo or name → invisible.
    let rows = await nearbyProfileRows(
      env.DB,
      { id: viewer.id, ...CENTER, radiusKm: 10 },
      { requireComplete: true },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(complete.id);

    // Callers can exclude more (decided/matched people).
    rows = await nearbyProfileRows(env.DB, { id: viewer.id, ...CENTER, radiusKm: 10 }, {
      extraExclusions: { sql: "AND p.id != ?", params: [complete.id] },
    });
    expect(rows.map((r) => r.id)).toEqual([incomplete.id]);
  });
});
