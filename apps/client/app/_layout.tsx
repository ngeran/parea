// Root layout — the one place everything global is wired:
//   QueryClient (TanStack Query)  → all API state
//   hydration + auth gate         → welcome screen or the tabs
//   LiveBridge                    → the single WebSocket, wired to invalidation
//   Toaster + ThemeColorBridge    → visible feedback + browser chrome theming
// Screen transitions fade (≤ 200 ms) — no slides, per the motion rules — and
// drop entirely when the OS "reduce motion" setting is on.
import { Stack, useRouter } from "expo-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import type { ServerEvent } from "@parea/shared";
import { API_BASE, setUnauthorizedHandler } from "../src/lib/api";
import { connectLive } from "../src/lib/live";
import { COLORS, useReduceMotion, useResolvedThemeName } from "../src/theme";
import { Toaster } from "../src/components/Toast";
import { DialogHost } from "../src/components/DialogHost";
import { useStore } from "../src/store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/** One live WebSocket per signed-in session; events become query invalidations. */
function LiveBridge() {
  const token = useStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    // A dead session (expired/revoked token) logs the user out everywhere.
    setUnauthorizedHandler(() => {
      void useStore.getState().signOut();
    });
    return connectLive(API_BASE, token, (event: ServerEvent) => {
      switch (event.type) {
        case "response.created":
          queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
          queryClient.invalidateQueries({ queryKey: ["request", event.payload.request_id] });
          queryClient.invalidateQueries({ queryKey: ["offers", event.payload.request_id] });
          break;
        case "request.accepted":
          queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
          queryClient.invalidateQueries({ queryKey: ["request", event.payload.request_id] });
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          break;
        case "request.declined":
          queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
          queryClient.invalidateQueries({ queryKey: ["request", event.payload.request_id] });
          break;
        case "request.cancelled":
          // The owner's other devices drop it from "my requests"; everyone
          // else drops it from the nearby list.
          queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
          queryClient.invalidateQueries({ queryKey: ["requests", "nearby"] });
          queryClient.invalidateQueries({ queryKey: ["request", event.payload.request_id] });
          break;
        case "request.nearby":
          queryClient.invalidateQueries({ queryKey: ["requests", "nearby"] });
          break;
        case "match.created":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          break;
        case "message.new":
          queryClient.invalidateQueries({ queryKey: ["messages", event.payload.message.match_id] });
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          break;
        case "plan.updated":
          queryClient.invalidateQueries({ queryKey: ["plans"] });
          queryClient.invalidateQueries({ queryKey: ["plan", event.payload.plan.id] });
          break;
        case "checkin.confirmed":
          queryClient.invalidateQueries({ queryKey: ["plans"] });
          queryClient.invalidateQueries({ queryKey: ["plan", event.payload.plan_id] });
          break;
      }
    });
  }, [token, queryClient]);

  return null;
}

/** Watches hydration + session and routes to welcome or the tabs. */
function Gate() {
  const ready = useStore((s) => s.ready);
  const token = useStore((s) => s.token);
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? "/home" : "/welcome");
  }, [ready, token, router]);

  return null;
}

/**
 * Web only: keeps the browser chrome (status bar on Android standalone,
 * title bar colors) in sync with the app theme. Replaces the static
 * media-query metas from public/index.html so an explicit app choice
 * beats the OS setting, exactly like the in-app surfaces.
 */
function ThemeColorBridge() {
  const themeName = useResolvedThemeName();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", COLORS[themeName].bg);
    document.head.appendChild(meta);
  }, [themeName]);
  return null;
}

function RootLayout() {
  const hydrate = useStore((s) => s.hydrate);
  // Resolved (system → light/dark) so the status bar and nav background flip
  // with the OS setting, not just with an explicit choice.
  const themeName = useResolvedThemeName();
  // Motion rule (plan §4.4): the fade is the only animation in the app, and
  // it goes away completely when the OS asks for reduced motion.
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <>
      <StatusBar style={themeName === "light" ? "dark" : "light"} />
      <Gate />
      <LiveBridge />
      <ThemeColorBridge />
      <Toaster />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? "none" : "fade",
          animationDuration: 200,
          // Paint every stack level with the theme bg — the floating tab
          // bar leaves a band under it that must follow an explicit theme
          // choice, not just the OS scheme (which is all the html bg knows).
          contentStyle: {
            backgroundColor: COLORS[themeName].bg,
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="discover" />
        <Stack.Screen name="requests" />
        <Stack.Screen name="chat/[matchId]" />
        <Stack.Screen name="plans" />
      </Stack>
      {/* After the Stack: a later sibling paints above every screen. */}
      <DialogHost />
    </>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayout />
    </QueryClientProvider>
  );
}
