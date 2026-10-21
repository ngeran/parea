// Relationship checks shared by several routes.

import type { MatchRow } from "../types";

export async function areBlocked(db: D1Database, a: string, b: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS x FROM blocks
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    )
    .bind(a, b, b, a)
    .first();
  return row !== null;
}

/** The match only if `userId` participates and it is still active. */
export async function getMatchForParticipant(
  db: D1Database,
  matchId: string,
  userId: string,
): Promise<MatchRow | null> {
  return await db
    .prepare(
      `SELECT * FROM matches
       WHERE id = ? AND status = 'active' AND (user_a = ? OR user_b = ?)`,
    )
    .bind(matchId, userId, userId)
    .first<MatchRow>();
}

export function otherUserId(match: MatchRow, userId: string): string {
  return match.user_a === userId ? match.user_b : match.user_a;
}
