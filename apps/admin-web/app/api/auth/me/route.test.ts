import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@workspace/auth", () => ({
  verifyAccessToken: vi.fn(),
  ORG_ROLES: ["owner", "admin", "member"],
}));

import { verifyAccessToken } from "@workspace/auth";

function makeReq(cookie?: string): NextRequest {
  return new NextRequest("http://localhost:8001/api/auth/me", {
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /api/auth/me", () => {
  afterEach(() => {
    vi.mocked(verifyAccessToken).mockReset();
  });

  it("returns 401 when there is no access_token cookie", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when the access token is invalid", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue(null);
    const res = await GET(makeReq("access_token=bad"));
    expect(res.status).toBe(401);
  });

  it("returns the user derived from the token claims", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: "c8a1f6c0-0000-4000-8000-000000000001",
      preferred_username: "admin",
      name: "Admin Archispark",
      email: "admin@archispark.internal",
      realm_access: { roles: ["platform_admin"] },
    });
    const res = await GET(makeReq("access_token=good"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: "c8a1f6c0-0000-4000-8000-000000000001",
      username: "admin",
      name: "Admin Archispark",
      email: "admin@archispark.internal",
      role: "platform_admin",
      organizations: [],
    });
  });

  it("defaults role to user when not platform_admin", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: "c8a1f6c0-0000-4000-8000-000000000002",
      preferred_username: "user",
      realm_access: { roles: [] },
    });
    const res = await GET(makeReq("access_token=good"));
    const body = await res.json();
    expect(body.role).toBe("user");
    expect(body.email).toBeNull();
    expect(body.name).toBe("user");
    expect(body.organizations).toEqual([]);
  });

  it("derives organizations from the organizations claim", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      sub: "c8a1f6c0-0000-4000-8000-000000000003",
      preferred_username: "archi",
      realm_access: { roles: [] },
      organizations: {
        "org-1": { name: "Default", roles: ["owner"] },
      },
    });
    const res = await GET(makeReq("access_token=good"));
    const body = await res.json();
    expect(body.organizations).toEqual([{ id: "org-1", name: "Default", role: "owner" }]);
  });
});
