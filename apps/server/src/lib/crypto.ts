// Cryptographic helpers. Web Crypto only — no Node APIs needed here.

const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toHex(new Uint8Array(digest));
}

export async function hmacHex(key: string, message: string): Promise<string> {
  const secret = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", secret, encoder.encode(message));
  return toHex(new Uint8Array(signature));
}

/**
 * Timing-safe comparison of two fixed-length hex strings (hashes).
 * Uses the workerd-native crypto.subtle.timingSafeEqual.
 */
export async function secretsEqual(aHex: string, bHex: string): Promise<boolean> {
  const a = encoder.encode(aHex);
  const b = encoder.encode(bHex);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(copyToBuffer(a), copyToBuffer(b));
}

function copyToBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 256-bit url-safe token for sessions. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 6-digit numeric OTP code, uniformly random. */
export function randomOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}
