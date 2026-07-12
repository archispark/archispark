import { describe, it, expect, afterEach, vi } from "vitest";
import { getAdminToken, clearAdminTokenCache } from "./admin-token.js";

const KC_URL = "http://localhost:8080";
const KC_REALM = "archispark";
const TOKEN_ENDPOINT = `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`;

function stubEnv(): void {
  vi.stubEnv("KEYCLOAK_URL", KC_URL);
  vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "archispark-api");
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "archispark-api-secret");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearAdminTokenCache();
});

describe("getAdminToken", () => {
  it("requests a client_credentials token using the admin client credentials", async () => {
    stubEnv();
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(input.toString()).toBe(TOKEN_ENDPOINT);
      const body = new URLSearchParams(init?.body as string);
      expect(body.get("grant_type")).toBe("client_credentials");
      expect(body.get("client_id")).toBe("archispark-api");
      expect(body.get("client_secret")).toBe("archispark-api-secret");
      return new Response(JSON.stringify({ access_token: "admin-token", expires_in: 60 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await getAdminToken();

    expect(token).toBe("admin-token");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("caches the token and does not refetch before expiry", async () => {
    stubEnv();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "admin-token", expires_in: 300 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await getAdminToken();
    const second = await getAdminToken();

    expect(first).toBe("admin-token");
    expect(second).toBe("admin-token");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refetches once the cached token is within the expiry buffer", async () => {
    stubEnv();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "short-lived", expires_in: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAdminToken();
    await getAdminToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when Keycloak responds with a non-2xx status", async () => {
    stubEnv();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 401 })));

    await expect(getAdminToken()).rejects.toThrow("Keycloak admin token request failed: 401");
  });

  it("throws when KEYCLOAK_ADMIN_CLIENT_ID is missing", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "archispark-api-secret");

    await expect(getAdminToken()).rejects.toThrow("KEYCLOAK_ADMIN_CLIENT_ID is not set");
  });

  it("throws when KEYCLOAK_ADMIN_CLIENT_SECRET is missing", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "archispark-api");

    await expect(getAdminToken()).rejects.toThrow("KEYCLOAK_ADMIN_CLIENT_SECRET is not set");
  });
});
