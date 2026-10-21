// Session tokens: 256-bit random values; only their SHA-256 hash is stored.
// Sessions last 90 days — long-lived on purpose, so seniors are not locked
// out by frequent sign-ins.

import type { ProfileRow } from "../types";
import { randomToken, sha256Hex } from "./crypto";
import { DAY, isoIn, nowIso } from "./time";

export const SESSION_TTL_MS = 90 * DAY;

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken();
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), userId, isoIn(SESSION_TTL_MS))
    .run();
  return token;
}

export async function getSessionUser(
  db: D1Database,
  rawToken: string,
): Promise<ProfileRow | null> {
  return await db
    .prepare(
      `SELECT p.* FROM sessions s
       JOIN profiles p ON p.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked = 0 AND s.expires_at > ?`,
    )
    .bind(await sha256Hex(rawToken), nowIso())
    .first<ProfileRow>();
}

export async function revokeSession(db: D1Database, rawToken: string): Promise<void> {
  await db
    .prepare("UPDATE sessions SET revoked = 1 WHERE token_hash = ?")
    .bind(await sha256Hex(rawToken))
    .run();
}
