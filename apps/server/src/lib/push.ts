// Expo Push notifications. Sent from route handlers via ctx.waitUntil so the
// HTTP response is never delayed by a push; failures are logged, never fatal.
// Invalid tokens (DeviceNotRegistered) are pruned.

export interface PushPayload {
  title: string;
  body: string;
  /** Client routes on these, e.g. { match_id, plan_id }. */
  data?: Record<string, string>;
}

/**
 * Minimal waitUntil shape satisfied by Hono's c.executionCtx AND the runtime's
 * real ExecutionContext (their interfaces drifted apart in recent type
 * generations, so we accept the smallest common contract).
 */
export interface WaitUntilCtx {
  waitUntil: (promise: Promise<unknown>) => void;
}

/** Fire-and-forget: safe to call from any handler with c.executionCtx. */
export function pushToUser(
  env: Env,
  executionCtx: WaitUntilCtx,
  userId: string,
  payload: PushPayload,
): void {
  executionCtx.waitUntil(
    sendPush(env, userId, payload).catch((err) =>
      console.error("push failed", { userId, err: String(err) }),
    ),
  );
}

async function sendPush(env: Env, userId: string, payload: PushPayload): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT d.push_token FROM devices d
     JOIN profiles p ON p.id = d.user_id
     WHERE d.user_id = ? AND p.push_enabled = 1 AND p.status = 'active'`,
  )
    .bind(userId)
    .all<{ push_token: string }>();
  if (results.length === 0) return;

  const messages = results.map((d) => ({
    to: d.push_token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default",
  }));

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error("expo push failed", { status: res.status });
      continue;
    }
    const out = await res.json<{ data?: Array<{ status: string; message?: string }> }>();
    const deadTokens: string[] = [];
    if (Array.isArray(out.data)) {
      out.data.forEach((ticket, idx) => {
        if (ticket.status === "error" && ticket.message === "DeviceNotRegistered") {
          const token = chunk[idx]?.to;
          if (token) deadTokens.push(token);
        }
      });
    }
    if (deadTokens.length > 0) {
      await env.DB.prepare(
        `DELETE FROM devices WHERE push_token IN (${deadTokens.map(() => "?").join(",")})`,
      )
        .bind(...deadTokens)
        .run();
    }
  }
}
