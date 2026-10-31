-- Pings ("waves") + the Nearby visibility opt-out.
--
-- A ping is a one-way hello shown only to its recipient: they accept (a match
-- opens — chat) or decline (silent, and permanent for the pair — enforced in
-- routes/pings.ts by rejecting a ping in EITHER direction, since
-- UNIQUE(from_id, to_id) only guards one direction).
--
-- `profiles.discoverable` hides a user from the Nearby list and the legacy
-- Discover deck while still letting them browse and ping others.

ALTER TABLE profiles ADD COLUMN discoverable INTEGER NOT NULL DEFAULT 1;

CREATE TABLE pings (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (from_id, to_id)
);
CREATE INDEX idx_pings_to ON pings(to_id, status);
CREATE INDEX idx_pings_from ON pings(from_id, created_at);

-- matches.source gains 'ping'. SQLite cannot ALTER a CHECK constraint, so the
-- table is rebuilt (the documented 12-step procedure, compressed). FK
-- children of matches are messages(match_id) and plans(match_id), both ON
-- DELETE CASCADE; defer_foreign_keys holds their checks until COMMIT, by
-- which point the rebuilt table holds the same rows under the same name.
-- idx_matches_a / idx_matches_b die with the old table and are recreated.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE matches_new (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- canonical order: user_a < user_b
  user_b TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('discover','request','ping')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
INSERT INTO matches_new (id, user_a, user_b, source, status, created_at)
  SELECT id, user_a, user_b, source, status, created_at FROM matches;
DROP TABLE matches;
ALTER TABLE matches_new RENAME TO matches;
CREATE INDEX idx_matches_a ON matches(user_a, status);
CREATE INDEX idx_matches_b ON matches(user_b, status);
