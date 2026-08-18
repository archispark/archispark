import { describe, it, expect, afterEach, vi } from "vitest"
import { SignJWT } from "jose"
import {
  signLocalAccessToken,
  verifyLocalAccessToken,
  LOCAL_JWT_ISSUER,
} from "./local-jwt.js"

const SECRET = "test-secret-at-least-32-characters-long"

describe("signLocalAccessToken / verifyLocalAccessToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("round-trips a signed token", async () => {
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", SECRET)
    const token = await signLocalAccessToken({
      id: "local:1",
      username: "admin",
      role: "platform_admin",
      email: "admin@example.com",
    })
    const claims = await verifyLocalAccessToken(token)
    expect(claims?.sub).toBe("local:1")
    expect(claims?.preferred_username).toBe("admin")
    expect(claims?.realm_access?.roles).toEqual(["platform_admin"])
  })

  it("rejects a token signed with a different secret", async () => {
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", SECRET)
    const token = await signLocalAccessToken({
      id: "local:1",
      username: "admin",
      role: "user",
    })
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", "a-completely-different-secret-value")
    expect(await verifyLocalAccessToken(token)).toBeNull()
  })

  it("rejects an expired token", async () => {
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", SECRET)
    const token = await new SignJWT({ realm_access: { roles: ["user"] } })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(LOCAL_JWT_ISSUER)
      .setSubject("local:1")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET))
    expect(await verifyLocalAccessToken(token)).toBeNull()
  })

  it("rejects a token with a different issuer", async () => {
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", SECRET)
    const token = await new SignJWT({ realm_access: { roles: ["user"] } })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("someone-else")
      .setSubject("local:1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(SECRET))
    expect(await verifyLocalAccessToken(token)).toBeNull()
  })
})
