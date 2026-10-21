// UserEvents — one Durable Object per signed-in user ("user:<id>").
// Holds the user's live WebSocket(s) while the app is foregrounded and fans
// out ServerEvents (§3.4 of the plan). No storage: events are ephemeral and
// D1 is the source of truth — a missed event is healed by a refetch.

import { DurableObject } from "cloudflare:workers";

export class UserEvents extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The platform answers "ping" without waking this object from
    // hibernation — idle connections stay nearly free.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /**
   * WebSocket upgrade. Reached only through the Worker, which has already
   * validated the session — identity arrives in the x-user-id header.
   */
  override async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get("x-user-id");
    if (!userId) return new Response("unauthorized", { status: 401 });
    const pair = new WebSocketPair();
    // Sockets are tagged so broadcast can address this user's connections.
    this.ctx.acceptWebSocket(pair[1], [`user:${userId}`]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** RPC: fan an event out to every live connection of this user. */
  async emit(eventJson: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(eventJson);
      } catch (err) {
        console.error("UserEvents send failed", { err: String(err) });
      }
    }
  }
}
