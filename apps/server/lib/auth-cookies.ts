import type { NextRequest, NextResponse } from "next/server"
import type { TokenSet } from "@workspace/auth"

// Keycloak's default refresh token lifetime when `refresh_expires_in` is absent.
const FALLBACK_REFRESH_TTL = 60 * 60 * 24 * 30

export const AUTH_COOKIES = [
  "access_token",
  "refresh_token",
  "id_token",
  "auth_provider",
] as const
export const OIDC_FLOW_COOKIES = [
  "pkce_verifier",
  "oidc_state",
  "auth_redirect",
] as const

function cookieOptions(req: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

/** Sets the access/refresh/id token cookies from a Keycloak token set. */
export function setAuthCookies(
  res: NextResponse,
  req: NextRequest,
  tokens: TokenSet
): void {
  res.cookies.set(
    "access_token",
    tokens.access_token,
    cookieOptions(req, tokens.expires_in)
  )
  const refreshTtl = tokens.refresh_expires_in ?? FALLBACK_REFRESH_TTL
  if (tokens.refresh_token) {
    res.cookies.set(
      "refresh_token",
      tokens.refresh_token,
      cookieOptions(req, refreshTtl)
    )
  }
  if (tokens.id_token) {
    res.cookies.set("id_token", tokens.id_token, cookieOptions(req, refreshTtl))
  }
  res.cookies.set("auth_provider", "keycloak", cookieOptions(req, refreshTtl))
}

/**
 * Sets the access/refresh token cookies for a local (username/password)
 * session, plus the `auth_provider` cookie that `/api/auth/refresh` and
 * `/api/auth/logout` read to dispatch to the local vs. Keycloak flow.
 * No `id_token` — that's an OIDC-only concept.
 */
export function setLocalAuthCookies(
  res: NextResponse,
  req: NextRequest,
  tokens: {
    accessToken: string
    accessTokenTtl: number
    refreshToken: string
    refreshTokenTtl: number
  }
): void {
  res.cookies.set(
    "access_token",
    tokens.accessToken,
    cookieOptions(req, tokens.accessTokenTtl)
  )
  res.cookies.set(
    "refresh_token",
    tokens.refreshToken,
    cookieOptions(req, tokens.refreshTokenTtl)
  )
  res.cookies.set(
    "auth_provider",
    "local",
    cookieOptions(req, tokens.refreshTokenTtl)
  )
}

/** Clears the access/refresh/id token cookies. */
export function clearAuthCookies(res: NextResponse, req: NextRequest): void {
  for (const name of AUTH_COOKIES)
    res.cookies.set(name, "", cookieOptions(req, 0))
}

/** Clears the short-lived cookies used during the PKCE/state handshake. */
export function clearOidcFlowCookies(
  res: NextResponse,
  req: NextRequest
): void {
  for (const name of OIDC_FLOW_COOKIES)
    res.cookies.set(name, "", cookieOptions(req, 0))
}
