/**
 * Tests for computeTrustedOrigins — the dynamic CSRF trusted-origins logic.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeTrustedOrigins, computeAdvancedOptions } from "./better-auth.js";

// Lightweight Request stub: avoids fetch-spec restrictions on forbidden
// headers like "host", so the host-fallback branch can be exercised.
function req(headers: Record<string, string>): Request {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Request;
}

describe("computeTrustedOrigins", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["WEB_URL"];
    delete process.env["TRUSTED_ORIGINS"];
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns the default web origin when no request and no env", () => {
    expect(computeTrustedOrigins()).toEqual(["http://localhost:8000"]);
  });

  it("uses WEB_URL when set", () => {
    process.env["WEB_URL"] = "https://app.example.com";
    expect(computeTrustedOrigins()).toEqual(["https://app.example.com"]);
  });

  it("appends comma-separated TRUSTED_ORIGINS, trimmed and filtered", () => {
    process.env["TRUSTED_ORIGINS"] = "https://a.com, https://b.com ,, ";
    expect(computeTrustedOrigins()).toEqual([
      "http://localhost:8000",
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("trusts the request origin when its host matches x-forwarded-host", () => {
    const result = computeTrustedOrigins(
      req({ origin: "http://192.168.1.25:8000", "x-forwarded-host": "192.168.1.25:8000" }),
    );
    expect(result).toContain("http://192.168.1.25:8000");
  });

  it("falls back to the host header when x-forwarded-host is absent", () => {
    const result = computeTrustedOrigins(
      req({ origin: "http://192.168.1.25:8000", host: "192.168.1.25:8000" }),
    );
    expect(result).toContain("http://192.168.1.25:8000");
  });

  it("does NOT trust the origin when its host differs from the served host", () => {
    const result = computeTrustedOrigins(
      req({ origin: "http://evil.example.com", "x-forwarded-host": "192.168.1.25:8000" }),
    );
    expect(result).not.toContain("http://evil.example.com");
  });

  it("ignores a malformed Origin header", () => {
    const result = computeTrustedOrigins(
      req({ origin: "not-a-url", "x-forwarded-host": "192.168.1.25:8000" }),
    );
    expect(result).toEqual(["http://localhost:8000"]);
  });

  it("ignores the origin when no served host is present", () => {
    // A bare Request has no host/x-forwarded-host header set explicitly.
    const result = computeTrustedOrigins(req({ origin: "http://192.168.1.25:8000" }));
    expect(result).not.toContain("http://192.168.1.25:8000");
  });
});

describe("computeAdvancedOptions", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns no crossSubDomainCookies config when COOKIE_DOMAIN is unset", () => {
    delete process.env["COOKIE_DOMAIN"];
    expect(computeAdvancedOptions()).toEqual({});
  });

  it("enables crossSubDomainCookies scoped to COOKIE_DOMAIN when set", () => {
    process.env["COOKIE_DOMAIN"] = ".example.com";
    expect(computeAdvancedOptions()).toEqual({
      crossSubDomainCookies: { enabled: true, domain: ".example.com" },
    });
  });
});
