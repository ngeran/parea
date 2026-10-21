import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Tests run inside the real Workers runtime (workerd) with real D1 + DO
// simulation. Storage (D1 included) is isolated per test.
export default defineConfig(async () => {
  // Parsed once in Node and injected as the TEST_MIGRATIONS binding, so the
  // in-runtime setup file can apply the schema to each fresh test database.
  const migrations = await readD1Migrations(path.join(process.cwd(), "migrations"));

  return {
    test: {
      // Applies pending D1 migrations to the shared test database.
      setupFiles: ["./test/apply-migrations.ts"],
      // One worker, one database — test files run one after another, and each
      // test wipes the DB first (resetDb in test/helpers.ts).
      fileParallelism: false,
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // vitest-pool-workers picks up the gitignored .dev.vars when it
            // exists, which would make tests pass locally but fail on CI.
            // Inject a fixed, non-secret pepper so the suite is hermetic.
            OTP_PEPPER: "test-only-pepper",
          },
        },
      }),
    ],
  };
});
