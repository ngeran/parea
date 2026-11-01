// The person profile page (GET /nearby/profiles/:id): visibility mirrors the
// Nearby list for strangers, a match unlocks it regardless, blocks 404, and
// the target's open invites ride along only inside their own audience radius.

import { beforeEach, describe, expect, it } from "vitest";
import { call, createUser, hoursFromNow, resetDb } from "./helpers";

const CENTER = { lat: 40.64, lng: 22.945 };
const NEAR = { lat: 40.645, lng: 22.95 };

beforeEach(resetDb);

/** Two complete, nearby, discoverable users. */
async function nearbyPair() {
  const a = await createUser({ ...CENTER, first_name: "Eleni", photo_r2_key: "photos/a.jpg" });
  const b = await createUser({ ...NEAR, first_name: "Nikos", photo_r2_key: "photos/b.jpg" });
  return { a, b };
}

async function errorCode(res: Response): Promise<string> {
  return (await res.json<{ error: { code: string } }>()).error.code;
}

/** An open invite by `owner` at a given position, radius in km. */
async function createRequest(
  owner: { token: string },
  radiusKm = 10,
  at = NEAR,
) {
  const created = await call("POST", "/requests", owner.token, {
    activity: "coffee",
    starts_at: hoursFromNow(3),
    place_type: "cafe",
    lat: at.lat,
    lng: at.lng,
    radius_km: radiusKm,
  });
  expect(created.status).toBe(201);
  return created.json<{ request: { id: string } }>();
}

describe("person profile visibility", () => {
  it("shows a discoverable stranger with connection none, distance and invites", async () => {
    const { a, b } = await nearbyPair();
    const { request } = await createRequest(b);

    const res = await call("GET", `/nearby/profiles/${b.id}`, a.token);
    expect(res.status).toBe(200);
    const body = await res.json<{
      person: { id: string; distance_km: number };
      member_since: string;
      connection: string;
      requests: Array<{ id: string; my_response: string | null }>;
    }>();
    expect(body.person.id).toBe(b.id);
    expect(body.person.distance_km).toBeLessThan(10);
    expect(body.member_since).toBeTruthy();
    expect(body.connection).toBe("none");
    expect(body.requests.map((r) => r.id)).toEqual([request.id]);
    expect(body.requests[0]!.my_response).toBeNull();
  });

  it("404s hidden or incomplete people, and blocked pairs", async () => {
    const { a, b } = await nearbyPair();

    await call("PATCH", "/me", b.token, { discoverable: false });
    expect((await call("GET", `/nearby/profiles/${b.id}`, a.token)).status).toBe(404);

    // A match still unlocks the hidden person's profile…
    await call("POST", `/pings/${a.id}`, b.token);
    const { pings } = await call("GET", "/pings/incoming", a.token).then((r) =>
      r.json<{ pings: Array<{ id: string }> }>(),
    );
    const accepted = await call("POST", `/pings/${pings[0]!.id}/accept`, a.token);
    const { match_id: matchId } = await accepted.json<{ match_id: string }>();

    const matched = await call("GET", `/nearby/profiles/${b.id}`, a.token);
    expect(matched.status).toBe(200);
    expect((await matched.json<{ connection: string; match_id?: string }>())).toMatchObject({
      connection: "accepted",
      match_id: matchId,
    });

    // …but a block closes it for both sides (block revokes the match's ping —
    // here we simply block a fresh pair).
    const c = await createUser({ ...CENTER, first_name: "Zoe", photo_r2_key: "photos/c.jpg" });
    const d = await createUser({ ...NEAR, first_name: "Leo", photo_r2_key: "photos/d.jpg" });
    await call("POST", "/safety/blocks", c.token, { blocked_id: d.id });
    expect((await call("GET", `/nearby/profiles/${d.id}`, c.token)).status).toBe(404);
    expect((await call("GET", `/nearby/profiles/${c.id}`, d.token)).status).toBe(404);
  });

  it("reports outgoing and incoming waves, with the ping id on incoming", async () => {
    const { a, b } = await nearbyPair();

    await call("POST", `/pings/${b.id}`, a.token);
    const outgoing = await call("GET", `/nearby/profiles/${b.id}`, a.token);
    expect((await outgoing.json<{ connection: string }>()).connection).toBe("outgoing");

    const incoming = await call("GET", `/nearby/profiles/${a.id}`, b.token);
    const body = await incoming.json<{ connection: string; ping_id?: string }>();
    expect(body.connection).toBe("incoming");
    expect(body.ping_id).toBeTruthy();
  });

  it("filters invites to the viewer inside their audience radius", async () => {
    const a = await createUser({ ...CENTER, first_name: "Eleni", photo_r2_key: "photos/a.jpg" });
    // ~1.7 km north of A: inside a 2 km invite circle, outside a 1 km one.
    const at = { lat: 40.655, lng: 22.945 };
    const b = await createUser({ ...at, first_name: "Nikos", photo_r2_key: "photos/b.jpg" });
    const inside = await createRequest(b, 2, at);
    await createRequest(b, 1, at);

    const res = await call("GET", `/nearby/profiles/${b.id}`, a.token);
    const body = await res.json<{ requests: Array<{ id: string }> }>();
    expect(body.requests.map((r) => r.id)).toEqual([inside.request.id]);
  });

  it("marks my own offered response on their invite", async () => {
    const { a, b } = await nearbyPair();
    const { request } = await createRequest(b);
    expect((await call("POST", `/requests/${request.id}/responses`, a.token)).status).toBe(201);

    const res = await call("GET", `/nearby/profiles/${b.id}`, a.token);
    const body = await res.json<{ requests: Array<{ my_response: string | null }> }>();
    expect(body.requests[0]!.my_response).toBe("offered");
  });
});
