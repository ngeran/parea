-- Demo data for SHARED environments (the deployed API's D1), where the full
-- seed.sql must never run — it resets every table and would wipe real
-- accounts. Everything here is additive and namespaced: it only writes rows
-- whose id starts with seed- (or phone +3069000000xx), and only touches
-- requests nobody has responded to. Re-running is safe and refreshes the
-- demo requests' times.
--
-- Photos: run `npm run db:avatars:remote` once so the R2 objects exist for
-- the photo_r2_key values below (they must match photos.ts KEY_RE).
--
-- Apply with:  npm run db:seed:remote   (in apps/server)
--
-- Coordinates: the canonical demo cluster is Thessaloniki (matching the
-- Greek profile texts). To point the cluster at a tester instead, run a
-- one-off after this file:
--   wrangler d1 execute parea --remote \
--     --command "UPDATE profiles SET lat=<lat>, lng=<lng> WHERE id LIKE 'seed-%'"

-- ── Demo profiles (idempotent: existing rows are never modified) ───────────
INSERT OR IGNORE INTO profiles (id, phone, first_name, about, interests, languages, mobility, birth_year, verified, role, lat, lng, radius_km, language, photo_r2_key) VALUES
  ('seed-maria',    '+306900000001', 'Μαρία',    'Αγαπώ τους κήπους και τη θάλασσα. Φτιάχνω ωραίο ψωμί.', '["garden","sea","cooking"]', '["el"]',        'walk', 1957, 1, 'user', 40.640, 22.945, 10, 'el', 'photos/5eed0001-0000-4000-8000-000000000001.png'),
  ('seed-nikos',    '+306900000002', 'Νίκος',    'Συλλέγω βιβλία και παίζω σκάκι στο πάρκο.',             '["books","chess","walks"]',  '["el","en"]',   'walk', 1954, 1, 'user', 40.645, 22.940, 10, 'el', 'photos/5eed0002-0000-4000-8000-000000000002.png'),
  ('seed-eleni',    '+306900000003', 'Ελένη',    'Χορεύω παραδοσιακά και μαγειρεύω για τα εγγόνια.',      '["cooking","grandchildren","music"]', '["el"]', 'home', 1949, 0, 'user', 40.635, 22.950, 15, 'el', 'photos/5eed0003-0000-4000-8000-000000000003.png'),
  ('seed-dimitris', '+306900000004', 'Δημήτρης', 'Πρώτος ναυτικός. Τώρα περπατάω κάθε μέρα.',             '["walks","sea","movies"]',   '["el","en"]',   'walk', 1952, 1, 'user', 40.650, 22.945, 10, 'el', 'photos/5eed0004-0000-4000-8000-000000000004.png'),
  ('seed-sofia',    '+306900000005', 'Σοφία',    'Ζωγραφίζω με ακουαρέλα. Δύο εγγόνια, δύο ήλιοι.',       '["crafts","grandchildren","garden"]', '["el"]', 'ride', 1960, 0, 'user', 40.630, 22.940, 5, 'el', 'photos/5eed0005-0000-4000-8000-000000000005.png'),
  ('seed-giorgos',  '+306900000006', 'Γιώργος',  'Τραγουδώ στο χορωδιακό της γειτονιάς.',                 '["music","church","walks"]', '["el"]',        'walk', 1945, 1, 'user', 40.660, 22.970, 20, 'el', 'photos/5eed0006-0000-4000-8000-000000000006.png'),
  ('seed-katerina', '+306900000007', 'Κατερίνη', 'Διαβάζω αστυνομικά και φροντίζω βασιλικούς.',           '["books","garden","coffee"]','["el","en"]',   'home', 1958, 0, 'user', 40.700, 22.900, 10, 'en', 'photos/5eed0007-0000-4000-8000-000000000007.png'),
  ('seed-vasilis',  '+306900000008', 'Βασίλης',  'Μένω λίγο έξω από την πόλη. Καλή παρέα στο μαγαζί.',    '["coffee","movies","chess"]','["el"]',        'ride', 1951, 0, 'user', 40.900, 22.500, 50, 'el', 'photos/5eed0008-0000-4000-8000-000000000008.png'),
  ('seed-admin',    '+306900000009', 'Διαχειριστής', 'Λογαριασμός συντονιστή.', '[]', '["el","en"]', 'walk', 1970, 1, 'admin', 40.640, 22.945, 10, 'el', 'photos/5eed0009-0000-4000-8000-000000000009.png'),
  ('seed-anna',     '+306900000010', 'Άννα',     'Οδοντίατρος παλιά. Τώρα βόλτα και καφεδάκια.',          '["coffee","walks","books"]', '["el","en"]',   'walk', 1959, 1, 'user', 40.642, 22.948, 10, 'en', 'photos/5eed000a-0000-4000-8000-00000000000a.png');

-- ── Open demo requests, times relative to whenever this runs ───────────────
-- Skipped (kept as-is) if a real user has already responded to one — the row
-- must not move out from under an active response.
DELETE FROM requests
 WHERE id LIKE 'seed-req-%'
   AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.request_id = requests.id);

INSERT OR IGNORE INTO requests (id, user_id, activity, starts_at, place_type, lat, lng, radius_km, status) VALUES
  ('seed-req-1', 'seed-maria', 'coffee',      strftime('%Y-%m-%dT11:00:00Z','now','+1 day'), 'cafe',        40.640, 22.945, 10, 'open'),
  ('seed-req-2', 'seed-nikos', 'supermarket', strftime('%Y-%m-%dT17:00:00Z','now','+3 hours'), 'supermarket', 40.645, 22.940, 5,  'open'),
  ('seed-req-3', 'seed-eleni', 'walk',        strftime('%Y-%m-%dT18:00:00Z','now','+1 day'), 'walk_route',  40.635, 22.950, 15, 'open');
