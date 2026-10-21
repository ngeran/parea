// Requests — the primary connection mechanic.
// "I'd like company" → nearby users see it → they tap "I can join" →
// the requester picks who to accept (which creates a match + chat).

import { Hono } from "hono";
import {
  activityLabel,
  pushText,
  requestCreateSchema,
  type Lang,
  type PublicProfile,
  type RequestDTO,
} from "@parea/shared";
import { AppError } from "../errors";
import { emitToUser } from "../lib/events";
import { nearbyProfileRows, nearbyRequestRows, distanceKm, snapToGrid } from "../lib/geo";
import { createMatchIfNew, notifyMatch } from "../lib/connections";
import { pushToUser } from "../lib/push";
import { nearbyRequestDto, requestDto } from "../lib/dto";
import { publicProfile } from "../lib/serialize";
import { DAY, isoIn, nowIso } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type {
  AppEnv,
  NearbyRequestRow,
  ProfileRow,
  RequestRow,
  ResponseRow,
} from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

const MAX_OPEN_REQUESTS = 3;
const MAX_REQUESTS_PER_DAY = 5;

app.post("/", async (c) => {
  const input = requestCreateSchema.parse(await c.req.json());
  const me = c.get("user");

  const counts = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_now,
       SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS today
     FROM requests WHERE user_id = ?`,
  )
    .bind(isoIn(-DAY), me.id)
    .first<{ open_now: number | null; today: number | null }>();
  if ((counts?.open_now ?? 0) >= MAX_OPEN_REQUESTS) {
    throw new AppError(429, "request_limit_open", "You already have 3 open requests.");
  }
  if ((counts?.today ?? 0) >= MAX_REQUESTS_PER_DAY) {
    throw new AppError(429, "request_limit_day", "That is enough requests for today.");
  }
  if (input.starts_at <= nowIso()) {
    throw new AppError(400, "starts_at_past", "Pick a time in the future.");
  }
  if (Date.parse(input.starts_at) > Date.now() + 14 * DAY) {
    throw new AppError(400, "starts_at_too_far", "Pick a day within the next two weeks.");
  }

  const point = snapToGrid(input.lat, input.lng);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO requests (id, user_id, activity, starts_at, place_type, lat, lng, radius_km)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, me.id, input.activity, input.starts_at, input.place_type, point.lat, point.lng, input.radius_km)
    .run();
  const request = await c.env.DB.prepare("SELECT * FROM requests WHERE id = ?")
    .bind(id)
    .first<RequestRow>();
  if (!request) throw new AppError(500, "internal", "Could not load the request.");

  // Live fan-out: nearby users with the app open get `request.nearby`.
  // No push for this — it is ambient, not urgent.
  c.executionCtx.waitUntil(fanOutNearby(c.env, request, me));

  return c.json({ request: requestDto(request, publicProfile(me)) }, 201);
});

/** Tell users within the request's radius (ambient event, capped). */
async function fanOutNearby(env: Env, request: RequestRow, owner: ProfileRow): Promise<void> {
  try {
    const near = await nearbyProfileRows(
      env.DB,
      { id: owner.id, lat: request.lat, lng: request.lng, radiusKm: request.radius_km },
      { requireComplete: false, limit: 200 },
    );
    const dto = requestDto(request, publicProfile(owner));
    const at = nowIso();
    await Promise.all(
      near.map((p) =>
        emitToUser(env, p.id, { type: "request.nearby", at, payload: { request: dto } }),
      ),
    );
  } catch (err) {
    console.error("fanOutNearby failed", { err: String(err) });
  }
}

app.get("/mine", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.*,
       (SELECT COUNT(*) FROM responses res
         WHERE res.request_id = r.id AND res.status = 'offered') AS offered_count
     FROM requests r
     WHERE r.user_id = ? AND r.status IN ('open', 'matched')
     ORDER BY r.created_at DESC
     LIMIT 50`,
  )
    .bind(c.get("user").id)
    .all<RequestRow & { offered_count: number }>();
  return c.json({
    requests: results.map((r) => ({
      ...requestDto(r, publicProfile(c.get("user"))),
      offered_count: r.offered_count,
    })),
  });
});

/** Open requests the viewer could join, nearest first. */
app.get("/nearby", async (c) => {
  const me = c.get("user");
  const lat = numberOrNull(c.req.query("lat")) ?? me.lat;
  const lng = numberOrNull(c.req.query("lng")) ?? me.lng;
  if (lat === null || lng === null) {
    throw new AppError(400, "location_needed", "Share your location once to see nearby requests.");
  }
  const rows = await nearbyRequestRows(c.env.DB, { id: me.id, lat, lng, radiusKm: me.radius_km });
  return c.json({ requests: rows.map(nearbyRequestDto) });
});

app.get("/:id", async (c) => {
  const me = c.get("user");
  const request = await c.env.DB.prepare("SELECT * FROM requests WHERE id = ?")
    .bind(c.req.param("id"))
    .first<RequestRow>();
  if (!request) throw new AppError(404, "not_found", "Request not found.");

  const isOwner = request.user_id === me.id;
  if (!isOwner) {
    // Non-owners may only see it while it is open AND within its radius.
    if (request.status !== "open") throw new AppError(404, "not_found", "Request not found.");
    if (me.lat === null || me.lng === null) {
      throw new AppError(404, "not_found", "Request not found.");
    }
    const d = distanceKm({ lat: me.lat, lng: me.lng }, { lat: request.lat, lng: request.lng });
    if (d > request.radius_km) throw new AppError(404, "not_found", "Request not found.");
  }

  const owner = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
    .bind(request.user_id)
    .first<ProfileRow>();
  if (!owner) throw new AppError(404, "not_found", "Request not found.");

  const myResponse = await c.env.DB.prepare(
    "SELECT * FROM responses WHERE request_id = ? AND responder_id = ?",
  )
    .bind(request.id, me.id)
    .first<ResponseRow>();

  const offered =
    await c.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM responses WHERE request_id = ? AND status = 'offered'",
    )
      .bind(request.id)
      .first<{ n: number }>();

  return c.json({
    request: requestDto(request, publicProfile(owner)),
    my_response: myResponse?.status ?? null,
    offered_count: offered?.n ?? 0,
  });
});

/** The requester's list of people who offered to join. */
app.get("/:id/responses", async (c) => {
  const request = await c.env.DB.prepare(
    "SELECT * FROM requests WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("id"), c.get("user").id)
    .first<RequestRow>();
  if (!request) throw new AppError(404, "not_found", "Request not found.");

  const { results } = await c.env.DB.prepare(
    `SELECT res.*, p.id AS p_id, p.first_name, p.photo_r2_key, p.about, p.interests,
            p.languages, p.mobility, p.verified, p.is_volunteer, p.birth_year
     FROM responses res JOIN profiles p ON p.id = res.responder_id
     WHERE res.request_id = ? AND res.status != 'declined'
     ORDER BY res.created_at`,
  )
    .bind(request.id)
    // `status` and `id` clash between res.* and the profile columns — both are
    // aliased away in the SELECT (p.id arrives as p_id), so omitted here.
    .all<ResponseRow & Omit<ProfileRow, "status" | "id"> & { p_id: string }>();
  return c.json({
    responses: results.map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      responder: publicProfile({ ...r, id: r.p_id }),
    })),
  });
});

/** "I can join" — anyone who can see the open request. */
app.post("/:id/responses", async (c) => {
  const me = c.get("user");
  const request = await c.env.DB.prepare("SELECT * FROM requests WHERE id = ?")
    .bind(c.req.param("id"))
    .first<RequestRow>();
  if (!request || request.status !== "open") {
    throw new AppError(404, "not_found", "This request is no longer open.");
  }
  if (request.user_id === me.id) {
    throw new AppError(400, "own_request", "This is your own request.");
  }

  const blockedPair = await c.env.DB.prepare(
    `SELECT 1 AS x FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
  )
    .bind(request.user_id, me.id, me.id, request.user_id)
    .first();
  if (blockedPair) throw new AppError(403, "blocked", "You cannot join this request.");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM responses WHERE request_id = ? AND responder_id = ?",
  )
    .bind(request.id, me.id)
    .first();
  if (existing) throw new AppError(409, "already_responded", "You already joined this request.");

  const offeredCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM responses WHERE responder_id = ? AND status = 'offered'",
  )
    .bind(me.id)
    .first<{ n: number }>();
  if ((offeredCount?.n ?? 0) >= 10) {
    throw new AppError(429, "response_limit", "Wait for some answers before joining more.");
  }

  await c.env.DB.prepare(
    "INSERT INTO responses (id, request_id, responder_id) VALUES (?, ?, ?)",
  )
    .bind(crypto.randomUUID(), request.id, me.id)
    .run();

  // Tell the requester — live event + push.
  const owner = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
    .bind(request.user_id)
    .first<ProfileRow>();
  if (owner) {
    const lang: Lang = owner.language === "en" ? "en" : "el";
    await emitToUser(c.env, owner.id, {
      type: "response.created",
      at: nowIso(),
      payload: { request_id: request.id, responder: publicProfile(me) },
    });
    pushToUser(c.env, c.executionCtx, owner.id, {
      title: "Parea",
      body: pushText.responseCreated(lang, me.first_name, activityLabel(request.activity, lang)),
      data: { request_id: request.id },
    });
  }

  return c.json({ ok: true }, 201);
});

/** The requester accepts one offer → match + chat open; others decline. */
app.post("/responses/:id/accept", async (c) => {
  const me = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT res.*, r.user_id AS owner_id, r.status AS request_status
     FROM responses res JOIN requests r ON r.id = res.request_id
     WHERE res.id = ?`,
  )
    .bind(c.req.param("id"))
    .first<ResponseRow & { owner_id: string; request_status: RequestRow["status"] }>();
  if (!row || row.owner_id !== me.id) {
    throw new AppError(404, "not_found", "Response not found.");
  }
  if (row.request_status !== "open" || row.status !== "offered") {
    throw new AppError(409, "already_handled", "This response was already handled.");
  }

  const decliners = await c.env.DB.prepare(
    "SELECT responder_id FROM responses WHERE request_id = ? AND status = 'offered' AND id != ?",
  )
    .bind(row.request_id, row.id)
    .all<{ responder_id: string }>();

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE responses SET status = 'accepted' WHERE id = ?").bind(row.id),
    c.env.DB.prepare(
      "UPDATE responses SET status = 'declined' WHERE request_id = ? AND id != ? AND status = 'offered'",
    )
      .bind(row.request_id, row.id),
    c.env.DB.prepare("UPDATE requests SET status = 'matched' WHERE id = ?").bind(row.request_id),
  ]);

  const outcome = await createMatchIfNew(c.env, row.responder_id, me.id, "request");
  await notifyMatch(c.env, c.executionCtx, outcome, row.responder_id, me.id);

  const responderProfile = await c.env.DB.prepare(
    "SELECT first_name, language FROM profiles WHERE id = ?",
  )
    .bind(row.responder_id)
    .first<{ first_name: string; language: string }>();
  const lang: Lang = responderProfile?.language === "en" ? "en" : "el";

  await emitToUser(c.env, row.responder_id, {
    type: "request.accepted",
    at: nowIso(),
    payload: { request_id: row.request_id, match_id: outcome.matchId },
  });
  pushToUser(c.env, c.executionCtx, row.responder_id, {
    title: "Parea",
    body: pushText.requestAccepted(lang, me.first_name),
    data: { match_id: outcome.matchId },
  });

  // Gently let the others know without drama (event only, no push).
  const at = nowIso();
  await Promise.all(
    decliners.results.map((d) =>
      emitToUser(c.env, d.responder_id, {
        type: "request.declined",
        at,
        payload: { request_id: row.request_id },
      }),
    ),
  );

  return c.json({ match_id: outcome.matchId });
});

app.post("/:id/cancel", async (c) => {
  const res = await c.env.DB.prepare(
    "UPDATE requests SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status IN ('open','matched')",
  )
    .bind(c.req.param("id"), c.get("user").id)
    .run();
  if (res.meta.changes === 0) throw new AppError(404, "not_found", "Request not found.");
  return c.json({ ok: true });
});

function numberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
