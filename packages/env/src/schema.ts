import { z } from "zod"

/**
 * Normalizes a blank env value to "unset". .env files commonly keep a
 * placeholder line for an unused variable (e.g. `SMTP_USER=`) rather than
 * omitting it entirely — process.env then holds `""`, not `undefined`, which
 * would otherwise trip a `.min(1)`/`.url()`/`.email()` check meant for a
 * genuinely absent variable.
 */
export function blankToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value
}

/** An optional, non-empty string env var — a blank value counts as unset. */
export function optionalEnvString(): z.ZodType<string | undefined> {
  return z.preprocess(blankToUndefined, z.string().min(1).optional())
}

/**
 * SMTP settings shared by apps/server (invitation e-mail) and apps/docs
 * (contact form) — one physical mail server for the whole monorepo, see
 * .env.example. SMTP_HOST left unset disables sending; each caller decides
 * how to degrade (invitation stays unsent / contact form returns 502).
 */
export const smtpEnvSchema = z.object({
  SMTP_HOST: optionalEnvString(),
  SMTP_PORT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().optional().default(587)
  ),
  SMTP_USER: optionalEnvString(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.preprocess(
    blankToUndefined,
    z.string().min(1).optional().default("no-reply@archispark.local")
  ),
})
export type SmtpEnv = z.infer<typeof smtpEnvSchema>

/**
 * Validates `source` (defaults to `process.env`) against `schema`, throwing
 * one readable error listing every invalid/missing field — meant to run once
 * at process startup so misconfiguration fails immediately instead of
 * surfacing later as a confusing error deep inside a request handler.
 */
export function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  source: NodeJS.ProcessEnv = process.env
): z.infer<Schema> {
  const result = schema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`
      )
      .join("\n")
    throw new Error(`Variables d'environnement invalides :\n${details}`)
  }
  return result.data
}
