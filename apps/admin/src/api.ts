// Same-origin fetch wrapper around the Worker API. Mirrors the client's
// api.ts: JSON in / JSON out, errors as { error: { code, message } } surfaced
// as ApiError. The session token lives in localStorage — an internal tool on
// a trusted origin, no secure-store ceremony needed.

export const TOKEN_KEY = "parea_admin_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildQuery(query: ApiOptions["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${path}${buildQuery(opts.query)}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Cannot reach the Parea API.");
  }

  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = res.statusText || "Request failed.";
    try {
      const parsed = (await res.json()) as { error?: { code?: string; message?: string } };
      if (parsed.error?.code) code = parsed.error.code;
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Non-JSON error body — keep the fallbacks.
    }
    if (res.status === 401) signOut();
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

/**
 * Binary GET with the session token (the /photos routes reject requests
 * without the Authorization header, which <img src> cannot send) → object
 * URL for <img>. Caller revokes the URL on cleanup.
 */
export async function fetchBlobUrl(path: string): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, `http_${res.status}`, "Could not load the photo.");
  return URL.createObjectURL(await res.blob());
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AdminProfile {
  id: string;
  first_name: string;
  role: "user" | "admin";
}

export function signIn(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function hasToken(): boolean {
  return localStorage.getItem(TOKEN_KEY) !== null;
}

export function signOut(): void {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  // Fire-and-forget revoke; the local token is gone either way.
  void fetch("/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  localStorage.removeItem(TOKEN_KEY);
}

// ── Endpoint types (mirrors apps/server/src/routes/admin.ts) ────────────────

export interface AdminUser {
  id: string;
  first_name: string;
  phone: string;
  verified: number;
  is_volunteer: number;
  role: "user" | "admin";
  status: "active" | "disabled";
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
  created_at: string;
}

export interface VolunteerApplication {
  id: string;
  first_name: string;
  phone: string;
  about: string;
  verified: number;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  message: string;
  created_at: string;
  user_id: string | null;
  first_name: string | null;
}

export interface ReportRow {
  id: string;
  reporter_id: string | null;
  target_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  reporter_name: string | null;
  target_name: string | null;
}

export interface VerificationRow {
  id: string;
  user_id: string;
  r2_key: string;
  status: string;
  created_at: string;
  first_name: string;
  profile_photo: string | null;
  photo_url: string;
}

export interface Stats {
  users: number;
  open_requests: number;
  matches: number;
  messages_24h: number;
  plans_upcoming: number;
  reports_open: number;
}
