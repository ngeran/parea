// THE security deliverable: proves the authorization matrix from the plan.
// Clients never touch D1 — every path goes through these endpoints, so these
// tests are the row-level security. Non-participants get 404 (existence
// hidden), not 403, so IDs leak nothing.

import { beforeEach, describe, expect, it } from "vitest";
import { call, createMatch, createUser, hoursFromNow, resetDb } from "./helpers";

const CENTER = { lat: 40.64, lng: 22.945 };
const NEAR = { lat: 40.645, lng: 22.95 };

beforeEach(resetDb);

describe("authorization matrix", () => {
  it("rejects anonymous calls with 401", async () => {
    for (const path of [
      "/me",
      "/me/device",
      "/requests/nearby",
      "/discover",
      "/matches",
      "/photos/photos/x.jpg",
    ]) {
      const res = await call("GET", path, null);
      expect(res.status).toBe(401);
    }
  });

  it("hides other people's conversations behind 404", async () => {
    const a = await createUser();
    const b = await createUser();
    const outsider = await createUser();
    const matchId = await createMatch(a.id, b.id);

    const res = await call("GET", `/matches/${matchId}/messages`, outsider.token);
    expect(res.status).toBe(404);
    const post = await call("POST", `/matches/${matchId}/messages`, outsider.token, { body: "hi" });
    expect(post.status).toBe(404);
  });

  it("closes the conversation after a block (for both sides)", async () => {
    const a = await createUser();
    const b = await createUser();
    const matchId = await createMatch(a.id, b.id);

    const block = await call("POST", "/safety/blocks", a.token, { blocked_id: b.id });
    expect(block.status).toBe(200);

    // The match has ended, so the room no longer "exists" for either side.
    expect((await call("GET", `/matches/${matchId}/messages`, b.token)).status).toBe(404);
    expect((await call("GET", `/matches/${matchId}/messages`, a.token)).status).toBe(404);
    const list = await call("GET", "/matches", b.token);
    expect((await list.json<{ matches: unknown[] }>()).matches).toHaveLength(0);
  });

  it("keeps /admin admin-only", async () => {
    const user = await createUser();
    const admin = await createUser({ role: "admin" });

    const denied = await call("GET", "/admin/stats", user.token);
    expect(denied.status).toBe(403);
    expect((await denied.json<{ error: { code: string } }>()).error.code).toBe("admin_only");

    expect((await call("GET", "/admin/stats", admin.token)).status).toBe(200);
  });

  it("protects admin accounts from admin actions", async () => {
    const admin1 = await createUser({ role: "admin" });
    const admin2 = await createUser({ role: "admin" });
    expect((await call("POST", `/admin/users/${admin2.id}/disable`, admin1.token)).status).toBe(400);
    expect((await call("POST", `/admin/users/${admin2.id}/unverify`, admin1.token)).status).toBe(400);
  });

  it("gates verification photos to admins", async () => {
    const user = await createUser();
    const admin = await createUser({ role: "admin" });
    const key = `verification/${crypto.randomUUID()}.jpg`;

    const denied = await call("GET", `/photos/${key}`, user.token);
    expect(denied.status).toBe(403);
    expect((await denied.json<{ error: { code: string } }>()).error.code).toBe("admin_only");
    // The admin passes the check — and simply finds nothing there.
    expect((await call("GET", `/photos/${key}`, admin.token)).status).toBe(404);
  });

  it("only shows an open request to people inside its radius", async () => {
    const owner = await createUser({ ...CENTER });
    const near = await createUser({ ...NEAR });
    const far = await createUser({ lat: 41.1, lng: 23.5, radius_km: 50 }); // > 30 km

    const created = await call("POST", "/requests", owner.token, {
      activity: "coffee",
      starts_at: hoursFromNow(3),
      place_type: "cafe",
      ...CENTER,
      radius_km: 10,
    });
    expect(created.status).toBe(201);
    const { request } = await created.json<{ request: { id: string } }>();

    expect((await call("GET", `/requests/${request.id}`, near.token)).status).toBe(200);
    expect((await call("GET", `/requests/${request.id}`, far.token)).status).toBe(404);
    // The owner cannot join their own request.
    expect((await call("POST", `/requests/${request.id}/responses`, owner.token)).status).toBe(400);
  });

  it("lets only the owner see and accept offers", async () => {
    const owner = await createUser({ ...CENTER });
    const joiner = await createUser({ ...NEAR });
    const stranger = await createUser({ ...NEAR });

    const created = await call("POST", "/requests", owner.token, {
      activity: "walk",
      starts_at: hoursFromNow(5),
      place_type: "park",
      ...CENTER,
      radius_km: 10,
    });
    const { request } = await created.json<{ request: { id: string } }>();
    expect((await call("POST", `/requests/${request.id}/responses`, joiner.token)).status).toBe(201);

    // The offers list belongs to the owner alone.
    expect((await call("GET", `/requests/${request.id}/responses`, joiner.token)).status).toBe(404);
    expect((await call("GET", `/requests/${request.id}/responses`, owner.token)).status).toBe(200);

    const offers = await call("GET", `/requests/${request.id}/responses`, owner.token);
    const { responses } = await offers.json<{ responses: Array<{ id: string }> }>();
    expect(responses).toHaveLength(1);

    // Only the owner can accept; anyone else gets an existence-hiding 404.
    expect((await call("POST", `/requests/responses/${responses[0].id}/accept`, stranger.token)).status).toBe(404);
    expect((await call("POST", `/requests/responses/${responses[0].id}/accept`, owner.token)).status).toBe(200);
  });

  it("hides other people's plans behind 404", async () => {
    const a = await createUser();
    const b = await createUser();
    const outsider = await createUser();
    const matchId = await createMatch(a.id, b.id);

    const created = await call("POST", `/plans/${matchId}/plan`, a.token, {
      place_name: "Café Ergon",
      starts_at: hoursFromNow(24),
    });
    expect(created.status).toBe(201);
    const { plan } = await created.json<{ plan: { id: string } }>();

    expect((await call("PATCH", `/plans/${plan.id}`, outsider.token, { status: "cancelled" })).status).toBe(404);
    expect((await call("GET", `/plans/${plan.id}`, outsider.token)).status).toBe(404);
    expect((await call("GET", "/plans", outsider.token)).status).toBe(200);
    expect(((await (await call("GET", "/plans", outsider.token)).json<{ plans: unknown[] }>()).plans)).toHaveLength(0);
    // A participant can.
    expect((await call("PATCH", `/plans/${plan.id}`, b.token, { starts_at: hoursFromNow(25) })).status).toBe(200);
  });

  it("never reveals whether a phone has an account via OTP", async () => {
    // A wrong code on an unknown phone and on a known phone behave alike: 400.
    const asked = await call("POST", "/otp/request", null, { phone: "+306944440001" });
    expect(asked.status).toBe(200);
    const wrong = await call("POST", "/otp/verify", null, {
      phone: "+306944440001",
      code: "000000",
      consent_version: "2026-10",
    });
    expect(wrong.status).toBe(400);
    const unknown = await call("POST", "/otp/verify", null, {
      phone: "+306944440002",
      code: "000000",
      consent_version: "2026-10",
    });
    expect(unknown.status).toBe(400);
  });
});
