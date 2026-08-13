import { describe, it, expect, afterEach, vi } from "vitest"
import { signLocalAccessToken } from "./local-jwt.js"
import { verifyAnyAccessToken } from "./verify-any.js"

describe("verifyAnyAccessToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("routes a local token to the local verifier", async () => {
    vi.stubEnv("LOCAL_AUTH_JWT_SECRET", "test-secret-at-least-32-characters")
    const token = await signLocalAccessToken({
      id: "local:1",
      username: "admin",
      role: "platform_admin",
    })
    const claims = await verifyAnyAccessToken(token)
    expect(claims?.sub).toBe("local:1")
  })

  it("returns null for a token whose issuer matches neither verifier", async () => {
    expect(await verifyAnyAccessToken("not-a-jwt")).toBeNull()
  })

  it("returns null for an unconfigured Keycloak token, without touching the local secret", async () => {
    vi.stubEnv("KEYCLOAK_URL", "")
    vi.stubEnv("KEYCLOAK_REALM", "")
    // A Keycloak token has no "iss" claim recognized as local, so it's
    // routed to verifyAccessToken, which returns null when unconfigured.
    const keycloakShapedToken =
      "eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8va2V5Y2xvYWsvcmVhbG1zL2FyY2hpc3BhcmsifQ.invalid"
    expect(await verifyAnyAccessToken(keycloakShapedToken)).toBeNull()
  })
})
