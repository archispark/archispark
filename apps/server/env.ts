import { z } from "zod"
import { loadEnv, parseEnv, smtpEnvSchema } from "@workspace/env"

// Self-contained on purpose: whichever file imports `env` first (next.config.ts,
// instrumentation.ts, a route handler) must not depend on import order to have
// `.env` already loaded — loadEnv() is idempotent (never overrides a variable
// already set), so calling it again here is always safe.
loadEnv()

const serverEnvSchema = smtpEnvSchema.extend({
  ARCHISPARK_URL: z.string().url().optional(),
  ALLOWED_DEV_ORIGINS: z.string().optional(),
  KEYCLOAK_CLIENT_ID_WEB: z.string().min(1).optional(),
  KEYCLOAK_SSO_PROVIDER_NAME: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  DEMO_RESET_ENABLED: z.enum(["true", "false"]).optional(),
  CRON_SECRET: z.string().min(1).optional(),
})

/**
 * Validated once per process. Every field above stays optional to match
 * today's behaviour (Keycloak SSO, Blob storage, SMTP and the demo-reset
 * cron are all opt-in features that already degrade gracefully at their own
 * call sites) — this only turns a malformed value (e.g. a non-URL
 * ARCHISPARK_URL) into a clear startup failure instead of a confusing one
 * deep inside a request.
 */
export const env = parseEnv(serverEnvSchema)
