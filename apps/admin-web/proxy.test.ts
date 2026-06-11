import { describe, it, expect } from "vitest";
import proxy from "./proxy";
import type { NextRequest } from "next/server";

function makeReq(cookies: Array<{ name: string; value: string }>): NextRequest {
  return {
    url: "http://localhost:8001/dashboard",
    nextUrl: { pathname: "/dashboard" },
    cookies: { getAll: () => cookies },
  } as unknown as NextRequest;
}

describe("proxy middleware", () => {
  it("redirects to /login when no session cookie present", () => {
    const res = proxy(makeReq([]));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("from=%2Fdashboard");
  });

  it("allows request with unprefixed session_token cookie", () => {
    const res = proxy(makeReq([{ name: "better-auth.session_token", value: "abc" }]));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows request with __Secure- prefixed session_token (HTTPS)", () => {
    const res = proxy(makeReq([{ name: "__Secure-better-auth.session_token", value: "abc" }]));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows request with __Host- prefixed session_data", () => {
    const res = proxy(makeReq([{ name: "__Host-better-auth.session_data", value: "abc" }]));
    expect(res.headers.get("location")).toBeNull();
  });

  it("ignores unrelated cookies", () => {
    const res = proxy(makeReq([{ name: "theme", value: "dark" }]));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
