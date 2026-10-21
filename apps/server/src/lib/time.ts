// All timestamps in D1 are ISO-8601 UTC strings with second precision and a
// trailing Z (…T12:34:56Z). Sub-second precision is dropped so that string
// comparison in SQL stays consistent with JS Date comparison.

export const SECOND = 1_000;
export const MIN = 60 * SECOND;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function nowIso(): string {
  return toIso(Date.now());
}

export function isoIn(ms: number): string {
  return toIso(Date.now() + ms);
}

export function toIso(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Seconds elapsed since an ISO instant (for cooldowns etc.). */
export function secondsSince(iso: string): number {
  return Math.max(0, (Date.now() - Date.parse(iso)) / 1_000);
}
