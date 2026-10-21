// Secrets never live in wrangler.jsonc, so they never appear in the
// generated types. They are declared here instead — set them locally in
// .dev.vars and in production with `wrangler secret put <NAME>`.
declare namespace Cloudflare {
  interface Env {
    OTP_PEPPER?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_FROM_NUMBER?: string;
    /** Test-only: injected as a binding by vitest.config.ts (readD1Migrations). */
    TEST_MIGRATIONS?: unknown;
  }
}

// The generated file declares a global `Env` too — merge the secrets in
// there as well, since app code uses the global type.
declare interface Env {
  OTP_PEPPER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
}
