import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from "jose";
import { getKeycloakConfig } from "./config.js";

export interface KeycloakClaims {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  realm_access?: { roles: string[] };
}

// One JWKS fetcher per Keycloak realm URL — jose caches/refreshes the keys internally.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string, realm: string): ReturnType<typeof createRemoteJWKSet> {
  const key = `${url}/realms/${realm}`;
  let jwks = jwksCache.get(key);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${key}/protocol/openid-connect/certs`));
    jwksCache.set(key, jwks);
  }
  return jwks;
}

/**
 * Verifies a Keycloak access token (signature + issuer) via the realm's JWKS.
 * Returns the decoded claims, or `null` if the token is invalid/expired, the
 * JWKS can't be fetched, or Keycloak isn't configured (KEYCLOAK_URL/REALM unset)
 * — callers treat `null` as "not a Keycloak token" and fall back accordingly.
 */
export async function verifyAccessToken(token: string): Promise<KeycloakClaims | null> {
  try {
    const { url, realm } = getKeycloakConfig();
    const jwks = getJwks(url, realm);
    const { payload }: JWTVerifyResult = await jwtVerify(token, jwks, {
      issuer: `${url}/realms/${realm}`,
    });
    return payload as unknown as KeycloakClaims;
  } catch {
    return null;
  }
}
