// Together API — the single Worker entry point.
// Mounts every route module, adds CORS + uniform error JSON, exposes the
// /events WebSocket and the cron scheduler, and re-exports the Durable Object
// classes (they MUST be exported from the entry module for the bindings).

import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { runCron } from "./crons";
import { AppError } from "./errors";
import { userEventsStub } from "./lib/do";
import { requireAuth } from "./middleware/auth";
import type { ProfileRow } from "./types";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import discoverRoutes from "./routes/discover";
import feedbackRoutes from "./routes/feedback";
import matchesRoutes from "./routes/matches";
import meRoutes from "./routes/me";
import photosRoutes from "./routes/photos";
import plansRoutes from "./routes/plans";
import requestsRoutes from "./routes/requests";
import safetyRoutes from "./routes/safety";

export { ChatRoom } from "./do/ChatRoom";
export { UserEvents } from "./do/UserEvents";

const app = new Hono<{ Bindings: Env; Variables: { user: ProfileRow } }>();

// CORS for the web admin dashboard (Phase 5) and web previews. Native apps
// send no Origin header and pass through untouched.
app.use("*", async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : undefined),
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86_400,
  })(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));

app.route("/", authRoutes); // /otp/request · /otp/verify · /logout
app.route("/me", meRoutes);
app.route("/requests", requestsRoutes);
app.route("/discover", discoverRoutes);
app.route("/matches", matchesRoutes);
app.route("/plans", plansRoutes);
app.route("/safety", safetyRoutes);
app.route("/photos", photosRoutes);
app.route("/feedback", feedbackRoutes);

// Admin dashboard static assets (§7.11): built by apps/admin, mounted at
// /admin. Registered BEFORE the admin API routes on purpose — the API
// sub-app's requireAuth middleware matches every /admin path and would
// otherwise swallow the dashboard shell (GET /admin). API sub-paths
// (/admin/users, /admin/reports/…) have no static counterpart, so they
// still fall through to the API routes below.
app.get("/admin", (c) => serveAdminAsset(c, "/index.html"));
app.get("/admin/assets/*", (c) =>
  serveAdminAsset(c, c.req.path.replace(/^\/admin/, "")),
);

async function serveAdminAsset(c: { env: Env }, path: string): Promise<Response> {
  const asset = await c.env.ASSETS.fetch(new URL(path, "https://assets.local"));
  if (asset.status === 404) {
    // Unknown path → the SPA shell (it only ever shows /admin itself).
    return c.env.ASSETS.fetch(new URL("/index.html", "https://assets.local"));
  }
  return asset;
}

app.route("/admin", adminRoutes);

// Live events (§3.4 of the plan): one WebSocket per foregrounded user. The
// UserEvents DO only accepts this trusted internal request — the session has
// already been validated by requireAuth.
app.get("/events", requireAuth, async (c) => {
  const me = c.get("user");
  return userEventsStub(c.env, me.id).fetch(
    new Request("https://internal/events", {
      headers: { Upgrade: "websocket", "x-user-id": me.id },
    }),
  );
});

// Uniform error JSON. Codes are stable and mapped to localized,
// senior-friendly strings on the client — server messages are for developers.
function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

app.onError((err) => {
  if (err instanceof AppError) {
    return errorResponse(err.status, err.code, err.message);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return errorResponse(400, "validation_failed", first ? first.message : "Invalid input.");
  }
  console.error("unhandled error", { err: String(err) });
  return errorResponse(500, "internal", "Something went wrong. Please try again.");
});

app.notFound(() => errorResponse(404, "not_found", "Not found."));

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (controller, env, ctx) => ctx.waitUntil(runCron(env, controller.cron, ctx)),
} satisfies ExportedHandler<Env>;
