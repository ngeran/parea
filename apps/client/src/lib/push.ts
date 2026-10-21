// Push notification registration. Runs once per app session, on the Home
// screen after sign-in. Everything here is best-effort: denied permission,
// Expo Go (no remote push), a missing EAS project id, or a simulator must
// never block the app — they just mean no background notifications.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";
import { useStore } from "../store";

// Ask at most once per session — iOS/Android remember a "don't allow", so
// re-prompting would only nag.
let askedThisSession = false;

export async function registerPush(): Promise<void> {
  if (askedThisSession || Platform.OS === "web") return;
  const session = useStore.getState().token;
  if (!session) return;
  askedThisSession = true;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return; // set in app.json after `eas init` (docs/DEPLOY.md)

    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted
      ? true
      : existing.canAskAgain
        ? (await Notifications.requestPermissionsAsync()).granted
        : false;
    if (!granted) return; // no nag loop; they can still use everything else

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api("/me/device", { body: { push_token: token, platform: Platform.OS }, token: session });
  } catch {
    // Expo Go, simulator without push entitlement, offline — all fine.
  }
}
