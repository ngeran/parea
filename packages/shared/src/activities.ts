// Activity and place catalogs. `key` is stored in D1; labels/emoji are for UI.
// Add new entries at the END of each list — keys are persisted values.
import type { Lang } from "./types";

export interface CatalogEntry {
  key: string;
  emoji: string;
  label: Record<Lang, string>;
}

export const ACTIVITIES: readonly CatalogEntry[] = [
  { key: "coffee", emoji: "☕", label: { en: "Coffee", el: "Καφές" } },
  { key: "supermarket", emoji: "🛒", label: { en: "Supermarket", el: "Σούπερ μάρκετ" } },
  { key: "errands", emoji: "🧺", label: { en: "Errands", el: "Δουλειές" } },
  { key: "meal", emoji: "🍽️", label: { en: "Lunch or dinner", el: "Φαγητό" } },
  { key: "walk", emoji: "🚶", label: { en: "A walk", el: "Βόλτα" } },
  { key: "call", emoji: "📞", label: { en: "Just talk on the phone", el: "Κουβέντα στο τηλέφωνο" } },
  { key: "other", emoji: "✨", label: { en: "Something else", el: "Κάτι άλλο" } },
  // Practical-help activities (Phase 8, the Papa-style slice). Appended at the
  // end — keys are persisted values. Volunteers (admin-approved badge) are the
  // natural responders to these.
  { key: "tech_help", emoji: "💻", label: { en: "Help with my phone", el: "Βοήθεια με το κινητό" } },
  { key: "ride", emoji: "🚗", label: { en: "A ride", el: "Μια μεταφορά" } },
  { key: "house_help", emoji: "🏠", label: { en: "A hand at home", el: "Χέρι στο σπίτι" } },
  { key: "paperwork", emoji: "📄", label: { en: "Help with paperwork", el: "Βοήθεια με χαρτιά" } },
];

export const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.key);

/** The practical-help half of the catalog — the wizard groups on this. */
export const HELP_ACTIVITY_KEYS: readonly string[] = [
  "tech_help",
  "ride",
  "house_help",
  "paperwork",
];

export const PLACE_TYPES: readonly CatalogEntry[] = [
  { key: "cafe", emoji: "☕", label: { en: "A café", el: "Καφετέρια" } },
  { key: "supermarket", emoji: "🛒", label: { en: "Supermarket", el: "Σούπερ μάρκετ" } },
  { key: "park", emoji: "🌳", label: { en: "A park", el: "Πάρκο" } },
  { key: "walk_route", emoji: "🚶", label: { en: "A walking route", el: "Διαδρομή βόλτας" } },
  { key: "home_area", emoji: "🏠", label: { en: "Around my home", el: "Γύρω από το σπίτι μου" } },
  { key: "call", emoji: "📞", label: { en: "By phone", el: "Με τηλέφωνο" } },
  { key: "other", emoji: "📍", label: { en: "Somewhere public", el: "Καπου δημόσια" } },
];

export const PLACE_TYPE_KEYS = PLACE_TYPES.map((p) => p.key);

export function activityLabel(key: string, lang: Lang): string {
  return ACTIVITIES.find((a) => a.key === key)?.label[lang] ?? key;
}

export function placeTypeLabel(key: string, lang: Lang): string {
  return PLACE_TYPES.find((p) => p.key === key)?.label[lang] ?? key;
}

/** Interest chips shown during profile setup. Longer list, free-form storage. */
export const INTEREST_CHIPS: readonly CatalogEntry[] = [
  { key: "coffee", emoji: "☕", label: { en: "Coffee", el: "Καφές" } },
  { key: "cooking", emoji: "🍲", label: { en: "Cooking", el: "Μαγειρική" } },
  { key: "garden", emoji: "🌿", label: { en: "Gardens", el: "Κήποι" } },
  { key: "walks", emoji: "🚶", label: { en: "Walks", el: "Βόλτες" } },
  { key: "music", emoji: "🎵", label: { en: "Music", el: "Μουσική" } },
  { key: "books", emoji: "📖", label: { en: "Books", el: "Βιβλία" } },
  { key: "crafts", emoji: "🧵", label: { en: "Crafts", el: "Χειροτεχνίες" } },
  { key: "church", emoji: "⛪", label: { en: "Church", el: "Εκκλησία" } },
  { key: "sea", emoji: "🌊", label: { en: "The sea", el: "Η θάλασσα" } },
  { key: "grandchildren", emoji: "👨‍👩‍👧", label: { en: "Grandchildren", el: "Εγγόνια" } },
  { key: "chess", emoji: "♟️", label: { en: "Chess", el: "Σκάκι" } },
  { key: "movies", emoji: "🎬", label: { en: "Movies", el: "Ταινίες" } },
];

export const MOBILITY_LABELS: Record<string, Record<Lang, string>> = {
  walk: { en: "I can walk easily", el: "Περπατάω άνετα" },
  ride: { en: "I need a ride", el: "Χρειάζομαι μεταφορά" },
  home: { en: "I prefer to stay close to home", el: "Προτιμώ να μένω κοντά στο σπίτι" },
};
