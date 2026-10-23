// Session + preferences persistence. expo-secure-store is native-only — on
// web every call rejected (UnavailabilityError) and the .catch() wrappers
// silently swallowed it, so nothing was ever saved and every relaunch asked
// for the phone number again. On web the PWA's own origin (localStorage) is
// the right store; native keeps the Keychain via SecureStore.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export async function loadValue(key: string): Promise<string | null> {
  try {
    return isWeb ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function saveValue(key: string, value: string): Promise<void> {
  try {
    if (isWeb) window.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Private browsing / storage full — the app still works, just per-launch.
  }
}

export async function deleteValue(key: string): Promise<void> {
  try {
    if (isWeb) window.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing sensible to do — the stale value simply stays ignored.
  }
}
