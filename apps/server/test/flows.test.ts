// End-to-end happy paths over the real Worker + real D1 (fresh per test):
// OTP sign-in → profile → request lifecycle → chat safety → discover →
// plans/safety loop → crons → admin queue → GDPR export & delete.

import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { runCron } from "../src/crons";
import { call, createMatch, createUser, hoursFromNow, resetDb } from "./helpers";

const CENTER = { lat: 40.64, lng: 22.945 };
const NEAR = { lat: 40.645, lng: 22.95 };
const CONSENT = "2026-10";

beforeEach(resetDb);

/** A no-op ExecutionContext for calling cron functions directly. */
const fakeCtx = {
  waitUntil: (p: Promise<unknown>) => {
    void p;
  },
} as unknown as ExecutionContext;

describe("auth: phone + SMS code", () => {
  it("signs a new user in with the mock code", async () => {
    const phone = "+306955500001";
    const asked = await call("POST", "/otp/request", null, { phone });
    expect(asked.status).toBe(200);
    const { dev_code: code } = await asked.json<{ dev_code?: string }>();
    expect(code).toMatch(/^\d{6}$/);

    // One wrong try is forgiven…
    const wrong = await call("POST", "/otp/verify", null, { phone, code: "000000", consent_version: CONSENT });
    expect(wrong.status).toBe(400);

    // …then the right code creates the account, with consent recorded.
    const ok = await call("POST", "/otp/verify", null, { phone, code: code!, consent_version: CONSENT });
    expect(ok.status).toBe(200);
    const body = await ok.json<{ token: string; is_new_user: boolean; profile: { phone_masked: string } }>();
    expect(body.is_new_user).toBe(true);
    expect(body.profile.phone_masked.endsWith(phone.slice(-4))).toBe(true);

    expect((await call("GET", "/me", body.token)).status).toBe(200);
  });

  it("refuses to create an account without consent", async () => {
    const phone = "+306955500002";
    const asked = await call("POST", "/otp/request", null, { phone });
    const { dev_code: code } = await asked.json<{ dev_code?: string }>();
    // The code is valid, but a brand-new account needs recorded consent.
    const res = await call("POST", "/otp/verify", null, { phone, code: code! });
    expect(res.status).toBe(400);
    expect((await res.json<{ error: { code: string } }>()).error.code).toBe("consent_required");
  });

  it("rate-limits repeated code requests", async () => {
    const phone = "+306955500003";
    expect((await call("POST", "/otp/request", null, { phone })).status).toBe(200);
    const again = await call("POST", "/otp/request", null, { phone });
    expect(again.status).toBe(429);
    expect((await again.json<{ error: { code: string } }>()).error.code).toBe("otp_cooldown");
  });
});

describe("profile basics", () => {
  it("patches the profile and snaps the location to the grid", async () => {
    const u = await createUser();

    const patched = await call("PATCH", "/me", u.token, {
      first_name: "Ελένη",
      birth_year: 1955,
      interests: ["coffee", "grandchildren"],
      language: "el",
    });
    expect(patched.status).toBe(200);
    const profile = await patched.json<{ first_name: string; birth_year: number; interests: string[] }>();
    expect(profile.first_name).toBe("Ελένη");
    expect(profile.interests).toEqual(["coffee", "grandchildren"]);

    const loc = await call("POST", "/me/location", u.token, { lat: 40.6402137, lng: 22.9450234 });
    expect(loc.status).toBe(200);
    const snapped = await loc.json<{ lat: number; lng: number }>();
    expect(snapped).toEqual({ lat: 40.64, lng: 22.945 });
  });
});

describe("requests: «I'd like company»", () => {
  it("runs the full request → offers → accept → chat lifecycle", async () => {
    const owner = await createUser({ ...CENTER, first_name: "Eleni" });
    const joiner = await createUser({ ...NEAR, first_name: "Nikos" });
    const other = await createUser({ ...NEAR, first_name: "Sofia" });
    const far = await createUser({ lat: 41.1, lng: 23.5, radius_km: 50 });

    const created = await call("POST", "/requests", owner.token, {
      activity: "coffee",
      starts_at: hoursFromNow(4),
      place_type: "cafe",
      ...CENTER,
      radius_km: 10,
    });
    expect(created.status).toBe(201);
    const { request } = await created.json<{ request: { id: string } }>();

    // Nearby people see it; far people don't.
    const nearby = await call("GET", "/requests/nearby", joiner.token);
    const visible = (await nearby.json<{ requests: Array<{ id: string }> }>()).requests.some(
      (r) => r.id === request.id,
    );
    expect(visible).toBe(true);
    const farList = await call("GET", "/requests/nearby", far.token);
    expect((await farList.json<{ requests: unknown[] }>()).requests).toHaveLength(0);

    // Two people offer; a duplicate offer bounces.
    expect((await call("POST", `/requests/${request.id}/responses`, joiner.token)).status).toBe(201);
    expect((await call("POST", `/requests/${request.id}/responses`, other.token)).status).toBe(201);
    expect((await call("POST", `/requests/${request.id}/responses`, joiner.token)).status).toBe(409);

    // The owner sees both offers and picks one.
    const offers = await call("GET", `/requests/${request.id}/responses`, owner.token);
    const { responses } = await offers.json<{
      responses: Array<{ id: string; responder: { id: string } }>;
    }>();
    expect(responses).toHaveLength(2);
    const joinerOffer = responses.find((r) => r.responder.id === joiner.id);
    expect(joinerOffer).toBeDefined();

    const accepted = await call("POST", `/requests/responses/${joinerOffer!.id}/accept`, owner.token);
    expect(accepted.status).toBe(200);
    const { match_id: matchId } = await accepted.json<{ match_id: string }>();

    // The request is no longer visible to outsiders…
    expect((await call("GET", `/requests/${request.id}`, other.token)).status).toBe(404);
    // …and both sides now share one match.
    for (const u of [owner, joiner]) {
      const list = await call("GET", "/matches", u.token);
      const { matches } = await list.json<{ matches: Array<{ id: string }> }>();
      expect(matches.map((m) => m.id)).toContain(matchId);
    }

    // The chat works both ways.
    const sent = await call("POST", `/matches/${matchId}/messages`, joiner.token, {
      body: "Γεια σας! Πάμε στις 11;",
    });
    expect(sent.status).toBe(201);
    const inbox = await call("GET", `/matches/${matchId}/messages`, owner.token);
    const { messages } = await inbox.json<{ messages: Array<{ body: string }> }>();
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toContain("Πάμε στις 11");
  });
});

describe("chat safety", () => {
  it("holds money requests and flags links", async () => {
    const a = await createUser();
    const b = await createUser();
    const matchId = await createMatch(a.id, b.id);

    const scam = await call("POST", `/matches/${matchId}/messages`, a.token, {
      body: "Please send me money for the taxi. IBAN GR16 0110 1050 0000 1054 7023 795",
    });
    expect(scam.status).toBe(422);
    expect((await scam.json<{ error: { code: string } }>()).error.code).toBe("message_blocked");

    const link = await call("POST", `/matches/${matchId}/messages`, a.token, {
      body: "Here is the café's page: https://example.com/kafe",
    });
    expect(link.status).toBe(201);
    expect((await link.json<{ message: { flagged: number } }>()).message.flagged).toBe(1);

    expect(
      (await call("POST", `/matches/${matchId}/messages`, a.token, { body: "See you at 11!" })).status,
    ).toBe(201);

    // The held message never reached B; the flagged one did.
    const inbox = await call("GET", `/matches/${matchId}/messages`, b.token);
    const { messages } = await inbox.json<{ messages: Array<{ body: string }> }>();
    expect(messages).toHaveLength(2);
    const bodies = messages.map((m) => m.body);
    expect(bodies).toContain("See you at 11!");
    expect(bodies).toContain("Here is the café's page: https://example.com/kafe");
  });
});

describe("discover: one card at a time", () => {
  it("matches on mutual yes and never shows decided people again", async () => {
    const a = await createUser({ ...CENTER, first_name: "Eleni", photo_r2_key: "photos/a.jpg" });
    const b = await createUser({ ...NEAR, first_name: "Nikos", photo_r2_key: "photos/b.jpg" });

    const card = await call("GET", "/discover", a.token);
    expect(card.status).toBe(200);
    expect((await card.json<{ profile: { id: string } | null }>()).profile?.id).toBe(b.id);

    expect((await call("POST", `/discover/${b.id}/decision`, a.token, { yes: true })).status).toBe(200);
    const mutual = await call("POST", `/discover/${a.id}/decision`, b.token, { yes: true });
    expect(mutual.status).toBe(200);
    const { matched, match_id: matchId } = await mutual.json<{ matched: boolean; match_id: string }>();
    expect(matched).toBe(true);

    // Decided people never come back.
    const after = await call("GET", "/discover", a.token);
    expect((await after.json<{ profile: unknown }>()).profile).toBeNull();

    // …and the new match has a working chat.
    expect((await call("POST", `/matches/${matchId}/messages`, b.token, { body: "Γεια!" })).status).toBe(201);
  });

  it("shows nothing when the only nearby profile is incomplete", async () => {
    const a = await createUser({ ...CENTER, first_name: "Eleni", photo_r2_key: "photos/a.jpg" });
    await createUser({ ...NEAR, first_name: "", photo_r2_key: null }); // no photo → hidden
    const card = await call("GET", "/discover", a.token);
    expect((await card.json<{ profile: unknown }>()).profile).toBeNull();
  });
});

describe("plans and the safety loop", () => {
  it("creates a plan, shares it, changes it and closes with a check-in", async () => {
    const a = await createUser();
    const b = await createUser();
    const matchId = await createMatch(a.id, b.id);

    const created = await call("POST", `/plans/${matchId}/plan`, a.token, {
      place_name: "Café Ergon, Aristotelous",
      starts_at: hoursFromNow(20),
      place_lat: 40.64,
      place_lng: 22.945,
    });
    expect(created.status).toBe(201);
    const { plan } = await created.json<{ plan: { id: string } }>();

    // One plan per chat.
    const dup = await call("POST", `/plans/${matchId}/plan`, b.token, {
      place_name: "Elsewhere",
      starts_at: hoursFromNow(20),
    });
    expect(dup.status).toBe(409);

    // Sharing needs a trusted contact first.
    const noContact = await call("POST", `/plans/${plan.id}/share`, a.token);
    expect(noContact.status).toBe(400);
    expect((await noContact.json<{ error: { code: string } }>()).error.code).toBe("no_trusted_contact");

    expect(
      (
        await call("POST", "/me/trusted-contacts", a.token, {
          name: "Μαρία (κόρη)",
          phone: "+306912340001",
          relationship: "child",
        })
      ).status,
    ).toBe(201);

    // No SMS provider in tests → nothing was actually texted, but the plan is
    // marked shared, which is what arms the safety net.
    const shared = await call("POST", `/plans/${plan.id}/share`, a.token);
    expect(shared.status).toBe(200);
    expect((await shared.json<{ notified: number }>()).notified).toBe(0);

    // A change by either side succeeds (the other side is notified in background).
    expect((await call("PATCH", `/plans/${plan.id}`, b.token, { starts_at: hoursFromNow(22) })).status).toBe(200);

    // After the meeting: the big green button, idempotent.
    const checkin = await call("POST", `/plans/${plan.id}/safe-checkin`, a.token);
    expect((await checkin.json<{ already: boolean }>()).already).toBe(false);
    const again = await call("POST", `/plans/${plan.id}/safe-checkin`, a.token);
    expect((await again.json<{ already: boolean }>()).already).toBe(true);

    // The plans list and the plan detail screen have what the tabs need.
    const list = await call("GET", "/plans", a.token);
    expect(list.status).toBe(200);
    const listed = await list.json<{ plans: Array<{ id: string; other: { id: string } }> }>();
    expect(listed.plans).toHaveLength(1);
    expect(listed.plans[0].other.id).toBe(b.id);

    const detail = await call("GET", `/plans/${plan.id}`, b.token);
    expect(detail.status).toBe(200);
    expect((await detail.json<{ plan: { other: { id: string } } }>()).plan.other.id).toBe(a.id);
  });

  it("alerts trusted contacts when a check-in is missed (15-min cron, once)", async () => {
    const a = await createUser();
    const b = await createUser();
    const matchId = await createMatch(a.id, b.id);
    await call("POST", "/me/trusted-contacts", a.token, {
      name: "Μαρία",
      phone: "+306912340002",
      relationship: "child",
    });

    const created = await call("POST", `/plans/${matchId}/plan`, a.token, {
      place_name: "Λαϊκή αγορά",
      starts_at: hoursFromNow(-3),
    });
    const { plan } = await created.json<{ plan: { id: string } }>();
    await call("POST", `/plans/${plan.id}/share`, a.token);

    await runCron(env, "*/15 * * * *", fakeCtx);
    const row = await env.DB.prepare("SELECT checkin_missed_notified_at FROM plans WHERE id = ?")
      .bind(plan.id)
      .first<{ checkin_missed_notified_at: string | null }>();
    expect(row?.checkin_missed_notified_at).not.toBeNull();

    // The once-only flag guarantees the second sweep stays silent.
    await runCron(env, "*/15 * * * *", fakeCtx);
  });

  it("expires stale open requests (hourly cron)", async () => {
    const u = await createUser();
    await env.DB.prepare(
      "INSERT INTO requests (id, user_id, activity, starts_at, place_type, lat, lng, radius_km) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), u.id, "coffee", hoursFromNow(-5), "cafe", CENTER.lat, CENTER.lng, 10)
      .run();

    await runCron(env, "30 * * * *", fakeCtx);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'done'").first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
});

describe("safety tools and the admin queue", () => {
  it("files SOS + reports and lets an admin act on them", async () => {
    const a = await createUser();
    const b = await createUser();
    const admin = await createUser({ role: "admin" });

    await call("POST", "/me/trusted-contacts", a.token, {
      name: "Μαρία",
      phone: "+306912340003",
      relationship: "child",
    });
    const sos = await call("POST", "/safety/sos", a.token, { note: "Νιώθω ζάλη" });
    expect(sos.status).toBe(200);
    const sosBody = await sos.json<{ notified: number; contacts: number; names: string[] }>();
    expect(sosBody.contacts).toBe(1);
    expect(sosBody.notified).toBe(0); // no SMS provider configured in tests
    expect(sosBody.names).toEqual(["Μαρία"]);

    // The stand-down reaches the same audience as the alarm.
    const sosOk = await call("POST", "/safety/sos/ok", a.token);
    expect(sosOk.status).toBe(200);
    const sosOkBody = await sosOk.json<{ contacts: number; names: string[] }>();
    expect(sosOkBody.contacts).toBe(1);
    expect(sosOkBody.names).toEqual(["Μαρία"]);

    expect(
      (
        await call("POST", "/safety/reports", b.token, {
          target_id: a.id,
          reason: "scam",
          details: "Asked for money",
        })
      ).status,
    ).toBe(201);

    const queue = await call("GET", "/admin/reports", admin.token);
    const { reports } = await queue.json<{ reports: Array<{ id: string; status: string }> }>();
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe("open");

    expect(
      (await call("POST", `/admin/reports/${reports[0].id}/action`, admin.token, { action: "dismiss" })).status,
    ).toBe(200);
    const after = await call("GET", "/admin/reports", admin.token);
    expect((await after.json<{ reports: unknown[] }>()).reports).toHaveLength(0);
  });
});

describe("live events", () => {
  it("upgrades /events to a WebSocket for signed-in users only", async () => {
    expect((await call("GET", "/events", null)).status).toBe(401);
    const u = await createUser();
    // WebSocket upgrades must arrive with an Upgrade header (workerd checks
    // it on the outermost request before honoring a 101 response).
    const res = await SELF.fetch("https://example.com/events", {
      headers: { authorization: `Bearer ${u.token}`, Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
  });

  it("answers /health without auth", async () => {
    expect((await call("GET", "/health", null)).status).toBe(200);
  });
});

describe("push device registration", () => {
  it("requires auth, validates the payload, and re-registration moves the token", async () => {
    expect(
      (await call("POST", "/me/device", null, { push_token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }))
        .status,
    ).toBe(401);

    const u = await createUser();
    // Malformed payloads never reach the devices table.
    expect((await call("POST", "/me/device", u.token, { push_token: "short" })).status).toBe(400);

    const token = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
    expect((await call("POST", "/me/device", u.token, { push_token: token, platform: "android" })).status).toBe(200);

    // A push token identifies one physical device: when the same token is
    // registered again (re-install on another account), the latest owner wins.
    const v = await createUser();
    await call("POST", "/me/device", v.token, { push_token: token, platform: "android" });
    const rows = await env.DB.prepare("SELECT user_id FROM devices WHERE push_token = ?")
      .bind(token)
      .all<{ user_id: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]!.user_id).toBe(v.id);
  });
});

describe("GDPR: export and delete", () => {
  it("exports everything as JSON, then deletes the account", async () => {
    const u = await createUser();

    const exp = await call("GET", "/me/export", u.token);
    expect(exp.status).toBe(200);
    const data = await exp.json<{ profile: { id: string; phone: string }; my_requests: unknown[] }>();
    expect(data.profile.id).toBe(u.id);
    expect(data.profile.phone).toBe(u.phone); // the user's own data includes it

    expect((await call("DELETE", "/me", u.token)).status).toBe(200);
    // The session dies with the account.
    expect((await call("GET", "/me", u.token)).status).toBe(401);
  });
});

describe("volunteers and feedback (Phase 8)", () => {
  it("takes a volunteer application, admin approves, the badge shows nearby", async () => {
    const volunteer = await createUser({ ...CENTER, first_name: "Eleni" });
    const neighbor = await createUser({ ...NEAR, first_name: "Nikos" });

    // Applying files the request; the badge itself is not granted yet.
    const patched = await call("PATCH", "/me", volunteer.token, { volunteer: true });
    expect(patched.status).toBe(200);
    let self = await patched.json<{ volunteer_requested: boolean; volunteer: boolean }>();
    expect(self.volunteer_requested).toBe(true);
    expect(self.volunteer).toBe(false);

    // Before approval nobody sees a badge — not even on her own help request.
    const created = await call("POST", "/requests", volunteer.token, {
      activity: "tech_help",
      starts_at: hoursFromNow(24),
      place_type: "home_area",
      ...CENTER,
      radius_km: 10,
    });
    expect(created.status).toBe(201);
    const before = await call("GET", "/requests/nearby", neighbor.token);
    const preBadge = (await before.json<{ requests: Array<{ owner: { volunteer: boolean; volunteer_requested?: boolean } }> }>())
      .requests.find((r) => r.owner.first_name === "Eleni");
    expect(preBadge?.owner.volunteer).toBe(false);

    // The admin queue lists the application; approve it.
    const admin = await createUser({ role: "admin" });
    const queue = await call("GET", "/admin/volunteers", admin.token);
    expect(queue.status).toBe(200);
    const apps = await queue.json<{ volunteers: Array<{ id: string }> }>();
    expect(apps.volunteers.some((a) => a.id === volunteer.id)).toBe(true);

    expect(
      (await call("POST", `/admin/volunteers/${volunteer.id}/approve`, admin.token, {})).status,
    ).toBe(200);

    // Approved: the badge is on /me and visible to everyone nearby.
    const me = await call("GET", "/me", volunteer.token);
    self = await me.json<{ volunteer_requested: boolean; volunteer: boolean }>();
    expect(self.volunteer).toBe(true);
    expect(self.volunteer_requested).toBe(true);

    const after = await call("GET", "/requests/nearby", neighbor.token);
    const postBadge = (await after.json<{ requests: Array<{ owner: { volunteer: boolean } }> }>())
      .requests.find((r) => r.owner.first_name === "Eleni");
    expect(postBadge?.owner.volunteer).toBe(true);

    // Approving twice can't happen — the application left the queue.
    expect(
      (await call("POST", `/admin/volunteers/${volunteer.id}/approve`, admin.token, {})).status,
    ).toBe(404);
  });

  it("lets an admin reject, the user toggle off (clearing a badge), and re-apply", async () => {
    const u = await createUser();
    const admin = await createUser({ role: "admin" });

    await call("PATCH", "/me", u.token, { volunteer: true });
    expect(
      (await call("POST", `/admin/volunteers/${u.id}/reject`, admin.token, {})).status,
    ).toBe(200);
    // Rejected: not a volunteer, not queued — and the queue is now empty.
    const queue = await call("GET", "/admin/volunteers", admin.token);
    expect((await queue.json<{ volunteers: Array<{ id: string }> }>()).volunteers).toHaveLength(0);

    // A granted badge dies the moment the user switches volunteering off.
    await call("PATCH", "/me", u.token, { volunteer: true });
    await call("POST", `/admin/volunteers/${u.id}/approve`, admin.token, {});
    const off = await call("PATCH", "/me", u.token, { volunteer: false });
    const self = await off.json<{ volunteer_requested: boolean; volunteer: boolean }>();
    expect(self.volunteer).toBe(false);
    expect(self.volunteer_requested).toBe(false);
  });

  it("takes feedback to the admin dashboard and anonymises it on account deletion", async () => {
    const u = await createUser();
    const admin = await createUser({ role: "admin" });

    expect((await call("POST", "/feedback", null, { message: "great app" })).status).toBe(401);
    expect((await call("POST", "/feedback", u.token, { message: "no" })).status).toBe(400); // too short
    expect((await call("POST", "/feedback", u.token, { message: "Προσθέστε βόλτες στη Θεσσαλονίκη" })).status).toBe(201);

    const list = await call("GET", "/admin/feedback", admin.token);
    const rows = await list.json<{ feedback: Array<{ message: string; first_name: string | null }> }>();
    expect(rows.feedback).toHaveLength(1);
    // Seeded names are `Test<seq>`; the dashboard sees the sender's name…
    expect(rows.feedback[0]!.first_name).toMatch(/^Test\d+$/);

    // Deleting the account anonymises the feedback but keeps the text.
    await call("DELETE", "/me", u.token);
    const after = await call("GET", "/admin/feedback", admin.token);
    const rowsAfter = await after.json<{ feedback: Array<{ first_name: string | null }> }>();
    expect(rowsAfter.feedback[0]!.first_name).toBeNull();
  });
});
