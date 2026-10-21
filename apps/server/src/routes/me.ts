// Everything about the signed-in user: profile, photo, location (snapped!),
// verification submission, trusted contacts, GDPR export and account deletion.

import { Hono } from "hono";
import {
  deviceRegisterSchema,
  locationSchema,
  profilePatchSchema,
  trustedContactSchema,
  type TrustedContactDTO,
} from "@parea/shared";
import { AppError } from "../errors";
import { maskPhone, photoUrl, selfProfile } from "../lib/serialize";
import { storeImage } from "../lib/upload";
import { snapToGrid } from "../lib/geo";
import { nowIso } from "../lib/time";
import { requireAuth } from "../middleware/auth";
import type { AppEnv, ProfileRow, TrustedContactRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

const MAX_CONTACTS = 5;

function contactDto(row: TrustedContactRow): TrustedContactDTO {
  return {
    id: row.id,
    name: row.name,
    phone_masked: maskPhone(row.phone),
    relationship: row.relationship,
    notify: row.notify === 1,
  };
}

app.get("/", (c) => c.json(selfProfile(c.get("user"))));

app.patch("/", async (c) => {
  const patch = profilePatchSchema.parse(await c.req.json());
  const serialized: Record<string, (v: unknown) => unknown> = {
    interests: (v) => JSON.stringify(v),
    languages: (v) => JSON.stringify(v),
    push_enabled: (v) => (v ? 1 : 0),
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  // Volunteer isn't a bare column: on = file an application for the admin
  // queue; off = withdraw it and drop an existing badge immediately.
  if (patch.volunteer !== undefined) {
    if (patch.volunteer) {
      sets.push("volunteer_requested = 1");
    } else {
      sets.push("volunteer_requested = 0", "is_volunteer = 0");
    }
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || key === "volunteer") continue;
    sets.push(`${key} = ?`);
    values.push(serialized[key] ? serialized[key](value) : value);
  }
  if (sets.length > 0) {
    values.push(c.get("user").id);
    await c.env.DB.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
    .bind(c.get("user").id)
    .first<ProfileRow>();
  if (!row) throw new AppError(500, "internal", "Could not load the profile.");
  return c.json(selfProfile(row));
});

/** Coarse location update — the server snaps it to ~500 m before storing. */
app.post("/location", async (c) => {
  const { lat, lng } = locationSchema.parse(await c.req.json());
  const snapped = snapToGrid(lat, lng);
  await c.env.DB.prepare("UPDATE profiles SET lat = ?, lng = ? WHERE id = ?")
    .bind(snapped.lat, snapped.lng, c.get("user").id)
    .run();
  // The client learns the coarse value that was actually stored.
  return c.json(snapped);
});

/** Register (or re-register) this device for Expo push notifications. */
app.post("/device", async (c) => {
  const { push_token, platform } = deviceRegisterSchema.parse(await c.req.json());
  await c.env.DB.prepare(
    `INSERT INTO devices (push_token, user_id, platform) VALUES (?, ?, ?)
     ON CONFLICT(push_token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`,
  )
    .bind(push_token, c.get("user").id, platform ?? "unknown")
    .run();
  return c.json({ ok: true });
});

app.put("/photo", async (c) => {
  const body = await c.req.parseBody();
  const key = await storeImage(c.env, body["photo"], "photos");
  const oldKey = c.get("user").photo_r2_key;
  await c.env.DB.prepare("UPDATE profiles SET photo_r2_key = ? WHERE id = ?")
    .bind(key, c.get("user").id)
    .run();
  if (oldKey && oldKey !== key) {
    c.executionCtx.waitUntil(c.env.PHOTOS.delete(oldKey));
  }
  return c.json({ photo_url: photoUrl(key) });
});

/** Photo/ID verification submission → lands in the admin review queue. */
app.post("/verification", async (c) => {
  const body = await c.req.parseBody();
  const key = await storeImage(c.env, body["photo"], "verification");
  const pending = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM verification_submissions WHERE user_id = ? AND status = 'pending'",
  )
    .bind(c.get("user").id)
    .first<{ n: number }>();
  if ((pending?.n ?? 0) >= 1) {
    throw new AppError(409, "verification_pending", "You already have a review in progress.");
  }
  await c.env.DB.prepare(
    "INSERT INTO verification_submissions (id, user_id, r2_key) VALUES (?, ?, ?)",
  )
    .bind(crypto.randomUUID(), c.get("user").id, key)
    .run();
  return c.json({ ok: true }, 201);
});

// ── Trusted contacts ────────────────────────────────────────────────────────

app.get("/trusted-contacts", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM trusted_contacts WHERE user_id = ? ORDER BY created_at",
  )
    .bind(c.get("user").id)
    .all<TrustedContactRow>();
  return c.json({ contacts: results.map(contactDto) });
});

app.post("/trusted-contacts", async (c) => {
  const input = trustedContactSchema.parse(await c.req.json());
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM trusted_contacts WHERE user_id = ?",
  )
    .bind(c.get("user").id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_CONTACTS) {
    throw new AppError(429, "contact_limit", `Up to ${MAX_CONTACTS} trusted contacts.`);
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO trusted_contacts (id, user_id, name, phone, relationship, notify) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, c.get("user").id, input.name, input.phone, input.relationship, input.notify === false ? 0 : 1)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM trusted_contacts WHERE id = ?")
    .bind(id)
    .first<TrustedContactRow>();
  if (!row) throw new AppError(500, "internal", "Could not load the contact.");
  return c.json(contactDto(row), 201);
});

app.patch("/trusted-contacts/:id", async (c) => {
  const id = c.req.param("id");
  const patch = trustedContactSchema.partial().parse(await c.req.json());
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) (sets.push("name = ?"), values.push(patch.name));
  if (patch.phone !== undefined) (sets.push("phone = ?"), values.push(patch.phone));
  if (patch.relationship !== undefined) (sets.push("relationship = ?"), values.push(patch.relationship));
  if (patch.notify !== undefined) (sets.push("notify = ?"), values.push(patch.notify ? 1 : 0));
  if (sets.length === 0) throw new AppError(400, "nothing_to_update", "Nothing to update.");
  values.push(id, c.get("user").id);
  const res = await c.env.DB.prepare(
    `UPDATE trusted_contacts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
  )
    .bind(...values)
    .run();
  if (res.meta.changes === 0) throw new AppError(404, "not_found", "Contact not found.");
  return c.json({ ok: true });
});

app.delete("/trusted-contacts/:id", async (c) => {
  const res = await c.env.DB.prepare(
    "DELETE FROM trusted_contacts WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("id"), c.get("user").id)
    .run();
  if (res.meta.changes === 0) throw new AppError(404, "not_found", "Contact not found.");
  return c.json({ ok: true });
});

// ── GDPR: export + delete ───────────────────────────────────────────────────

app.get("/export", async (c) => {
  const uid = c.get("user").id;
  const db = c.env.DB;
  const [profile, contacts, requests, responses, matches, messages, plans, decisions, blocks, reports, feedback] =
    await Promise.all([
      db.prepare("SELECT * FROM profiles WHERE id = ?").bind(uid).first(),
      db.prepare("SELECT * FROM trusted_contacts WHERE user_id = ?").bind(uid).all(),
      db.prepare("SELECT * FROM requests WHERE user_id = ?").bind(uid).all(),
      db.prepare("SELECT * FROM responses WHERE responder_id = ?").bind(uid).all(),
      db.prepare("SELECT * FROM matches WHERE user_a = ? OR user_b = ?").bind(uid, uid).all(),
      db.prepare("SELECT * FROM messages WHERE sender_id = ?").bind(uid).all(),
      db.prepare(
        "SELECT pl.* FROM plans pl JOIN matches m ON m.id = pl.match_id WHERE m.user_a = ? OR m.user_b = ?",
      )
        .bind(uid, uid)
        .all(),
      db.prepare("SELECT * FROM discover_decisions WHERE viewer_id = ?").bind(uid).all(),
      db.prepare("SELECT * FROM blocks WHERE blocker_id = ?").bind(uid).all(),
      db.prepare("SELECT * FROM reports WHERE reporter_id = ?").bind(uid).all(),
      db.prepare("SELECT message, created_at FROM feedback WHERE user_id = ?").bind(uid).all(),
    ]);
  const payload = {
    exported_at: nowIso(),
    profile,
    trusted_contacts: contacts.results,
    my_requests: requests.results,
    my_responses: responses.results,
    my_matches: matches.results,
    my_messages: messages.results,
    my_plans: plans.results,
    discover_decisions: decisions.results,
    blocks: blocks.results,
    reports_filed: reports.results,
    feedback_sent: feedback.results,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="together-export-${nowIso().slice(0, 10)}.json"`,
    },
  });
});

app.delete("/", async (c) => {
  const uid = c.get("user").id;
  const db = c.env.DB;

  // Collect R2 keys BEFORE the rows are gone.
  const photoKey = c.get("user").photo_r2_key;
  const verifications = await db
    .prepare("SELECT r2_key FROM verification_submissions WHERE user_id = ?")
    .bind(uid)
    .all<{ r2_key: string }>();

  // Reports deliberately outlive accounts (moderation duty), but the deleted
  // person's references and notes are stripped. Feedback is anonymised the
  // same way — admins keep the text, the name goes.
  await db.batch([
    db.prepare("UPDATE reports SET reporter_id = NULL, details = NULL WHERE reporter_id = ?").bind(uid),
    db.prepare("UPDATE reports SET target_id = NULL WHERE target_id = ?").bind(uid),
    db.prepare("UPDATE feedback SET user_id = NULL WHERE user_id = ?").bind(uid),
  ]);

  // Explicit child deletes (belt and braces alongside the FK cascades).
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid),
    db.prepare("DELETE FROM devices WHERE user_id = ?").bind(uid),
    db.prepare("DELETE FROM trusted_contacts WHERE user_id = ?").bind(uid),
    db.prepare("DELETE FROM discover_decisions WHERE viewer_id = ? OR target_id = ?").bind(uid, uid),
    db.prepare("DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?").bind(uid, uid),
    db.prepare("DELETE FROM verification_submissions WHERE user_id = ?").bind(uid),
    db.prepare("DELETE FROM messages WHERE sender_id = ?").bind(uid),
    db.prepare("DELETE FROM responses WHERE responder_id = ?").bind(uid),
    db.prepare(
      "DELETE FROM plans WHERE match_id IN (SELECT id FROM matches WHERE user_a = ? OR user_b = ?)",
    ).bind(uid, uid),
    db.prepare("DELETE FROM matches WHERE user_a = ? OR user_b = ?").bind(uid, uid),
    db.prepare("DELETE FROM requests WHERE user_id = ?").bind(uid),
    db.prepare("DELETE FROM profiles WHERE id = ?").bind(uid),
  ]);

  // R2 objects: profile photo + verification uploads.
  const keys = [photoKey, ...verifications.results.map((v) => v.r2_key)].filter(
    (k): k is string => Boolean(k),
  );
  if (keys.length > 0) {
    c.executionCtx.waitUntil(Promise.all(keys.map((k) => c.env.PHOTOS.delete(k))));
  }

  return c.json({ ok: true });
});
