-- Phase 8: volunteer badge (Papa-style practical help) + user feedback.
--
-- Volunteers: `volunteer_requested` files an application (admin queue);
-- `is_volunteer` is the approved badge everyone sees. Toggling the setting
-- off clears both; only admins set `is_volunteer = 1`.
ALTER TABLE profiles ADD COLUMN volunteer_requested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_volunteer INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_profiles_volunteer ON profiles(volunteer_requested, is_volunteer);

-- Free-text feedback from the in-app button, reviewed in /admin. Anonymous
-- after account deletion (user_id → NULL), like reports.
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_feedback_created ON feedback(created_at);
