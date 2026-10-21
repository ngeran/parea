// One small zustand store for everything global: the session (token +
// profile) and the user's accessibility preferences (text size, language,
// theme). Preferences persist on-device (SecureStore) AND to the profile on
// the server, so a new phone starts with the same settings.
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Lang, SelfProfile, TextSize, ThemeName } from "@parea/shared";
import { api } from "./lib/api";

const TOKEN_KEY = "together.token";
const PREFS_KEY = "together.prefs";

export interface Prefs {
  textSize: TextSize;
  language: Lang;
  theme: ThemeName;
}

interface PareaState {
  /** True once the saved session has been checked against /me. */
  ready: boolean;
  token: string | null;
  profile: SelfProfile | null;
  /** The device's own rounded location for this app session (never persisted). */
  coords: { lat: number; lng: number } | null;
  textSize: TextSize;
  language: Lang;
  theme: ThemeName;

  hydrate: () => Promise<void>;
  setSession: (token: string, profile: SelfProfile) => Promise<void>;
  setProfile: (profile: SelfProfile) => void;
  setCoords: (coords: { lat: number; lng: number }) => void;
  setPrefs: (patch: Partial<Prefs>) => Promise<void>;
  signOut: () => Promise<void>;
}

async function loadPrefs(): Promise<Partial<Prefs>> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
  } catch {
    return {};
  }
}

export const useStore = create<PareaState>((set, get) => ({
  ready: false,
  token: null,
  profile: null,
  coords: null,
  textSize: "normal",
  language: "en",
  theme: "light",

  /** App start: restore prefs + token, then confirm the token is still valid. */
  hydrate: async () => {
    const [prefs, token] = await Promise.all([
      loadPrefs(),
      SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
    ]);
    set({
      textSize: prefs.textSize ?? "normal",
      language: prefs.language ?? "en",
      theme: prefs.theme ?? "light",
      token,
    });
    if (token) {
      try {
        const profile = await api<SelfProfile>("/me", { token });
        set({ profile });
      } catch {
        // Expired or revoked token — fall back to the welcome screen.
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        set({ token: null, profile: null });
      }
    }
    set({ ready: true });
  },

  setSession: async (token, profile) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
    set({ token, profile });
    // First sign-in on this device adopts the profile's saved preferences
    // (only where the user has not already chosen locally).
    const local = await loadPrefs();
    get().setPrefs({
      textSize: local.textSize ?? profile.text_size,
      language: local.language ?? profile.language,
      theme: local.theme ?? profile.theme,
    });
  },

  setProfile: (profile) => set({ profile }),

  setCoords: (coords) => set({ coords }),

  /** Persist locally right away; mirror to the profile best-effort. */
  setPrefs: async (patch) => {
    const current: Prefs = {
      textSize: get().textSize,
      language: get().language,
      theme: get().theme,
      ...patch,
    };
    set(current);
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(current)).catch(() => {});
    const { token } = get();
    if (token) {
      try {
        const profile = await api<SelfProfile>("/me", {
          method: "PATCH",
          token,
          body: {
            text_size: current.textSize,
            language: current.language,
            theme: current.theme,
          },
        });
        set({ profile });
      } catch {
        // Offline or rate-limited — the local choice already applies.
      }
    }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    set({ token: null, profile: null, coords: null });
  },
}));
