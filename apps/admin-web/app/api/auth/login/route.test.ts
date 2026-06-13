import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@workspace/auth", () => ({
  createPkcePair: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
}));

import { createPkcePair, buildAuthorizationUrl } from "@workspace/auth";

function makeReq(path: string): NextRequest {
  return new NextRequest(`http://localhost:8001${path}`);
}

describe("GET /api/auth/login", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(createPkcePair).mockReset();
    vi.mocked(buildAuthorizationUrl).mockReset();
  });

  it("returns 500 when KEYCLOAK_CLIENT_ID_ADMIN_WEB is not set", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "");
    const res = await GET(makeReq("/api/auth/login"));
    expect(res.status).toBe(500);
  });

  it("redirects to Keycloak with PKCE params and sets flow cookies", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "archispark-admin-web");
    vi.mocked(createPkcePair).mockReturnValue({ verifier: "verifier-value", challenge: "challenge-value" });
    vi.mocked(buildAuthorizationUrl).mockReturnValue("http://localhost:8080/realms/archispark/protocol/openid-connect/auth?mock=1");

    const res = await GET(makeReq("/api/auth/login?from=/users"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:8080/realms/archispark/protocol/openid-connect/auth?mock=1");
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "archispark-admin-web",
        redirectUri: "http://localhost:8001/api/auth/callback",
        codeChallenge: "challenge-value",
      }),
    );

    expect(res.cookies.get("pkce_verifier")?.value).toBe("verifier-value");
    expect(res.cookies.get("oidc_state")?.value).toBeTruthy();
    expect(res.cookies.get("auth_redirect")?.value).toBe("/users");
  });

  it("defaults the redirect target to / for unsafe `from` values", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "archispark-admin-web");
    vi.mocked(createPkcePair).mockReturnValue({ verifier: "v", challenge: "c" });
    vi.mocked(buildAuthorizationUrl).mockReturnValue("http://localhost:8080/auth");

    const res = await GET(makeReq("/api/auth/login?from=//evil.example.com"));
    expect(res.cookies.get("auth_redirect")?.value).toBe("/");
  });
});
