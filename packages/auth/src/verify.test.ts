import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { verifyAccessToken } from "./verify.js";

const KC_URL = "http://localhost:8080";
const KC_REALM = "archispark";
const ISSUER = `${KC_URL}/realms/${KC_REALM}`;
const JWKS_URI = `${ISSUER}/protocol/openid-connect/certs`;

let privateKey: CryptoKey;
let jwk: Record<string, unknown>;

beforeAll(async () => {
  const { privateKey: priv, publicKey } = await generateKeyPair("RS256");
  privateKey = priv;
  jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
});

function mockJwks(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) =>
      input.toString() === JWKS_URI
        ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } })
        : new Response("not found", { status: 404 }),
    ),
  );
}

function signToken(opts: { issuer?: string; expSeconds?: number } = {}): Promise<string> {
  return new SignJWT({
    preferred_username: "admin",
    realm_access: { roles: ["platform_admin"] },
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject("kc-user-1")
    .setIssuer(opts.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(opts.expSeconds ?? Math.floor(Date.now() / 1000) + 3600)
    .sign(privateKey);
}

describe("verifyAccessToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns null when Keycloak is not configured", async () => {
    vi.stubEnv("KEYCLOAK_URL", "");
    vi.stubEnv("KEYCLOAK_REALM", "");
    expect(await verifyAccessToken("whatever")).toBeNull();
  });

  it("verifies a valid token and returns its claims", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    mockJwks();
    const token = await signToken();
    const claims = await verifyAccessToken(token);
    expect(claims?.sub).toBe("kc-user-1");
    expect(claims?.preferred_username).toBe("admin");
    expect(claims?.realm_access?.roles).toContain("platform_admin");
  });

  it("returns null for a garbage token", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    mockJwks();
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
  });

  it("returns null when the issuer doesn't match", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    mockJwks();
    const token = await signToken({ issuer: "http://evil:8080/realms/other" });
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    vi.stubEnv("KEYCLOAK_URL", KC_URL);
    vi.stubEnv("KEYCLOAK_REALM", KC_REALM);
    mockJwks();
    const token = await signToken({ expSeconds: Math.floor(Date.now() / 1000) - 10 });
    expect(await verifyAccessToken(token)).toBeNull();
  });
});
