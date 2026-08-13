import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

interface AccessTokenPayload {
  exp?: number
  must_change_password?: boolean
}

function decodeAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded)) as AccessTokenPayload
  } catch {
    return null
  }
}

function isExpired(token: string): boolean {
  const exp = decodeAccessToken(token)?.exp
  return !exp || exp * 1000 <= Date.now()
}

function extractCookieValue(
  setCookieHeaders: string[],
  name: string
): string | undefined {
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";")
    const eq = pair?.indexOf("=") ?? -1
    if (eq !== -1 && pair!.slice(0, eq) === name)
      return decodeURIComponent(pair!.slice(eq + 1))
  }
  return undefined
}

/** A forced local password change (see /api/auth/local/change-password) blocks every other page. */
function redirectToChangePassword(
  req: NextRequest,
  extraSetCookies: string[] = []
): NextResponse {
  const res = NextResponse.redirect(new URL("/change-password", req.url))
  for (const cookie of extraSetCookies) res.headers.append("set-cookie", cookie)
  return res
}

export default async function proxy(req: NextRequest) {
  const accessToken = req.cookies.get("access_token")?.value
  if (accessToken && !isExpired(accessToken)) {
    if (
      decodeAccessToken(accessToken)?.must_change_password &&
      req.nextUrl.pathname !== "/change-password"
    ) {
      return redirectToChangePassword(req)
    }
    return NextResponse.next()
  }

  // Access token missing or expired — try a silent refresh before bouncing to login.
  const refreshToken = req.cookies.get("refresh_token")?.value
  if (refreshToken) {
    const refreshRes = await fetch(new URL("/api/auth/refresh", req.url), {
      method: "POST",
      headers: { cookie: req.headers.get("cookie") ?? "" },
    })
    if (refreshRes.ok) {
      const setCookies = refreshRes.headers.getSetCookie()
      const newAccessToken = extractCookieValue(setCookies, "access_token")
      if (
        newAccessToken &&
        decodeAccessToken(newAccessToken)?.must_change_password &&
        req.nextUrl.pathname !== "/change-password"
      ) {
        return redirectToChangePassword(req, setCookies)
      }
      const res = NextResponse.next()
      for (const cookie of setCookies) {
        res.headers.append("set-cookie", cookie)
      }
      return res
    }
  }

  // /login (not /api/auth/login, which immediately kicks off the Keycloak
  // OIDC flow) — the page offers a local username/password form and, only
  // if KEYCLOAK_SSO_ENABLED, a "Continue with Keycloak" link into that flow.
  const loginUrl = new URL("/login", req.url)
  loginUrl.searchParams.set("from", req.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    // mcp: the /mcp/:path* rewrite (next.config.ts) forwards to the
    // Bearer-token-authenticated pages/api/mcp.ts — this cookie-based page
    // guard must not intercept it (it did, and redirected MCP clients to
    // /api/auth/login, before this exclusion existed).
    "/((?!login|auth|api|mcp|_next/static|_next/image|favicon.ico).*)",
  ],
}
