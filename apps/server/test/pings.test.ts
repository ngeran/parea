// Pings ("waves") + the Nearby people list + the discoverable opt-out:
// list → ping → incoming → accept → chat; decline is final for the pair;
// discoverable=0 hides you from lists without blinding you.

import { beforeEach, describe, expect, it } from "vitest";
import { call, createUser, resetDb } from "./helpers";

const CENTER = { lat: 40.64, lng: 22.945 };
const NEAR = { lat: 40.645, lng: 22.95 };
const FAR = { lat: 41.0, lng: 22.945 };

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

describe("nearby list + ping lifecycle", () => {
  it("lists, pings, accepts and opens a chat that disappears from the list", async () => {
    const { a, b } = await nearbyPair();

    const list = await call("GET", "/nearby/profiles", a.token);
    expect(list.status).toBe(200);
    const { people } = await list.json<{ people: Array<{ id: string; ping: string; distance_km: number }> }>();
    expect(people.map((p) => p.id)).toEqual([b.id]);
    expect(people[0]!.ping).toBe("none");
    expect(people[0]!.distance_km).toBeLessThan(10);

    expect((await call("POST", `/pings/${b.id}`, a.token)).status).toBe(201);

    // A now sees "Waiting…"; B sees an incoming wave with the sender's card.
    const after = await call("GET", "/nearby/profiles", a.token);
    expect((await after.json<{ people: Array<{ ping: string }> }>()).people[0]!.ping).toBe("outgoing");

    const incoming = await call("GET", "/pings/incoming", b.token);
    expect(incoming.status).toBe(200);
    const { pings } = await incoming.json<{ pings: Array<{ id: string; from: { id: string } }> }>();
    expect(pings).toHaveLength(1);
    expect(pings[0]!.from.id).toBe(a.id);

    const accepted = await call("POST", `/pings/${pings[0]!.id}/accept`, b.token);
    expect(accepted.status).toBe(200);
    const { match_id: matchId } = await accepted.json<{ match_id: string }>();
    expect(matchId).toBeTruthy();

    // Both sides see the match, sourced "ping", with a working chat.
    for (const token of [a.token, b.token]) {
      const matches = await call("GET", "/matches", token);
      const rows = await matches.json<{ matches: Array<{ id: string; source: string }> }>();
      expect(rows.matches.map((m) => m.id)).toContain(matchId);
      expect(rows.matches.find((m) => m.id === matchId)!.source).toBe("ping");
    }
    expect((await call("POST", `/matches/${matchId}/messages`, b.token, { body: "Γεια!" })).status).toBe(201);

    // Matched people leave the nearby list.
    const final = await call("GET", "/nearby/profiles", a.token);
    expect((await final.json<{ people: unknown[] }>()).people).toHaveLength(0);
  });

  it("rejects a second ping in either direction after a decline", async () => {
    const { a, b } = await nearbyPair();
    await call("POST", `/pings/${b.id}`, a.token);
    const { pings } = await call("GET", "/pings/incoming", b.token).then((r) =>
      r.json<{ pings: Array<{ id: string }> }>(),
    );
    expect((await call("POST", `/pings/${pings[0]!.id}/decline`, b.token)).status).toBe(200);

    // Declines are silent — no inbox, and no push verification possible here.
    expect((await call("GET", "/pings/incoming", b.token)).status).toBe(200);

    expect(await errorCode(await call("POST", `/pings/${b.id}`, a.token))).toBe("already_pinged");
    expect(await errorCode(await call("POST", `/pings/${a.id}`, b.token))).toBe("already_pinged");
  });

  it("handles a ping only once, and only by its recipient", async () => {
    const { a, b } = await nearbyPair();
    await call("POST", `/pings/${b.id}`, a.token);
    const { pings } = await call("GET", "/pings/incoming", b.token).then((r) =>
      r.json<{ pings: Array<{ id: string }> }>(),
    );
    const pingId = pings[0]!.id;

    // The sender cannot accept their own wave…
    expect((await call("POST", `/pings/${pingId}/accept`, a.token)).status).toBe(404);
    expect((await call("POST", `/pings/${pingId}/accept`, b.token)).status).toBe(200);
    // …and nobody accepts twice.
    expect(await errorCode(await call("POST", `/pings/${pingId}/accept`, b.token))).toBe("already_handled");
    expect(await errorCode(await call("POST", `/pings/${pingId}/decline`, b.token))).toBe("already_handled");
  });
});

describe("discoverable opt-out", () => {
  it("hides me from lists and pings, but I can still browse and wave", async () => {
    const { a, b } = await nearbyPair();

    const patched = await call("PATCH", "/me", b.token, { discoverable: false });
    expect(patched.status).toBe(200);
    const profile = await patched.json<{ discoverable: boolean }>();
    expect(profile.discoverable).toBe(false);

    const listA = await call("GET", "/nearby/profiles", a.token);
    expect((await listA.json<{ people: unknown[] }>()).people).toHaveLength(0);

    const deckA = await call("GET", "/discover", a.token);
    expect((await deckA.json<{ profile: unknown }>()).profile).toBeNull();

    // No existence oracle: pinging a hidden person is a plain 404.
    expect(await errorCode(await call("POST", `/pings/${b.id}`, a.token))).toBe("not_found");

    // …while the hidden user still sees A and can wave at them.
    const listB = await call("GET", "/nearby/profiles", b.token);
    expect((await listB.json<{ people: Array<{ id: string }> }>()).people.map((p) => p.id)).toEqual([a.id]);
    expect((await call("POST", `/pings/${a.id}`, b.token)).status).toBe(201);
    const incomingA = await call("GET", "/pings/incoming", a.token);
    expect((await incomingA.json<{ pings: unknown[] }>()).pings).toHaveLength(1);
  });
});

describe("ping guard rails", () => {
  it("blocks self-pings, duplicates of matches, far and incomplete targets", async () => {
    const { a, b } = await nearbyPair();
    const matched = await call("POST", `/pings/${b.id}`, a.token);
    expect(matched.status).toBe(201);
    const { pings } = await call("GET", "/pings/incoming", b.token).then((r) =>
      r.json<{ pings: Array<{ id: string }> }>(),
    );
    await call("POST", `/pings/${pings[0]!.id}/accept`, b.token);
    expect(await errorCode(await call("POST", `/pings/${b.id}`, a.token))).toBe("already_matched");
    expect(await errorCode(await call("POST", `/pings/${a.id}`, a.token))).toBe("own_profile");

    const far = await createUser({ ...FAR, first_name: "Far", photo_r2_key: "photos/far.jpg" });
    expect(await errorCode(await call("POST", `/pings/${far.id}`, a.token))).toBe("not_found");

    await createUser({ ...NEAR, first_name: "", photo_r2_key: null });
    const nobody = await call("GET", "/nearby/profiles", a.token);
    expect((await nobody.json<{ people: unknown[] }>()).people).toHaveLength(0);
  });

  it("rate-limits waves at ten per hour", async () => {
    const a = await createUser({ ...CENTER, first_name: "Eleni", photo_r2_key: "photos/a.jpg" });
    for (let i = 0; i < 10; i += 1) {
      const t = await createUser({ ...NEAR, first_name: `T${i}`, photo_r2_key: `photos/t${i}.jpg` });
      expect((await call("POST", `/pings/${t.id}`, a.token)).status).toBe(201);
    }
    const eleventh = await createUser({ ...NEAR, first_name: "T11", photo_r2_key: "photos/t11.jpg" });
    expect(await errorCode(await call("POST", `/pings/${eleventh.id}`, a.token))).toBe("ping_limit");
  });

  it("declines pending pings when someone blocks the other", async () => {
    const { a, b } = await nearbyPair();
    await call("POST", `/pings/${b.id}`, a.token);

    expect((await call("POST", "/safety/blocks", a.token, { blocked_id: b.id })).status).toBe(200);
    const incoming = await call("GET", "/pings/incoming", b.token);
    expect((await incoming.json<{ pings: unknown[] }>()).pings).toHaveLength(0);
    expect(await errorCode(await call("POST", `/pings/${b.id}`, a.token))).toBe("blocked");
  });

  it("requires a session for both endpoints", async () => {
    expect((await call("GET", "/nearby/profiles", null)).status).toBe(401);
    expect((await call("GET", "/pings/incoming", null)).status).toBe(401);
    expect((await call("POST", "/pings/x", null)).status).toBe(401);
  });
});
