// The one live WebSocket every signed-in screen shares (UserEvents DO).
// "Live everywhere": while the app is foregrounded this socket is open and
// every ServerEvent lands here; screens react through TanStack Query
// invalidation (see LiveBridge in app/_layout.tsx).
//
// The session rides in the URL as ?token= — browsers cannot send custom
// headers on a WebSocket handshake, and the Worker's /events route accepts
// the query param for exactly that (middleware/auth.ts).
import type { ServerEvent } from "@parea/shared";

export interface LiveHandlers {
  onEvent: (event: ServerEvent) => void;
}

const PING_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Opens /events and keeps it alive: a "ping" every 30 s (the server answers
 * "pong" without even waking the Durable Object) and exponential reconnect
 * (1 s → 30 s) whenever the socket drops. Returns a close function.
 */
export function connectLive(
  base: string,
  token: string,
  onEvent: (event: ServerEvent) => void,
): () => void {
  let ws: WebSocket | null = null;
  let disposed = false;
  let backoffMs = 1000;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const stopPing = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  };

  const connect = () => {
    if (disposed) return;
    // Query-param auth: the only channel that works in a browser handshake.
    const url = `${base.replace(/^http/, "ws")}/events?token=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      backoffMs = 1000;
      stopPing();
      pingTimer = setInterval(() => {
        // Server auto-answers "pong" (WebSocketAutoResponsePair).
        try {
          ws?.send("ping");
        } catch {
          // Socket died mid-send — onclose handles the reconnect.
        }
      }, PING_MS);
    };

    ws.onmessage = (msg: WebSocketMessageEvent) => {
      if (typeof msg.data !== "string" || msg.data === "pong") return;
      try {
        onEvent(JSON.parse(msg.data) as ServerEvent);
      } catch {
        // Ignore malformed frames — D1 is the source of truth, a refetch heals.
      }
    };

    ws.onclose = () => {
      stopPing();
      if (disposed) return;
      retryTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    };

    ws.onerror = () => {
      // onclose always follows onerror — let it drive the reconnect.
      try {
        ws?.close();
      } catch {
        // already closed
      }
    };
  };

  connect();

  return () => {
    disposed = true;
    stopPing();
    if (retryTimer) clearTimeout(retryTimer);
    try {
      ws?.close();
    } catch {
      // already closed
    }
  };
}
