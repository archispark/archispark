import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@workspace/auth", () => ({
  buildLogoutUrl: vi.fn(),
}));

import { buildLogoutUrl } from "@workspace/auth";

function makeReq(cookie?: string): NextRequest {
  return new NextRequest("http://localhost:8001/api/auth/logout", {
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /api/auth/logout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(buildLogoutUrl).mockReset();
  });

  it("redirects to Keycloak end-session and clears auth cookies", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "archispark-admin-web");
    vi.mocked(buildLogoutUrl).mockReturnValue("http://localhost:8080/realms/archispark/protocol/openid-connect/logout?mock=1");

    const res = await GET(makeReq("id_token=it-value; access_token=at"));

    expect(buildLogoutUrl).toHaveBeenCalledWith({
      clientId: "archispark-admin-web",
      idToken: "it-value",
      postLogoutRedirectUri: "http://localhost:8001/login",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:8080/realms/archispark/protocol/openid-connect/logout?mock=1");
    expect(res.cookies.get("access_token")?.maxAge).toBe(0);
    expect(res.cookies.get("refresh_token")?.maxAge).toBe(0);
    expect(res.cookies.get("id_token")?.maxAge).toBe(0);
  });

  it("redirects straight to /login when KEYCLOAK_CLIENT_ID_ADMIN_WEB is not set", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "");
    const res = await GET(makeReq());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:8001/login");
    expect(buildLogoutUrl).not.toHaveBeenCalled();
  });
});
