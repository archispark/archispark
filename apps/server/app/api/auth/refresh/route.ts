import { NextResponse, type NextRequest } from "next/server"
import {
  refreshTokens,
  LOCAL_ACCESS_TOKEN_TTL_SECONDS,
  signLocalAccessToken,
} from "@workspace/auth"
import {
  clearAuthCookies,
  setAuthCookies,
  setLocalAuthCookies,
} from "@/lib/auth-cookies"
import { rotateRefreshToken } from "@/lib/archimate/local-auth-tokens"
import { getClientIp } from "@/lib/archimate/local-auth-rate-limit"
import { db, users } from "@workspace/db"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

/** Rotates a local refresh token cookie for a fresh access/refresh token pair. */
async function refreshLocal(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get("refresh_token")?.value
  if (!refreshToken) {
    const res = new NextResponse(null, { status: 401 })
    clearAuthCookies(res, req)
    return res
  }

  const rotated = await rotateRefreshToken(refreshToken, {
    userAgent: req.headers.get("user-agent"),
    ipAddress: getClientIp(req),
  })
  if (!rotated) {
    const res = new NextResponse(null, { status: 401 })
    clearAuthCookies(res, req)
    return res
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, rotated.userId))
  if (!user || !user.enabled) {
    const res = new NextResponse(null, { status: 401 })
    clearAuthCookies(res, req)
    return res
  }

  const accessToken = await signLocalAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName ?? undefined,
    mustChangePassword: user.mustChangePassword,
  })
  const res = new NextResponse(null, { status: 204 })
  setLocalAuthCookies(res, req, {
    accessToken,
    accessTokenTtl: LOCAL_ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: rotated.token,
    refreshTokenTtl: rotated.expiresAt - Math.floor(Date.now() / 1000),
  })
  return res
}

/** Exchanges the refresh token cookie for a fresh access/refresh token pair — dispatches on the `auth_provider` cookie. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.cookies.get("auth_provider")?.value === "local")
    return refreshLocal(req)

  const clientId = process.env.KEYCLOAK_CLIENT_ID_WEB
  const refreshToken = req.cookies.get("refresh_token")?.value

  if (!clientId || !refreshToken) {
    const res = new NextResponse(null, { status: 401 })
    clearAuthCookies(res, req)
    return res
  }

  try {
    const tokens = await refreshTokens({ clientId, refreshToken })
    const res = new NextResponse(null, { status: 204 })
    setAuthCookies(res, req, tokens)
    return res
  } catch {
    const res = new NextResponse(null, { status: 401 })
    clearAuthCookies(res, req)
    return res
  }
}
