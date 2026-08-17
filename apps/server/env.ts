import { z } from "zod"
import {
  blankToUndefined,
  loadEnv,
  optionalEnvString,
  parseEnv,
  smtpEnvSchema,
} from "@workspace/env"

// Self-contained on purpose: whichever file imports `env` first (next.config.ts,
// instrumentation.ts, a route handler) must not depend on import order to have
// `.env` already loaded — loadEnv() is idempotent (never overrides a variable
// already set), so calling it again here is always safe.
loadEnv()

const serverEnvSchema = smtpEnvSchema.extend({
  ARCHISPARK_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  ALLOWED_DEV_ORIGINS: optionalEnvString(),
  KEYCLOAK_CLIENT_ID_WEB: optionalEnvString(),
  KEYCLOAK_SSO_PROVIDER_NAME: optionalEnvString(),
  BLOB_READ_WRITE_TOKEN: optionalEnvString(),
  DEMO_RESET_ENABLED: z.preprocess(
    blankToUndefined,
    z.enum(["true", "false"]).optional()
  ),
  CRON_SECRET: optionalEnvString(),
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
