import { getKeycloakConfig } from "./config.js";

interface AdminTokenResponse {
  access_token: string;
  expires_in: number;
}

const EXPIRY_BUFFER_MS = 30_000;

let cached: { token: string; expiresAt: number } | null = null;

function getAdminCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env["KEYCLOAK_ADMIN_CLIENT_ID"];
  const clientSecret = process.env["KEYCLOAK_ADMIN_CLIENT_SECRET"];
  if (!clientId) throw new Error("KEYCLOAK_ADMIN_CLIENT_ID is not set");
  if (!clientSecret) throw new Error("KEYCLOAK_ADMIN_CLIENT_SECRET is not set");
  return { clientId, clientSecret };
}

/**
 * Returns a cached `client_credentials` access token for the control-api's
 * confidential Keycloak client, refetching ~30s before it expires.
 */
export async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  const { url, realm } = getKeycloakConfig();
  const { clientId, clientSecret } = getAdminCredentials();

  const res = await fetch(`${url}/realms/${realm}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Keycloak admin token request failed: ${res.status}`);
  }
  const data = (await res.json()) as AdminTokenResponse;
  cached = { token: data.access_token, expiresAt: now + data.expires_in * 1000 - EXPIRY_BUFFER_MS };
  return cached.token;
}

/** Clears the cached admin token. Exposed for tests. */
export function clearAdminTokenCache(): void {
  cached = null;
}
