// Matches are the single connection type: a mutual Discover "yes" or an
// accepted request response both create one row. user_a/user_b are stored in
// canonical (sorted) order so duplicates are impossible.

import { pushText, type Lang, type PublicProfile } from "@together/shared";
import { emitToUser } from "./events";
import { pushToUser, type WaitUntilCtx } from "./push";
import { publicProfile } from "./serialize";
import { nowIso } from "./time";
import type { ProfileRow } from "../types";

export interface MatchOutcome {
  matchId: string;
  created: boolean;
}

export async function createMatchIfNew(
  env: Env,
  userIdA: string,
  userIdB: string,
  source: "discover" | "request",
): Promise<MatchOutcome> {
  const [a, b] = [userIdA, userIdB].sort();
  const id = crypto.randomUUID();
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO matches (id, user_a, user_b, source) VALUES (?, ?, ?, ?)",
  )
    .bind(id, a, b, source)
    .run();
  if (res.meta.changes === 1) return { matchId: id, created: true };
  const existing = await env.DB.prepare(
    "SELECT id FROM matches WHERE user_a = ? AND user_b = ?",
  )
    .bind(a, b)
    .first<{ id: string }>();
  return { matchId: existing?.id ?? id, created: false };
}

/** Emit `match.created` + push to both users (only for genuinely new matches). */
export async function notifyMatch(
  env: Env,
  ctx: WaitUntilCtx,
  outcome: MatchOutcome,
  userIdA: string,
  userIdB: string,
): Promise<void> {
  if (!outcome.created) return;
  const at = nowIso();
  const { results } = await env.DB.prepare("SELECT * FROM profiles WHERE id IN (?, ?)")
    .bind(userIdA, userIdB)
    .all<ProfileRow>();
  const byId = new Map(results.map((r) => [r.id, r]));

  for (const uid of [userIdA, userIdB]) {
    const me = byId.get(uid);
    const other = byId.get(uid === userIdA ? userIdB : userIdA);
    if (!me || !other) continue;
    const lang: Lang = me.language === "en" ? "en" : "el";
    const otherPublic: PublicProfile = publicProfile(other);
    await emitToUser(env, uid, {
      type: "match.created",
      at,
      payload: { match_id: outcome.matchId, other: otherPublic },
    });
    pushToUser(env, ctx, uid, {
      title: "Together",
      body: pushText.matchCreated(lang, other.first_name),
      data: { match_id: outcome.matchId },
    });
  }
}
