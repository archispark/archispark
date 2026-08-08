import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

interface AccessTokenPayload {
  exp?: number
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

export default async function proxy(req: NextRequest) {
  const accessToken = req.cookies.get("access_token")?.value
  if (accessToken && !isExpired(accessToken)) {
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
      const res = NextResponse.next()
      for (const cookie of refreshRes.headers.getSetCookie()) {
        res.headers.append("set-cookie", cookie)
      }
      return res
    }
  }

  const loginUrl = new URL("/api/auth/login", req.url)
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
