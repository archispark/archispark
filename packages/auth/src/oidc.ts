import { createHash, randomBytes } from "node:crypto";
import { getKeycloakConfig } from "./config.js";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function endpoint(name: "auth" | "token" | "logout"): string {
  const { url, realm } = getKeycloakConfig();
  return `${url}/realms/${realm}/protocol/openid-connect/${name}`;
}

/** Generates a PKCE verifier/challenge pair (S256). */
export function createPkcePair(): PkcePair {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Builds the Keycloak authorization-code + PKCE login URL. */
export function buildAuthorizationUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(endpoint("auth"));
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function requestTokens(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(endpoint("token"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    throw new Error(`Keycloak token request failed: ${res.status}`);
  }
  return (await res.json()) as TokenSet;
}

/** Exchanges an authorization code (+ PKCE verifier) for a token set. */
export function exchangeCodeForTokens(opts: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<TokenSet> {
  return requestTokens({
    grant_type: "authorization_code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code: opts.code,
    code_verifier: opts.codeVerifier,
  });
}

/** Exchanges a refresh token for a new token set. */
export function refreshTokens(opts: { clientId: string; refreshToken: string }): Promise<TokenSet> {
  return requestTokens({
    grant_type: "refresh_token",
    client_id: opts.clientId,
    refresh_token: opts.refreshToken,
  });
}

/** Builds the Keycloak RP-initiated logout (end-session) URL. */
export function buildLogoutUrl(opts: { clientId: string; idToken?: string; postLogoutRedirectUri: string }): string {
  const url = new URL(endpoint("logout"));
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("post_logout_redirect_uri", opts.postLogoutRedirectUri);
  if (opts.idToken) url.searchParams.set("id_token_hint", opts.idToken);
  return url.toString();
}
