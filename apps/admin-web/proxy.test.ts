import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import proxy from "./proxy";

function makeToken(payload: Record<string, unknown> | null): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload ?? {})).toString("base64url");
  return `${header}.${body}.sig`;
}

function makeReq(cookie?: string, path = "/users"): NextRequest {
  return new NextRequest(`http://localhost:8001${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /api/auth/login when there is no access_token cookie", async () => {
    const res = await proxy(makeReq());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/api/auth/login");
    expect(res.headers.get("location")).toContain("from=%2Fusers");
  });

  it("allows the request through with a valid (non-expired) access_token", async () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = await proxy(makeReq(`access_token=${token}`));
    expect(res.headers.get("location")).toBeNull();
  });

  it("treats a garbage access_token as expired and redirects without a refresh_token", async () => {
    const res = await proxy(makeReq("access_token=not-a-jwt"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/api/auth/login");
  });

  it("silently refreshes when the access_token is expired but refresh succeeds", async () => {
    const expired = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 });
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(input.toString()).toBe("http://localhost:8001/api/auth/refresh");
      expect(init?.method).toBe("POST");
      const headers = new Headers({ "set-cookie": "access_token=new-at; Path=/; HttpOnly" });
      headers.append("set-cookie", "refresh_token=new-rt; Path=/; HttpOnly");
      return new Response(null, { status: 204, headers });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxy(makeReq(`access_token=${expired}; refresh_token=rt`));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.getSetCookie()).toEqual([
      "access_token=new-at; Path=/; HttpOnly",
      "refresh_token=new-rt; Path=/; HttpOnly",
    ]);
  });

  it("redirects to /api/auth/login when the refresh request fails", async () => {
    const expired = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    const res = await proxy(makeReq(`access_token=${expired}; refresh_token=rt`));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/api/auth/login");
  });
});
