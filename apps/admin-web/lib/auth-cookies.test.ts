import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIES, OIDC_FLOW_COOKIES, clearAuthCookies, clearOidcFlowCookies, setAuthCookies } from "./auth-cookies";
import type { TokenSet } from "@workspace/auth";

function makeReq(url = "http://localhost:8001/api/auth/callback"): NextRequest {
  return new NextRequest(url);
}

describe("setAuthCookies", () => {
  it("sets access, refresh and id token cookies with the right max-ages", () => {
    const req = makeReq();
    const res = NextResponse.next();
    const tokens: TokenSet = {
      access_token: "at",
      refresh_token: "rt",
      id_token: "it",
      expires_in: 300,
      refresh_expires_in: 1800,
    };
    setAuthCookies(res, req, tokens);

    expect(res.cookies.get("access_token")?.value).toBe("at");
    expect(res.cookies.get("access_token")?.maxAge).toBe(300);
    expect(res.cookies.get("refresh_token")?.value).toBe("rt");
    expect(res.cookies.get("refresh_token")?.maxAge).toBe(1800);
    expect(res.cookies.get("id_token")?.value).toBe("it");
    expect(res.cookies.get("id_token")?.maxAge).toBe(1800);
    expect(res.cookies.get("access_token")?.httpOnly).toBe(true);
    expect(res.cookies.get("access_token")?.secure).toBe(false);
  });

  it("falls back to a 30-day TTL when refresh_expires_in is absent", () => {
    const req = makeReq();
    const res = NextResponse.next();
    setAuthCookies(res, req, { access_token: "at", refresh_token: "rt", expires_in: 60 });
    expect(res.cookies.get("refresh_token")?.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("omits refresh/id token cookies when not present in the token set", () => {
    const req = makeReq();
    const res = NextResponse.next();
    setAuthCookies(res, req, { access_token: "at", expires_in: 60 });
    expect(res.cookies.get("refresh_token")).toBeUndefined();
    expect(res.cookies.get("id_token")).toBeUndefined();
  });

  it("marks cookies as secure for https requests", () => {
    const req = makeReq("https://app.example.com/api/auth/callback");
    const res = NextResponse.next();
    setAuthCookies(res, req, { access_token: "at", expires_in: 60 });
    expect(res.cookies.get("access_token")?.secure).toBe(true);
  });
});

describe("clearAuthCookies", () => {
  it("clears all auth cookies", () => {
    const req = makeReq();
    const res = NextResponse.next();
    clearAuthCookies(res, req);
    for (const name of AUTH_COOKIES) {
      expect(res.cookies.get(name)?.value).toBe("");
      expect(res.cookies.get(name)?.maxAge).toBe(0);
    }
  });
});

describe("clearOidcFlowCookies", () => {
  it("clears all short-lived OIDC flow cookies", () => {
    const req = makeReq();
    const res = NextResponse.next();
    clearOidcFlowCookies(res, req);
    for (const name of OIDC_FLOW_COOKIES) {
      expect(res.cookies.get(name)?.value).toBe("");
      expect(res.cookies.get(name)?.maxAge).toBe(0);
    }
  });
});
