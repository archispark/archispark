import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db, users } from "@workspace/db"
import {
  verifyPassword,
  hashPassword,
  signLocalAccessToken,
  LOCAL_ACCESS_TOKEN_TTL_SECONDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@workspace/auth"
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/archimate/errors"
import { parseBody } from "@/lib/archimate/validation"
import { setLocalAuthCookies } from "@/lib/auth-cookies"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import { withAuth } from "@/lib/http/with-auth"
import {
  issueRefreshToken,
  revokeAllRefreshTokens,
} from "@/lib/archimate/local-auth-tokens"
import { getClientIp } from "@/lib/archimate/local-auth-rate-limit"

export const dynamic = "force-dynamic"

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
  newPassword: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
    )
    .max(
      MAX_PASSWORD_LENGTH,
      `Le mot de passe ne peut pas dépasser ${MAX_PASSWORD_LENGTH} caractères.`
    ),
})

/**
 * Changes a local account's password — the only route a `mustChangePassword`
 * session can reach (see proxy.ts). Revokes every other refresh token for
 * the account (a password change ends every other session) and re-issues a
 * fresh, `mustChangePassword: false` token pair for the caller's own
 * session, so they aren't logged out by their own request.
 */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, auth) => {
    if (!auth.user.id.startsWith("local:"))
      throw new ForbiddenError("Ce compte n'a pas de mot de passe local.")

    const { currentPassword, newPassword } = parseBody(
      ChangePasswordSchema,
      await req.json().catch(() => ({}))
    )

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, auth.user.id))
    if (!user) throw new NotFoundError("Compte introuvable.")

    if (!(await verifyPassword(user.passwordHash, currentPassword)))
      throw new UnauthorizedError("Mot de passe actuel incorrect.")

    const passwordHash = await hashPassword(newPassword)
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
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
