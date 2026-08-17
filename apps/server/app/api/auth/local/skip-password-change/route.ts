import { NextResponse, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/db"
import {
  signLocalAccessToken,
  LOCAL_ACCESS_TOKEN_TTL_SECONDS,
} from "@workspace/auth"
import { ForbiddenError, NotFoundError } from "@/lib/archimate/errors"
import { setLocalAuthCookies } from "@/lib/auth-cookies"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import {
  issueRefreshToken,
  revokeAllRefreshTokens,
} from "@/lib/archimate/local-auth-tokens"
import { getClientIp } from "@/lib/archimate/local-auth-rate-limit"

export const dynamic = "force-dynamic"

/**
 * Lets a local user keep their password, removing the first-login gate and
 * replacing the session tokens so the new claim takes effect immediately.
 */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    if (!auth.user.id.startsWith("local:"))
      throw new ForbiddenError("Ce compte n'a pas de mot de passe local.")

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, auth.user.id))
    if (!user) throw new NotFoundError("Compte introuvable.")

    await db
      .update(users)
      .set({ mustChangePassword: false })
      .where(eq(users.id, user.id))

    await revokeAllRefreshTokens(user.id)
    const refresh = await issueRefreshToken(user.id, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: getClientIp(req),
    })
    const accessToken = await signLocalAccessToken({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName ?? undefined,
      mustChangePassword: false,
    })

    const res = NextResponse.json({ ok: true })
    setLocalAuthCookies(res, req, {
      accessToken,
      accessTokenTtl: LOCAL_ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: refresh.token,
      refreshTokenTtl: refresh.expiresAt - Math.floor(Date.now() / 1000),
    })
    return res
  })
)
