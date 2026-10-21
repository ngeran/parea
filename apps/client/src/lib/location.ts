// Location — one foreground permission prompt, one position fix.
// The server rounds the position to ~500 m before anything is stored, and
// the app only ever shows those rounded values; exact coordinates never
// leave this function except to POST /me/location, which snaps immediately.
import * as Location from "expo-location";
import { api } from "./api";
import { useStore } from "../store";

export interface Coords {
  lat: number;
  lng: number;
}

// A GPS fix can take arbitrarily long indoors or on a fresh emulator; cap
// the wait so screens never stall on it. No fix → null → callers show the
// friendly location note and everything else keeps working.
const FIX_TIMEOUT_MS = 10_000;

export async function getCoords(): Promise<Coords | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("gps fix timeout")), FIX_TIMEOUT_MS),
      ),
    ]);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * The coordinates this screen should use right now: the session's saved fix,
 * or a fresh one (which also quietly updates the server's rounded copy).
 * Returns null when permission is missing — callers show the friendly
 * location note instead of results.
 */
export async function ensureCoords(): Promise<Coords | null> {
  const { coords, token, setCoords } = useStore.getState();
  if (coords) return coords;
  const fresh = await getCoords();
  if (!fresh) return null;
  setCoords(fresh);
  if (token) {
    try {
      await api("/me/location", { method: "POST", token, body: fresh });
    } catch {
      // Location is best-effort here; screens still work with the local fix.
    }
  }
  return fresh;
}
