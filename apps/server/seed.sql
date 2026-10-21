-- Together — development seed data (NEVER run against production).
-- Ten seniors around Thessaloniki, a couple of open requests, one match
-- with chat history, a trusted contact, a block, and one plan that is
-- overdue for the "I'm safe" check-in (so the cron sweep has something to do).
--
-- Apply with:  npm run db:migrate && npm run db:seed   (in apps/server)

DELETE FROM moderation_events;
DELETE FROM verification_submissions;
DELETE FROM blocks;
DELETE FROM reports;
DELETE FROM discover_decisions;
DELETE FROM plans;
DELETE FROM messages;
DELETE FROM matches;
DELETE FROM responses;
DELETE FROM requests;
DELETE FROM devices;
DELETE FROM sessions;
DELETE FROM trusted_contacts;
DELETE FROM otp_codes;
DELETE FROM otp_ip_log;
DELETE FROM profiles;

-- ── Profiles ────────────────────────────────────────────────────────────────
-- Coordinates are already snapped to the ~500 m grid (see src/lib/geo.ts).
INSERT INTO profiles (id, phone, first_name, about, interests, languages, mobility, birth_year, verified, role, lat, lng, radius_km, language) VALUES
  ('seed-maria',    '+306900000001', 'Μαρία',    'Αγαπώ τους κήπους και τη θάλασσα. Φτιάχνω ωραίο ψωμί.', '["garden","sea","cooking"]', '["el"]',        'walk', 1957, 1, 'user', 40.640, 22.945, 10, 'el'),
  ('seed-nikos',    '+306900000002', 'Νίκος',    'Συλλέγω βιβλία και παίζω σκάκι στο πάρκο.',             '["books","chess","walks"]',  '["el","en"]',   'walk', 1954, 1, 'user', 40.645, 22.940, 10, 'el'),
  ('seed-eleni',    '+306900000003', 'Ελένη',    'Χορεύω παραδοσιακά και μαγειρεύω για τα εγγόνια.',      '["cooking","grandchildren","music"]', '["el"]', 'home', 1949, 0, 'user', 40.635, 22.950, 15, 'el'),
  ('seed-dimitris', '+306900000004', 'Δημήτρης', 'Πρώτος ναυτικός. Τώρα περπατάω κάθε μέρα.',             '["walks","sea","movies"]',   '["el","en"]',   'walk', 1952, 1, 'user', 40.650, 22.945, 10, 'el'),
  ('seed-sofia',    '+306900000005', 'Σοφία',    'Ζωγραφίζω με ακουαρέλα. Δύο εγγόνια, δύο ήλιοι.',       '["crafts","grandchildren","garden"]', '["el"]', 'ride', 1960, 0, 'user', 40.630, 22.940, 5, 'el'),
  ('seed-giorgos',  '+306900000006', 'Γιώργος',  'Τραγουδώ στο χορωδιακό της γειτονιάς.',                 '["music","church","walks"]', '["el"]',        'walk', 1945, 1, 'user', 40.660, 22.970, 20, 'el'),
  ('seed-katerina', '+306900000007', 'Κατερίνη', 'Διαβάζω αστυνομικά και φροντίζω βασιλικούς.',           '["books","garden","coffee"]','["el","en"]',   'home', 1958, 0, 'user', 40.700, 22.900, 10, 'en'),
  ('seed-vasilis',  '+306900000008', 'Βασίλης',  'Μένω λίγο έξω από την πόλη. Καλή παρέα στο μαγαζί.',    '["coffee","movies","chess"]','["el"]',        'ride', 1951, 0, 'user', 40.900, 22.500, 50, 'el'),
  ('seed-admin',    '+306900000009', 'Διαχειριστής', 'Λογαριασμός συντονιστή.', '[]', '["el","en"]', 'walk', 1970, 1, 'admin', 40.640, 22.945, 10, 'el'),
  ('seed-anna',     '+306900000010', 'Άννα',     'Οδοντίατρος παλιά. Τώρα βόλτα και καφεδάκια.',          '["coffee","walks","books"]', '["el","en"]',   'walk', 1959, 1, 'user', 40.642, 22.948, 10, 'en');

-- ── Open requests (tomorrow / later today) ──────────────────────────────────
INSERT INTO requests (id, user_id, activity, starts_at, place_type, lat, lng, radius_km, status) VALUES
  ('seed-req-1', 'seed-maria', 'coffee',      strftime('%Y-%m-%dT11:00:00Z','now','+1 day'), 'cafe',        40.640, 22.945, 10, 'open'),
  ('seed-req-2', 'seed-nikos', 'supermarket', strftime('%Y-%m-%dT17:00:00Z','now','+3 hours'), 'supermarket', 40.645, 22.940, 5,  'open'),
  ('seed-req-3', 'seed-eleni', 'walk',        strftime('%Y-%m-%dT18:00:00Z','now','+1 day'), 'walk_route',  40.635, 22.950, 15, 'open');

-- ── A match (discover) with chat history ────────────────────────────────────
INSERT INTO matches (id, user_a, user_b, source, status) VALUES
  ('seed-match-1', 'seed-eleni', 'seed-nikos', 'discover', 'active');  -- canonical order: eleni < nikos

INSERT INTO messages (id, match_id, sender_id, body, flagged, created_at) VALUES
  ('seed-msg-1', 'seed-match-1', 'seed-eleni', 'Καλημέρα Νίκη! Χαίρομαι που τα βρήκαμε. 😊', 0, strftime('%Y-%m-%dT09:00:00Z','now')),
  ('seed-msg-2', 'seed-match-1', 'seed-nikos', 'Καλημέρα Ελένη! Σκεφτόμουν καφέ στο Λευκό Πύργο αύριο.', 0, strftime('%Y-%m-%dT09:05:00Z','now'));

-- A plan for that match, overdue for the safety check-in:
-- starts 3 hours ago, trusted contact already told, no check-in yet.
-- The 15-minute cron will SMS Ελένη's trusted contact about Νίκος (and vice versa).
INSERT INTO plans (id, match_id, place_name, place_lat, place_lng, starts_at, status, shared_with_contact_at) VALUES
  ('seed-plan-1', 'seed-match-1', 'Καφετέρια Λευκός Πύργος', 40.625, 22.945,
   strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 hours'), 'planned', strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 hours'));

-- ── Trusted contact ─────────────────────────────────────────────────────────
INSERT INTO trusted_contacts (id, user_id, name, phone, relationship, notify) VALUES
  ('seed-tc-1', 'seed-eleni', 'Βαγγέλης (γιος)', '+306911110000', 'child', 1),
  ('seed-tc-2', 'seed-nikos', 'Αναστασία (κόρη)', '+306922220000', 'child', 1);

-- ── A block (Σοφία has blocked Βασίλης) ─────────────────────────────────────
INSERT INTO blocks (blocker_id, blocked_id) VALUES ('seed-sofia', 'seed-vasilis');

-- ── An open report for the admin queue ──────────────────────────────────────
INSERT INTO reports (id, reporter_id, target_id, reason, details, status) VALUES
  ('seed-report-1', 'seed-sofia', 'seed-vasilis', 'other', 'Στενοχώρησε με όταν του είπα όχι.', 'open');
