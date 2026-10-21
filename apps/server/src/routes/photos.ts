// Photo proxy. The R2 bucket is private; this is the only way in. Every
// request is session-checked, the key must match the exact shape the app
// creates, and verification photos are admin-only.

import { Hono } from "hono";
import { AppError } from "../errors";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();
export default app;

// Only keys this app created may be read: <folder>/<uuid>.<ext>
const KEY_RE = /^(photos|verification)\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

app.use("*", requireAuth);

app.get("/*", async (c) => {
  const me = c.get("user");
  // Route path is /photos/<key>; strip the mount prefix to get the R2 key.
  const key = c.req.path.replace(/^\/photos\//, "");
  if (!KEY_RE.test(key)) {
    throw new AppError(404, "not_found", "Photo not found.");
  }
  if (key.startsWith("verification/") && me.role !== "admin") {
    throw new AppError(403, "admin_only", "Admins only.");
  }

  const obj = await c.env.PHOTOS.get(key);
  if (!obj || !obj.body) {
    throw new AppError(404, "not_found", "Photo not found.");
  }
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
      // Private: browsers may cache, but never shared caches/proxies.
      "cache-control": "private, max-age=86400",
    },
  });
});
