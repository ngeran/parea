// In-app feedback → the /admin dashboard. Deliberately tiny: free text,
// no category, no status — it's a suggestion box, not a ticket queue.

import { Hono } from "hono";
import { feedbackCreateSchema } from "@together/shared";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();
export default app;

app.use("*", requireAuth);

app.post("/", async (c) => {
  const { message } = feedbackCreateSchema.parse(await c.req.json());
  await c.env.DB.prepare("INSERT INTO feedback (id, user_id, message) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), c.get("user").id, message)
    .run();
  return c.json({ ok: true }, 201);
});
