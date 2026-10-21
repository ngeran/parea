// Live events, delivered over each user's UserEvents WebSocket (§3.4 of the
// plan). Delivery is best-effort: the D1 write is the source of truth, and
// the client re-fetches on reconnect if it missed events.

import type { ServerEvent } from "@parea/shared";
import { userEventsStub } from "./do";

export async function emitToUser(env: Env, userId: string, event: ServerEvent): Promise<void> {
  try {
    const stub = userEventsStub(env, userId);
    await stub.emit(JSON.stringify(event));
  } catch (err) {
    console.error("emitToUser failed", { userId, type: event.type, err: String(err) });
  }
}
