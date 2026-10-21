// Auth middleware. requireAuth resolves the Bearer token to a profile row and
// stores it as the `user` variable; requireAdmin must run after requireAuth.

import { createMiddleware } from "hono/factory";
import { AppError } from "../errors";
import { getSessionUser } from "../lib/auth";
import type { AppEnv } from "../types";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new AppError(401, "unauthorized", "Sign in required.");
  }
  const user = await getSessionUser(c.env.DB, header.slice("Bearer ".length));
  if (!user) {
    throw new AppError(401, "unauthorized", "Session expired — please sign in again.");
  }
  if (user.status !== "active") {
    throw new AppError(403, "account_disabled", "This account is disabled.");
  }
  c.set("user", user);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") {
    throw new AppError(403, "admin_only", "Admins only.");
  }
  await next();
});
