import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@workspace/auth", () => ({
  refreshTokens: vi.fn(),
}));

import { refreshTokens } from "@workspace/auth";

function makeReq(cookie?: string): NextRequest {
  return new NextRequest("http://localhost:8001/api/auth/refresh", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

describe("POST /api/auth/refresh", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(refreshTokens).mockReset();
  });

  it("returns 401 and clears cookies when KEYCLOAK_CLIENT_ID_ADMIN_WEB is not set", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "");
    const res = await POST(makeReq("refresh_token=rt"));
    expect(res.status).toBe(401);
    expect(res.cookies.get("access_token")?.maxAge).toBe(0);
  });

  it("returns 401 and clears cookies when there is no refresh_token cookie", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "archispark-admin-web");
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("returns 401 and clears cookies when the refresh request fails", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "archispark-admin-web");
    vi.mocked(refreshTokens).mockRejectedValue(new Error("invalid_grant"));
    const res = await POST(makeReq("refresh_token=expired"));
    expect(res.status).toBe(401);
    expect(res.cookies.get("refresh_token")?.maxAge).toBe(0);
  });

  it("returns 204 and sets fresh cookies on success", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_ADMIN_WEB", "archispark-admin-web");
    vi.mocked(refreshTokens).mockResolvedValue({ access_token: "new-at", refresh_token: "new-rt", expires_in: 300, refresh_expires_in: 1800 });
    const res = await POST(makeReq("refresh_token=old-rt"));
    expect(refreshTokens).toHaveBeenCalledWith({ clientId: "archispark-admin-web", refreshToken: "old-rt" });
    expect(res.status).toBe(204);
    expect(res.cookies.get("access_token")?.value).toBe("new-at");
    expect(res.cookies.get("refresh_token")?.value).toBe("new-rt");
  });
});
