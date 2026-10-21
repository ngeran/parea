// Matches + chat. Every accepted connection becomes a match; messages are
// written to D1 first, then fanned out (ChatRoom WebSocket + UserEvents).

import { Hono } from "hono";
import { messageSendSchema, type MatchDTO } from "@together/shared";
import { AppError } from "../errors";
import { chatRoomStub } from "../lib/do";
import { emitToUser } from "../lib/events";
import { messageDto } from "../lib/dto";
import { moderateMessage } from "../lib/moderation";
import { areBlocked, getMatchForParticipant, otherUserId } from "../lib/relations";
import { publicProfile } from "../lib/serialize";
import { MIN, isoIn, nowIso } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, MatchRow, MessageRow, ProfileRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

app.get("/", async (c) => {
  const me = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT m.*, CASE WHEN m.user_a = ? THEN m.user_b ELSE m.user_a END AS other_id
     FROM matches m
     WHERE m.status = 'active' AND (m.user_a = ? OR m.user_b = ?)
     ORDER BY m.created_at DESC
     LIMIT 100`,
  )
    .bind(me.id, me.id, me.id)
    .all<MatchRow & { other_id: string }>();

  const matches: MatchDTO[] = [];
  for (const m of results) {
    const other = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
      .bind(m.other_id)
      .first<ProfileRow>();
    if (!other) continue;
    const last = await c.env.DB.prepare(
      "SELECT * FROM messages WHERE match_id = ? AND flagged != 2 ORDER BY created_at DESC LIMIT 1",
    )
      .bind(m.id)
      .first<MessageRow>();
    matches.push({
      id: m.id,
      source: m.source,
      created_at: m.created_at,
      other: publicProfile(other),
      last_message: last ? messageDto(last) : null,
    });
  }
  return c.json({ matches });
});

async function participantMatch(db: D1Database, userId: string, matchId: string): Promise<MatchRow> {
  const match = await getMatchForParticipant(db, matchId, userId);
  if (!match) throw new AppError(404, "not_found", "Conversation not found.");
  if (await areBlocked(db, match.user_a, match.user_b)) {
    throw new AppError(403, "blocked", "This conversation is closed.");
  }
  return match;
}

app.get("/:id/messages", async (c) => {
  const me = c.get("user");
  const match = await participantMatch(c.env.DB, me.id, c.req.param("id"));
  const before = c.req.query("before");
  const stmt = before
    ? c.env.DB.prepare(
        "SELECT * FROM messages WHERE match_id = ? AND flagged != 2 AND created_at < ? ORDER BY created_at DESC LIMIT 50",
      ).bind(match.id, before)
    : c.env.DB.prepare(
        "SELECT * FROM messages WHERE match_id = ? AND flagged != 2 ORDER BY created_at DESC LIMIT 50",
      ).bind(match.id);
  const { results } = await stmt.all<MessageRow>();
  return c.json({ messages: results.reverse().map(messageDto) });
});

app.post("/:id/messages", async (c) => {
  const me = c.get("user");
  const match = await participantMatch(c.env.DB, me.id, c.req.param("id"));
  const other = otherUserId(match, me.id);
  const { body } = messageSendSchema.parse(await c.req.json());

  // Simple flood guard: 30 messages per minute.
  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE sender_id = ? AND created_at > ?",
  )
    .bind(me.id, isoIn(MIN))
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 30) {
    throw new AppError(429, "rate_limited", "Slow down a little.");
  }

  const verdict = moderateMessage(body);
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const flagged = verdict.verdict === "block" ? 2 : verdict.verdict === "flag" ? 1 : 0;

  await c.env.DB.prepare(
    "INSERT INTO messages (id, match_id, sender_id, body, flagged, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, match.id, me.id, body, flagged, createdAt)
    .run();

  if (verdict.verdict !== "clean") {
    await c.env.DB.prepare(
      "INSERT INTO moderation_events (id, type, actor_id, target_id, meta) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        verdict.verdict === "block" ? "message_held" : "message_flagged",
        me.id,
        other,
        JSON.stringify({ reasons: verdict.reasons, message_id: id }),
      )
      .run();
  }

  if (verdict.verdict === "block") {
    // Held: stored for moderators, never delivered.
    throw new AppError(
      422,
      "message_blocked",
      "For safety, this message cannot be sent. Money requests are not allowed.",
    );
  }

  const row = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ?")
    .bind(id)
    .first<MessageRow>();
  if (!row) throw new AppError(500, "internal", "Could not load the message.");

  const dto = messageDto(row);
  // Both channels fire; clients dedupe by message id. ChatRoom covers the
  // open conversation, UserEvents covers unread cues elsewhere in the app.
  await chatRoomStub(c.env, match.id).broadcast({
    id: row.id,
    match_id: row.match_id,
    sender_id: row.sender_id,
    body: row.body,
    created_at: row.created_at,
    flagged: row.flagged,
  });
  await emitToUser(c.env, other, {
    type: "message.new",
    at: createdAt,
    payload: { message: dto },
  });

  return c.json({ message: dto }, 201);
});

/**
 * WebSocket upgrade for the conversation. Auth + participant + block checks
 * happen here; the ChatRoom DO receives a trusted internal request.
 */
app.get("/:id/ws", async (c) => {
  const me = c.get("user");
  const match = await participantMatch(c.env.DB, me.id, c.req.param("id"));
  const stub = chatRoomStub(c.env, match.id);
  return await stub.fetch(
    new Request("https://internal/ws", {
      headers: { Upgrade: "websocket", "x-user-id": me.id, "x-match-id": match.id },
    }),
  );
});
