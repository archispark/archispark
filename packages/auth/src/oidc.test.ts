import { describe, it, expect, afterEach, vi } from "vitest";
import {
  createPkcePair,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  buildLogoutUrl,
} from "./oidc.js";

const KC_URL = "http://localhost:8080";
const KC_REALM = "archispark";
const TOKEN_ENDPOINT = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`;

describe("createPkcePair", () => {
  it("generates a verifier and a matching S256 challenge", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThan(0);
    expect(challenge.length).toBeGreaterThan(0);
    expect(verifier).not.toBe(challenge);
    // base64url alphabet, no padding
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates distinct pairs on each call", () => {
    const a = createPkcePair();
    const b = createPkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("buildAuthorizationUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the Keycloak authorization endpoint with PKCE params", () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    const url = new URL(
      buildAuthorizationUrl({
        clientId: "archispark-web",
        redirectUri: "http://localhost:8000/api/auth/callback",
        state: "abc123",
        codeChallenge: "challenge-value",
      }),
    );
    expect(url.origin + url.pathname).toBe(`${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/auth`);
    expect(url.searchParams.get("client_id")).toBe("archispark-web");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8000/api/auth/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("exchangeCodeForTokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts an authorization_code grant and returns the token set", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(input.toString()).toBe(TOKEN_ENDPOINT);
      const body = new URLSearchParams(init?.body as string);
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("client_id")).toBe("archispark-web");
      expect(body.get("redirect_uri")).toBe("http://localhost:8000/api/auth/callback");
      expect(body.get("code")).toBe("auth-code");
      expect(body.get("code_verifier")).toBe("verifier-value");
      return new Response(
        JSON.stringify({ access_token: "at", refresh_token: "rt", id_token: "it", expires_in: 300, refresh_expires_in: 1800 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await exchangeCodeForTokens({
      clientId: "archispark-web",
      redirectUri: "http://localhost:8000/api/auth/callback",
      code: "auth-code",
      codeVerifier: "verifier-value",
    });

    expect(tokens).toEqual({ access_token: "at", refresh_token: "rt", id_token: "it", expires_in: 300, refresh_expires_in: 1800 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when Keycloak responds with a non-2xx status", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad request", { status: 400 })));

    await expect(
      exchangeCodeForTokens({
        clientId: "archispark-web",
        redirectUri: "http://localhost:8000/api/auth/callback",
        code: "bad-code",
        codeVerifier: "verifier-value",
      }),
    ).rejects.toThrow("Keycloak token request failed: 400");
  });
});

describe("refreshTokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a refresh_token grant and returns the new token set", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(input.toString()).toBe(TOKEN_ENDPOINT);
      const body = new URLSearchParams(init?.body as string);
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("client_id")).toBe("archispark-web");
      expect(body.get("refresh_token")).toBe("old-refresh");
      return new Response(JSON.stringify({ access_token: "new-at", refresh_token: "new-rt", expires_in: 300 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokens = await refreshTokens({ clientId: "archispark-web", refreshToken: "old-refresh" });

    expect(tokens).toEqual({ access_token: "new-at", refresh_token: "new-rt", expires_in: 300 });
  });

  it("throws when Keycloak rejects the refresh token", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid_grant", { status: 400 })));

    await expect(refreshTokens({ clientId: "archispark-web", refreshToken: "expired" })).rejects.toThrow(
      "Keycloak token request failed: 400",
    );
  });
});

describe("buildLogoutUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the end-session endpoint with id_token_hint when provided", () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    const url = new URL(
      buildLogoutUrl({ clientId: "archispark-web", idToken: "id-token-value", postLogoutRedirectUri: "http://localhost:8000/login" }),
    );
    expect(url.origin + url.pathname).toBe(`${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/logout`);
    expect(url.searchParams.get("client_id")).toBe("archispark-web");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:8000/login");
    expect(url.searchParams.get("id_token_hint")).toBe("id-token-value");
  });

  it("omits id_token_hint when no id token is supplied", () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    const url = new URL(buildLogoutUrl({ clientId: "archispark-web", postLogoutRedirectUri: "http://localhost:8000/login" }));
    expect(url.searchParams.has("id_token_hint")).toBe(false);
  });
});
