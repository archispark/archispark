import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { eq, sql } from "drizzle-orm"
import { db, users } from "@workspace/db"
import {
  verifyPassword,
  signLocalAccessToken,
  LOCAL_ACCESS_TOKEN_TTL_SECONDS,
} from "@workspace/auth"
import { UnauthorizedError, TooManyRequestsError } from "@/lib/archimate/errors"
import { ensureDefaultPlatformOrganization } from "@/lib/archimate/platform-context-store"
import { parseBody } from "@/lib/archimate/validation"
import { setLocalAuthCookies } from "@/lib/auth-cookies"
import { withErrorHandling } from "@/lib/http/with-error-handling"
import {
  getClientIp,
  isRateLimited,
  recordFailedAttempt,
} from "@/lib/archimate/local-auth-rate-limit"
import { issueRefreshToken } from "@/lib/archimate/local-auth-tokens"

export const dynamic = "force-dynamic"

const LoginSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis."),
  password: z.string().min(1, "Mot de passe requis."),
})

// A validly-formatted argon2id hash of an unguessable, unused password —
// verified on every login attempt for an unknown username so a failed
// lookup takes the same time as a failed password check (no username
// enumeration via response timing).
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$Az51qtxnj6GamFGN+l2alQ$qnj+v1e/i31fObulBSJQZccPrIUFxlAX7uXZ59JyU/k"

/** Signs in with a local (username/password) account, issuing an access + refresh token pair. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new UnauthorizedError("Identifiants incorrects.")
  }
  const { username, password } = parseBody(LoginSchema, body)
  const normalizedUsername = username.trim().toLowerCase()
  const ip = getClientIp(req)

  if (await isRateLimited(normalizedUsername, ip))
    throw new TooManyRequestsError(
      "Trop de tentatives de connexion. Réessayez plus tard."
    )

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, normalizedUsername))

  const passwordOk = await verifyPassword(
    user?.passwordHash ?? DUMMY_HASH,
    password
  )
  if (!user || !user.enabled || !passwordOk) {
    await recordFailedAttempt(normalizedUsername, ip)
    throw new UnauthorizedError("Identifiants incorrects.")
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
  const refresh = await issueRefreshToken(user.id, {
    userAgent: req.headers.get("user-agent"),
    ipAddress: ip,
  })

  await db
    .update(users)
    .set({ lastLoginAt: sql`extract(epoch from now())::int` })
    .where(eq(users.id, user.id))

  if (user.role === "platform_admin")
    await ensureDefaultPlatformOrganization(user.id)

  const res = NextResponse.json({
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
  setLocalAuthCookies(res, req, {
    accessToken,
    accessTokenTtl: LOCAL_ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: refresh.token,
    refreshTokenTtl: refresh.expiresAt - Math.floor(Date.now() / 1000),
  })
  return res
})
