// Converters from DB rows to API DTOs. Phones and exact locations never
// leave the server; photo URLs are relative to the API origin.

import type { Lang, Mobility, PublicProfile, SelfProfile } from "@together/shared";
import type { ProfileRow } from "../types";

export function maskPhone(phone: string): string {
  if (phone.length <= 6) return "***";
  return `${phone.slice(0, 4)}****${phone.slice(-4)}`;
}

export function photoUrl(key: string | null): string | null {
  return key ? `/photos/${key}` : null;
}

// Minimal structural shape satisfied by ProfileRow and NearbyProfileRow alike.
export interface PublicProfileSrc {
  id: string;
  first_name: string;
  photo_r2_key: string | null;
  about: string;
  interests: string;
  languages: string;
  mobility: Mobility;
  verified: number;
  is_volunteer: number;
  birth_year: number | null;
}

export function publicProfile(row: PublicProfileSrc, distanceKm?: number): PublicProfile {
  return {
    id: row.id,
    first_name: row.first_name,
    photo_url: photoUrl(row.photo_r2_key),
    about: row.about,
    interests: parseJsonArray(row.interests),
    languages: parseJsonArray(row.languages) as Lang[],
    mobility: row.mobility,
    verified: row.verified === 1,
    volunteer: row.is_volunteer === 1,
    birth_year: row.birth_year,
    ...(distanceKm !== undefined
      ? { distance_km: Math.round(distanceKm * 10) / 10 }
      : {}),
  };
}

export function selfProfile(row: ProfileRow): SelfProfile {
  return {
    ...publicProfile(row),
    phone_masked: maskPhone(row.phone),
    radius_km: row.radius_km,
    text_size: row.text_size,
    theme: row.theme,
    language: row.language,
    push_enabled: row.push_enabled === 1,
    volunteer_requested: row.volunteer_requested === 1,
    // Rounded to the ~500 m grid, like everything in D1 — exact positions
    // never exist anywhere in the system.
    lat: row.lat,
    lng: row.lng,
  };
}

function parseJsonArray(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
