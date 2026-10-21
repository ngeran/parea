// Runs before every test (isolated storage resets between tests): bring the
// per-test D1 up to the current schema. The migrations array arrives as the
// TEST_MIGRATIONS binding, injected by vitest.config.ts.
import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(
  env.DB,
  env.TEST_MIGRATIONS as Parameters<typeof applyD1Migrations>[1],
);
