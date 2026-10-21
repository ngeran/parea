// Shared test helpers: seed users/sessions/matches straight into D1, plus a
// small JSON fetch wrapper around SELF (the real Worker).

import { env, SELF } from "cloudflare:test";
import { sha256Hex } from "../src/lib/crypto";
import { DAY, isoIn } from "../src/lib/time";
import type { ProfileRow } from "../src/types";

let seq = 0;

export interface TestUser {
  id: string;
  token: string;
  phone: string;
}

/**
 * Insert a profile + a live session. Overrides are raw column values, so
 * tests can place users on exact grid points or hand out roles.
 */
export async function createUser(overrides: Partial<ProfileRow> = {}): Promise<TestUser> {
  seq += 1;
  const id = overrides.id ?? crypto.randomUUID();
  const phone = overrides.phone ?? `+30691${String(seq).padStart(7, "0")}`;
  const token = `test-token-${seq}-${crypto.randomUUID()}`;

  const row = {
    first_name: `Test${seq}`,
    photo_r2_key: null as string | null,
    lat: null as number | null,
    lng: null as number | null,
    verified: 0,
    role: "user" as "user" | "admin",
    radius_km: 10,
    language: "el" as "el" | "en",
    status: "active" as "active" | "disabled",
    ...overrides,
  };

  await env.DB.prepare(
    `INSERT INTO profiles
       (id, phone, first_name, photo_r2_key, lat, lng, verified, role, radius_km, language, status, consent_version, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-10', ?)`,
  )
    .bind(
      id,
      phone,
      row.first_name,
      row.photo_r2_key,
      row.lat,
      row.lng,
      row.verified,
      row.role,
      row.radius_km,
      row.language,
      row.status,
      isoIn(0),
    )
    .run();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  )
    .bind(await sha256Hex(token), id, isoIn(DAY))
    .run();

  return { id, token, phone };
}

/** An authorized JSON call against the Worker. */
export async function call(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  token: string | null,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return SELF.fetch(
    new Request(`https://example.com${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

/** Create a match row directly (ids sorted into the canonical order). */
export async function createMatch(
  aId: string,
  bId: string,
  source: "discover" | "request" = "discover",
): Promise<string> {
  const [userA, userB] = [aId, bId].sort();
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO matches (id, user_a, user_b, source) VALUES (?, ?, ?, ?)")
    .bind(id, userA, userB, source)
    .run();
  return id;
}

/** An ISO instant N hours from now (negative = past), seconds precision. */
export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Current pool versions no longer reset storage between tests, so every test
 * file wipes the database itself in a beforeEach hook. Children are deleted
 * before parents to satisfy the foreign keys (reports have no FKs at all).
 */
export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM feedback"),
    env.DB.prepare("DELETE FROM moderation_events"),
    env.DB.prepare("DELETE FROM reports"),
    env.DB.prepare("DELETE FROM messages"),
    env.DB.prepare("DELETE FROM plans"),
    env.DB.prepare("DELETE FROM responses"),
    env.DB.prepare("DELETE FROM requests"),
    env.DB.prepare("DELETE FROM matches"),
    env.DB.prepare("DELETE FROM discover_decisions"),
    env.DB.prepare("DELETE FROM blocks"),
    env.DB.prepare("DELETE FROM verification_submissions"),
    env.DB.prepare("DELETE FROM devices"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM trusted_contacts"),
    env.DB.prepare("DELETE FROM otp_codes"),
    env.DB.prepare("DELETE FROM otp_ip_log"),
    env.DB.prepare("DELETE FROM profiles"),
  ]);
}
