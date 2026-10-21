// ChatRoom — one Durable Object per match ("match:<id>").
// A pure fan-out hub: messages are written to D1 by the Worker first, then
// broadcast here. History comes from D1 on (re)connect, never from this DO.

import { DurableObject } from "cloudflare:workers";

export interface ChatBroadcast {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  /** 0 clean · 1 flagged · 2 held (held messages are never broadcast). */
  flagged: number;
}

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /**
   * WebSocket upgrade. Reached only through the Worker after participant and
   * block checks — identity arrives in headers.
   */
  override async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get("x-user-id");
    if (!userId) return new Response("unauthorized", { status: 401 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [`user:${userId}`]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** RPC: push a message to everyone in the room except the sender. */
  async broadcast(message: ChatBroadcast): Promise<void> {
    const senderSockets = new Set(this.ctx.getWebSockets(`user:${message.sender_id}`));
    for (const ws of this.ctx.getWebSockets()) {
      if (senderSockets.has(ws)) continue;
      try {
        ws.send(JSON.stringify({ type: "message.new", message }));
      } catch (err) {
        console.error("ChatRoom send failed", { err: String(err) });
      }
    }
  }

  /** RPC: a block was filed inside this conversation — close every socket. */
  async closeAll(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, "blocked");
      } catch {
        // already closing — nothing to do
      }
    }
  }
}
