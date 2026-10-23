// Human-friendly dates and distances, in both languages, with plain words
// ("Today at 10:00" — never "2026-10-21T10:00:00Z").
import type { Lang } from "@parea/shared";
import { localeOf } from "./api";

/** ISO with seconds precision + Z — the exact format the API validates. */
export function toIso(d: Date): string {
  return d.toISOString().slice(0, 19) + "Z";
}

/** "27 Μαρτίου" / "27 March" — the home greeting's date line. */
export function formatToday(lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "long" }).format(
    new Date(),
  );
}

/** "Today at 14:00" / "Σήμερα στις 14:00" / "Tuesday, 3 November at …" */
export function formatWhen(iso: string, lang: Lang): string {
  const loc = localeOf(lang);
  const when = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit" }).format(when);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.round((that.getTime() - today.getTime()) / dayMs);
  if (dayDiff === 0) return lang === "el" ? `Σήμερα στις ${time}` : `Today at ${time}`;
  if (dayDiff === 1) return lang === "el" ? `Αύριο στις ${time}` : `Tomorrow at ${time}`;
  const day = new Intl.DateTimeFormat(loc, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(when);
  return lang === "el" ? `${day}, στις ${time}` : `${day} at ${time}`;
}

/** "≈ 700 μ." / "≈ 2 χλμ." — rounded, never precise (privacy + simplicity). */
export function formatDistance(km: number, lang: Lang): string {
  if (km < 1) {
    const m = Math.max(50, Math.round(km * 1000 / 100) * 100);
    return lang === "el" ? `≈ ${m} μ.` : `≈ ${m} m`;
  }
  const kmRounded = Math.round(km);
  return lang === "el" ? `≈ ${kmRounded} χλμ.` : `≈ ${kmRounded} km`;
}

/**
 * Compact day-chip label for the wizard's "another day" grid:
 * "Mon 27/10" / "Δευ 27/10". `dayAhead` 0 = today, 1 = tomorrow, …
 */
export function formatDayShort(dayAhead: number, lang: Lang): string {
  const d = new Date();
  d.setDate(d.getDate() + dayAhead);
  return new Intl.DateTimeFormat(localeOf(lang), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(d);
}
