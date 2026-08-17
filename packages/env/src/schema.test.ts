import { describe, expect, it } from "vitest"
import { z } from "zod"
import { parseEnv, smtpEnvSchema } from "./schema.js"

describe("smtpEnvSchema", () => {
  it("defaults SMTP_PORT and SMTP_FROM when unset", () => {
    const result = smtpEnvSchema.parse({})
    expect(result.SMTP_PORT).toBe(587)
    expect(result.SMTP_FROM).toBe("no-reply@archispark.local")
    expect(result.SMTP_HOST).toBeUndefined()
  })

  it("rejects a non-numeric SMTP_PORT", () => {
    expect(smtpEnvSchema.safeParse({ SMTP_PORT: "not-a-port" }).success).toBe(
      false
    )
  })
})

describe("parseEnv", () => {
  const schema = z.object({ REQUIRED_URL: z.string().url() })

  it("returns the parsed value for a valid source", () => {
    expect(parseEnv(schema, { REQUIRED_URL: "https://example.com" })).toEqual({
      REQUIRED_URL: "https://example.com",
    })
  })

  it("throws a readable error listing every invalid field", () => {
    expect(() => parseEnv(schema, { REQUIRED_URL: "not-a-url" })).toThrow(
      /REQUIRED_URL/
    )
  })
})
