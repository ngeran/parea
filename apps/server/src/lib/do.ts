// Typed accessors for the Durable Object bindings. `wrangler types` cannot
// know which class sits behind each namespace binding, so the concrete stub
// type is asserted here — in exactly one place.

import type { ChatRoom } from "../do/ChatRoom";
import type { UserEvents } from "../do/UserEvents";

export function userEventsStub(env: Env, userId: string): DurableObjectStub<UserEvents> {
  return env.USER_EVENTS.getByName(`user:${userId}`) as DurableObjectStub<UserEvents>;
}

export function chatRoomStub(env: Env, matchId: string): DurableObjectStub<ChatRoom> {
  return env.CHAT_ROOM.getByName(`match:${matchId}`) as DurableObjectStub<ChatRoom>;
}
