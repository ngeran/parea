-- Together — initial schema (D1 / SQLite)
-- All timestamps are ISO-8601 UTC strings ending in Z (e.g. 2026-10-20T12:34:56Z)
-- so lexicographic comparison works everywhere. Never store sub-second precision.

-- Locations are ALWAYS snapped to a ~500 m grid before being stored
-- (see src/lib/geo.ts). Exact positions never reach the database.

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,                          -- uuid, same as the auth subject
  phone TEXT NOT NULL UNIQUE,                   -- E.164, e.g. +306912345678
  first_name TEXT NOT NULL DEFAULT '',
  photo_r2_key TEXT,                            -- photos/<user-id>/<uuid>.<ext>
  about TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '[]',         -- JSON array of strings
  languages TEXT NOT NULL DEFAULT '["el"]',     -- JSON array of Lang
  mobility TEXT NOT NULL DEFAULT 'walk' CHECK (mobility IN ('walk','ride','home')),
  birth_year INTEGER,                           -- self-declared; shown as approximate age
  verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  lat REAL,                                     -- snapped to ~500 m grid, NULL until first fix
  lng REAL,
  radius_km INTEGER NOT NULL DEFAULT 10 CHECK (radius_km BETWEEN 1 AND 50),
  text_size TEXT NOT NULL DEFAULT 'normal' CHECK (text_size IN ('normal','large','xlarge')),
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','contrast')),
  language TEXT NOT NULL DEFAULT 'el' CHECK (language IN ('el','en')),
  push_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  consent_version TEXT,                         -- e.g. "2026-10"
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE trusted_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('child','sibling','friend','carer','other')),
  notify INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_trusted_contacts_user ON trusted_contacts(user_id);

CREATE TABLE otp_codes (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,                      -- HMAC-SHA256(code, OTP_PEPPER)
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT NOT NULL,
  hour_start TEXT NOT NULL,
  hour_count INTEGER NOT NULL DEFAULT 1
);

-- Per-IP throttle log for OTP requests (cleaned up by the hourly cron).
CREATE TABLE otp_ip_log (
  ip TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX idx_otp_ip ON otp_ip_log(ip, at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                  -- SHA-256(token); raw token lives only on the device
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE devices (
  push_token TEXT PRIMARY KEY,                  -- Expo push token
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_devices_user ON devices(user_id);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  place_type TEXT NOT NULL,
  lat REAL NOT NULL,                            -- snapped ~500 m grid
  lng REAL NOT NULL,
  radius_km INTEGER NOT NULL CHECK (radius_km BETWEEN 1 AND 50),  -- who can see it
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','done','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_requests_geo ON requests(status, lat, lng);
CREATE INDEX idx_requests_user ON requests(user_id, status);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  responder_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (request_id, responder_id)
);
CREATE INDEX idx_responses_request ON responses(request_id);
CREATE INDEX idx_responses_responder ON responses(responder_id, status);

-- One row per connection, whatever its origin: a mutual Discover "yes" or an
-- accepted request response. Chat and plans always attach to a match.
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- canonical order: user_a < user_b
  user_b TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('discover','request')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX idx_matches_a ON matches(user_a, status);
CREATE INDEX idx_matches_b ON matches(user_b, status);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  -- 0 clean · 1 delivered but flagged (links) · 2 held for moderation (never delivered)
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_messages_match ON messages(match_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,                     -- public meeting place, never a home address
  place_lat REAL,
  place_lng REAL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled')),
  safe_checkin_at TEXT,
  shared_with_contact_at TEXT,                  -- first time the trusted contact was told
  checkin_missed_notified_at TEXT,              -- set once by the 15-min cron
  reminder_sent_at TEXT,                        -- set once by the daily cron
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_plans_match ON plans(match_id);
CREATE INDEX idx_plans_start ON plans(status, starts_at);

CREATE TABLE discover_decisions (
  viewer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  yes INTEGER NOT NULL,                         -- 1 = "Yes, let's meet", 0 = "Not now"
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (viewer_id, target_id)
);

-- Reports deliberately have NO foreign keys: they outlive deleted accounts,
-- with target/reporter nulled and the rest anonymized at delete time.
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT,                             -- nulled when the reporter deletes their account
  target_id TEXT,                               -- nulled when the target deletes their account
  reason TEXT NOT NULL CHECK (reason IN ('scam','harassment','fake','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_reports_status ON reports(status, created_at);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

CREATE TABLE verification_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_verifications_status ON verification_submissions(status, created_at);

-- Audit trail for moderation-relevant actions (reports, SOS, warns, blocks).
CREATE TABLE moderation_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  actor_id TEXT,
  target_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',              -- JSON blob
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
