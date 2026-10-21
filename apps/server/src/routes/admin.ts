// Admin API — consumed by the Vite dashboard (Phase 5). Every route is
// double-gated: requireAuth + requireAdmin.

import { Hono, type Context } from "hono";
import { pushText, type Lang } from "@together/shared";
import { AppError } from "../errors";
import { pushToUser } from "../lib/push";
import { photoUrl } from "../lib/serialize";
import { DAY, isoIn, nowIso } from "../lib/time";
import { requireAdmin, requireAuth } from "../middleware/auth";
import type { AppEnv, ProfileRow, ReportRow, TrustedContactRow } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth, requireAdmin);

// ── Users ───────────────────────────────────────────────────────────────────

app.get("/users", async (c) => {
  const q = c.req.query("q");
  const offset = Number(c.req.query("offset") ?? "0") || 0;
  const like = q ? `%${q}%` : null;
  const { results } = await c.env.DB.prepare(
    `SELECT id, first_name, phone, verified, is_volunteer, role, status, lat, lng, radius_km, created_at
     FROM profiles
     WHERE (?1 IS NULL OR first_name LIKE ?1 OR phone LIKE ?1)
     ORDER BY created_at DESC
     LIMIT 50 OFFSET ?2`,
  )
    .bind(like, offset)
    .all();
  const total = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM profiles WHERE (?1 IS NULL OR first_name LIKE ?1 OR phone LIKE ?1)",
  )
    .bind(like)
    .first<{ n: number }>();
  return c.json({ users: results, total: total?.n ?? 0 });
});

async function adminSetFlags(
  c: Context<AppEnv>,
  userId: string,
  updates: { verified?: number; status?: "active" | "disabled" },
): Promise<void> {
  const target = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
    .bind(userId)
    .first<ProfileRow>();
  if (!target) throw new AppError(404, "not_found", "User not found.");
  if (target.role === "admin") {
    throw new AppError(400, "admin_target", "Admin accounts cannot be changed here.");
  }
  const sets: string[] = [];
  const values: unknown[] = [];
  if (updates.verified !== undefined) (sets.push("verified = ?"), values.push(updates.verified));
  if (updates.status !== undefined) (sets.push("status = ?"), values.push(updates.status));
  if (sets.length === 0) return;
  values.push(userId);
  await c.env.DB.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
  if (updates.status === "disabled") {
    await c.env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0")
      .bind(userId)
      .run();
  }
}

app.post("/users/:id/verify", async (c) => {
  await adminSetFlags(c, c.req.param("id"), { verified: 1 });
  return c.json({ ok: true });
});

app.post("/users/:id/unverify", async (c) => {
  await adminSetFlags(c, c.req.param("id"), { verified: 0 });
  return c.json({ ok: true });
});

app.post("/users/:id/disable", async (c) => {
  await adminSetFlags(c, c.req.param("id"), { status: "disabled" });
  return c.json({ ok: true });
});

app.post("/users/:id/enable", async (c) => {
  await adminSetFlags(c, c.req.param("id"), { status: "active" });
  return c.json({ ok: true });
});

// ── Reports ─────────────────────────────────────────────────────────────────

app.get("/reports", async (c) => {
  const status = (c.req.query("status") ?? "open") as ReportRow["status"];
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, rp.first_name AS reporter_name, tp.first_name AS target_name
     FROM reports r
     LEFT JOIN profiles rp ON rp.id = r.reporter_id
     LEFT JOIN profiles tp ON tp.id = r.target_id
     WHERE r.status = ?
     ORDER BY r.created_at DESC
     LIMIT 100`,
  )
    .bind(status)
    .all();
  return c.json({ reports: results });
});

app.post("/reports/:id/action", async (c) => {
  const body = await c.req.json<{ action?: "dismiss" | "warn" | "disable" }>();
  const action = body.action;
  if (!action) throw new AppError(400, "bad_request", "Missing action.");

  const report = await c.env.DB.prepare("SELECT * FROM reports WHERE id = ?")
    .bind(c.req.param("id"))
    .first<ReportRow>();
  if (!report) throw new AppError(404, "not_found", "Report not found.");

  if (action === "dismiss") {
    await c.env.DB.prepare("UPDATE reports SET status = 'dismissed' WHERE id = ?")
      .bind(report.id)
      .run();
    return c.json({ ok: true });
  }

  // warn | disable act on the reported user.
  if (report.target_id) {
    const target = await c.env.DB.prepare("SELECT * FROM profiles WHERE id = ?")
      .bind(report.target_id)
      .first<ProfileRow>();
    if (target && target.role !== "admin") {
      const lang: Lang = target.language === "en" ? "en" : "el";
      if (action === "warn") {
        pushToUser(c.env, c.executionCtx, target.id, {
          title: "Together",
          body: pushText.warned(lang),
        });
      } else {
        await c.env.DB.prepare("UPDATE profiles SET status = 'disabled' WHERE id = ?")
          .bind(target.id)
          .run();
        await c.env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0")
          .bind(target.id)
          .run();
      }
    }
  }
  await c.env.DB.prepare("UPDATE reports SET status = 'actioned' WHERE id = ?")
    .bind(report.id)
    .run();
  await c.env.DB.prepare(
    "INSERT INTO moderation_events (id, type, actor_id, target_id, meta) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      `report_${action}`,
      c.get("user").id,
      report.target_id,
      JSON.stringify({ report_id: report.id }),
    )
    .run();
  return c.json({ ok: true });
});

// ── Verification review ─────────────────────────────────────────────────────

app.get("/verifications", async (c) => {
  const status = c.req.query("status") ?? "pending";
  const { results } = await c.env.DB.prepare(
    `SELECT v.id, v.user_id, v.r2_key, v.status, v.created_at, p.first_name, p.photo_r2_key AS profile_photo
     FROM verification_submissions v JOIN profiles p ON p.id = v.user_id
     WHERE v.status = ?
     ORDER BY v.created_at
     LIMIT 100`,
  )
    .bind(status)
    .all<{
      id: string;
      user_id: string;
      r2_key: string;
      status: string;
      created_at: string;
      first_name: string;
      profile_photo: string | null;
    }>();
  return c.json({
    verifications: results.map((v) => ({ ...v, photo_url: photoUrl(v.r2_key) })),
  });
});

app.post("/verifications/:id/approve", async (c) => {
  const sub = await c.env.DB.prepare(
    "SELECT * FROM verification_submissions WHERE id = ?",
  )
    .bind(c.req.param("id"))
    .first<{ id: string; user_id: string; status: string }>();
  if (!sub) throw new AppError(404, "not_found", "Submission not found.");

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE verification_submissions SET status = 'approved', reviewed_by = ? WHERE id = ?",
    ).bind(c.get("user").id, sub.id),
    c.env.DB.prepare("UPDATE profiles SET verified = 1 WHERE id = ?").bind(sub.user_id),
  ]);

  const profile = await c.env.DB.prepare("SELECT language FROM profiles WHERE id = ?")
    .bind(sub.user_id)
    .first<{ language: string }>();
  const lang: Lang = profile?.language === "en" ? "en" : "el";
  pushToUser(c.env, c.executionCtx, sub.user_id, {
    title: "Together",
    body: pushText.verified(lang),
  });
  return c.json({ ok: true });
});

app.post("/verifications/:id/reject", async (c) => {
  const res = await c.env.DB.prepare(
    "UPDATE verification_submissions SET status = 'rejected', reviewed_by = ? WHERE id = ? AND status = 'pending'",
  )
    .bind(c.get("user").id, c.req.param("id"))
    .run();
  if (res.meta.changes === 0) throw new AppError(404, "not_found", "Submission not found.");
  return c.json({ ok: true });
});

// ── Volunteer applications (Phase 8) ────────────────────────────────────────
// Light vetting: phone-verified account + admin reads the profile. No formal
// background check — that needs a partner organization.

app.get("/volunteers", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, first_name, phone, about, verified, created_at
     FROM profiles
     WHERE volunteer_requested = 1 AND is_volunteer = 0 AND status = 'active'
     ORDER BY created_at
     LIMIT 100`,
  ).all();
  return c.json({ volunteers: results });
});

app.post("/volunteers/:id/approve", async (c) => {
  const target = await c.env.DB.prepare(
    "SELECT id, language, role FROM profiles WHERE id = ? AND volunteer_requested = 1 AND is_volunteer = 0",
  )
    .bind(c.req.param("id"))
    .first<Pick<ProfileRow, "id" | "language" | "role">>();
  if (!target) throw new AppError(404, "not_found", "Application not found.");
  if (target.role === "admin") {
    throw new AppError(400, "admin_target", "Admin accounts cannot be changed here.");
  }

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE profiles SET is_volunteer = 1 WHERE id = ?").bind(target.id),
    c.env.DB.prepare(
      "INSERT INTO moderation_events (id, type, actor_id, target_id, meta) VALUES (?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(),
      "volunteer_approved",
      c.get("user").id,
      target.id,
      JSON.stringify({}),
    ),
  ]);

  const lang: Lang = target.language === "en" ? "en" : "el";
  pushToUser(c.env, c.executionCtx, target.id, {
    title: "Together",
    body: pushText.volunteerApproved(lang),
  });
  return c.json({ ok: true });
});

app.post("/volunteers/:id/reject", async (c) => {
  const res = await c.env.DB.prepare(
    "UPDATE profiles SET volunteer_requested = 0 WHERE id = ? AND volunteer_requested = 1 AND is_volunteer = 0",
  )
    .bind(c.req.param("id"))
    .run();
  if (res.meta.changes === 0) throw new AppError(404, "not_found", "Application not found.");
  return c.json({ ok: true });
});

// ── Feedback (read-only suggestion box) ─────────────────────────────────────

app.get("/feedback", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT f.id, f.message, f.created_at, f.user_id, p.first_name
     FROM feedback f LEFT JOIN profiles p ON p.id = f.user_id
     ORDER BY f.created_at DESC
     LIMIT 200`,
  ).all<{ id: string; message: string; created_at: string; user_id: string | null; first_name: string | null }>();
  return c.json({ feedback: results });
});

// ── Stats (privacy-friendly counters only) ──────────────────────────────────

app.get("/stats", async (c) => {
  const now = nowIso();
  const [users, openRequests, matchesTotal, messages24h, plansUpcoming, reportsOpen] =
    await c.env.DB.batch([
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM profiles"),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'open' AND starts_at > ?").bind(now),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM matches WHERE status = 'active'"),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE created_at > ?").bind(isoIn(-DAY)),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM plans WHERE status = 'planned' AND starts_at > ?").bind(now),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    ]);
  return c.json({
    users: firstCount(users),
    open_requests: firstCount(openRequests),
    matches: firstCount(matchesTotal),
    messages_24h: firstCount(messages24h),
    plans_upcoming: firstCount(plansUpcoming),
    reports_open: firstCount(reportsOpen),
  });
});

function firstCount(result: { results: unknown[] }): number {
  const row = result.results[0] as { n?: unknown } | undefined;
  return typeof row?.n === "number" ? row.n : 0;
}

// Trusted contacts are admin-visible only through explicit user inspection —
// kept out of the list endpoint on purpose (they belong to the user).
app.get("/users/:id/trusted-contacts", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, phone, relationship, notify FROM trusted_contacts WHERE user_id = ?",
  )
    .bind(c.req.param("id"))
    .all<TrustedContactRow>();
  return c.json({ contacts: results.map((r) => ({ ...r, notify: r.notify === 1 })) });
});
