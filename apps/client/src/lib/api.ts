// Thin fetch wrapper around the Worker API. Every call is JSON in / JSON out;
// errors arrive as { error: { code, message } } and become ApiError so
// screens can react to specific codes with plain-language messages.
import { Platform } from "react-native";
import type { Lang } from "@parea/shared";

/** GDPR consent version recorded at sign-up (must match the server). */
export const CONSENT_VERSION = "2026-10";

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

/** Called when the server answers 401 — set by the SessionProvider. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

/**
 * Session token source, registered by the store (an import cycle keeps api.ts
 * from reading it directly). Calls that don't pass `token` explicitly — most
 * of the write paths — used to go out with NO Authorization header, 401, and
 * trip the unauthorized handler into a surprise sign-out.
 */
let getToken: (() => string | null) | null = null;
export function setTokenProvider(fn: () => string | null) {
  getToken = fn;
}

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
  token?: string | null;
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
  const headers: Record<string, string> = {};
  // Explicit token wins (including `null` as an opt-out); otherwise the
  // store's session token rides along automatically.
  const token = opts.token !== undefined ? opts.token : (getToken?.() ?? null);
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(opts.query)}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // fetch throws TypeError on network failure (offline, server down).
    throw new ApiError(0, "network", "We couldn't reach Parea.");
  }

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
    throw new ApiError(401, "unauthorized", "Please sign in again.");
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = res.statusText || "Something went wrong.";
    try {
      const parsed = (await res.json()) as { error?: { code?: string; message?: string } };
      if (parsed.error?.code) code = parsed.error.code;
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Non-JSON error body — keep the fallbacks.
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

/**
 * Multipart photo upload (PUT /me/photo). Native FormData takes a
 * { uri, name, type } file reference instead of a Blob — a shape the DOM
 * types don't know, hence the cast. On web that shape silently sends
 * garbage, so there the local blob:/data: URI is fetched into a real Blob
 * first — without this, "add photo" did nothing in the browser.
 */
export async function uploadPhoto(
  token: string,
  uri: string,
): Promise<{ photo_url: string }> {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("photo", blob, "photo.jpg");
  } else {
    form.append("photo", { uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/me/photo`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError(0, "network", "We couldn't reach Parea.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, `http_${res.status}`, "The photo didn't upload.");
  }
  return (await res.json()) as { photo_url: string };
}

/** Locale tag for Intl / expo-speech. */
export function localeOf(lang: Lang): string {
  return lang === "el" ? "el-GR" : "en-US";
}
