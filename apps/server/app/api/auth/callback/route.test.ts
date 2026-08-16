import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

vi.mock("@workspace/auth", () => ({
  exchangeCodeForTokens: vi.fn(),
  verifyAccessToken: vi.fn(),
}))

// Keeps this test DB-free — see platform-context-store.test.ts for
// ensureDefaultPlatformOrganization's own behavior.
vi.mock("@/lib/archimate/platform-context-store", () => ({
  ensureDefaultPlatformOrganization: vi.fn(),
}))

import { exchangeCodeForTokens, verifyAccessToken } from "@workspace/auth"
import { ensureDefaultPlatformOrganization } from "@/lib/archimate/platform-context-store"

function makeReq(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:8000${path}`, {
    headers: cookie ? { cookie } : {},
  })
}

const FLOW_COOKIES =
  "pkce_verifier=verifier-value; oidc_state=expected-state; auth_redirect=/workspaces"

describe("GET /api/auth/callback", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(exchangeCodeForTokens).mockReset()
    vi.mocked(verifyAccessToken).mockReset()
    vi.mocked(ensureDefaultPlatformOrganization).mockReset()
  })

  it("redirects to /login when KEYCLOAK_CLIENT_ID_WEB is not set", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "")
    const res = await GET(
      makeReq("/api/auth/callback?code=abc&state=expected-state", FLOW_COOKIES)
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:8000/login")
  })

  it("redirects to /login when state does not match", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    const res = await GET(
      makeReq("/api/auth/callback?code=abc&state=wrong-state", FLOW_COOKIES)
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:8000/login")
    expect(exchangeCodeForTokens).not.toHaveBeenCalled()
  })

  it("redirects to /login when code is missing", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    const res = await GET(
      makeReq("/api/auth/callback?state=expected-state", FLOW_COOKIES)
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:8000/login")
  })

  it("redirects to /login when the token exchange fails", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(new Error("boom"))
    const res = await GET(
      makeReq("/api/auth/callback?code=abc&state=expected-state", FLOW_COOKIES)
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:8000/login")
  })

  it("exchanges the code, sets auth cookies and redirects to auth_redirect", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      id_token: "it",
      expires_in: 300,
      refresh_expires_in: 1800,
    })

    const res = await GET(
      makeReq("/api/auth/callback?code=abc&state=expected-state", FLOW_COOKIES)
    )

    expect(exchangeCodeForTokens).toHaveBeenCalledWith({
      clientId: "archispark-web",
      redirectUri: "http://localhost:8000/api/auth/callback",
      code: "abc",
      codeVerifier: "verifier-value",
    })
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:8000/workspaces")
    expect(res.cookies.get("access_token")?.value).toBe("at")
    expect(res.cookies.get("refresh_token")?.value).toBe("rt")
    expect(res.cookies.get("id_token")?.value).toBe("it")
    expect(res.cookies.get("oidc_state")?.value).toBe("")
    expect(res.cookies.get("pkce_verifier")?.value).toBe("")
    expect(res.cookies.get("auth_redirect")?.value).toBe("")
  })

  it("enters a platform_admin into its default organization on login", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      expires_in: 300,
    })
    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: "kc-admin-1",
      realm_access: { roles: ["platform_admin"] },
    })

    await GET(
      makeReq("/api/auth/callback?code=abc&state=expected-state", FLOW_COOKIES)
    )

    expect(verifyAccessToken).toHaveBeenCalledWith("at")
    expect(ensureDefaultPlatformOrganization).toHaveBeenCalledWith("kc-admin-1")
  })

  it("does not enter admin mode for an ordinary user", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      expires_in: 300,
    })
    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: "kc-user-1",
      realm_access: { roles: [] },
    })

    await GET(
      makeReq("/api/auth/callback?code=abc&state=expected-state", FLOW_COOKIES)
    )

    expect(ensureDefaultPlatformOrganization).not.toHaveBeenCalled()
  })

  it("defaults to / when there is no auth_redirect cookie", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      expires_in: 300,
    })
    const res = await GET(
      makeReq(
        "/api/auth/callback?code=abc&state=expected-state",
        "pkce_verifier=verifier-value; oidc_state=expected-state"
      )
    )
    expect(res.headers.get("location")).toBe("http://localhost:8000/")
  })
})
