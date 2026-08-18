/**
 * Opaque refresh tokens for the local (username/password) auth flow —
 * `local_refresh_tokens` stores only a sha256 hash, never the clear token
 * (see packages/db/src/schema.ts). Rotation on every use, chained via
 * `replacedById`: presenting a token that was already rotated (i.e.
 * `revokedAt` is set but it's not the caller's fault — someone else already
 * used it) revokes the whole session family, the standard reuse-detection
 * response to a leaked refresh token.
 */

import { randomBytes, createHash } from "crypto"
import { and, eq, isNull } from "drizzle-orm"
import { db, localRefreshTokens } from "@workspace/db"

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days, mirrors Keycloak's fallback TTL (auth-cookies.ts)
const TOKEN_PREFIX = "lrt_"

export interface IssuedRefreshToken {
  token: string
  expiresAt: number
}

export interface RefreshTokenMeta {
  userAgent: string | null
  ipAddress: string | null
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

async function insertRefreshToken(
  userId: string,
  meta: RefreshTokenMeta
): Promise<IssuedRefreshToken & { id: number }> {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url")
  const expiresAt = now() + REFRESH_TOKEN_TTL_SECONDS
  const [row] = await db
    .insert(localRefreshTokens)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    })
    .returning({ id: localRefreshTokens.id })
  if (!row) throw new Error("Failed to issue refresh token")
  return { token, expiresAt, id: row.id }
}

/** Issues a new refresh token for a freshly authenticated user (login). */
export async function issueRefreshToken(
  userId: string,
  meta: RefreshTokenMeta
): Promise<IssuedRefreshToken> {
  return insertRefreshToken(userId, meta)
}

/** Revokes every active refresh token for a user — used on reuse detection and password change. */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .update(localRefreshTokens)
    .set({ revokedAt: now() })
    .where(
      and(
        eq(localRefreshTokens.userId, userId),
        isNull(localRefreshTokens.revokedAt)
      )
    )
}

/** Revokes a single refresh token by its clear value — used on logout. */
export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(localRefreshTokens)
    .set({ revokedAt: now() })
    .where(eq(localRefreshTokens.tokenHash, hashToken(token)))
}

/**
 * Verifies a refresh token and rotates it: the presented token is revoked
 * and a new one issued in its place. Returns `null` if the token is
 * unknown, expired, or already revoked (reuse — see module doc, which also
 * revokes the rest of that user's sessions as a side effect).
 */
export async function rotateRefreshToken(
  token: string,
  meta: RefreshTokenMeta
): Promise<(IssuedRefreshToken & { userId: string }) | null> {
  const [row] = await db
    .select()
    .from(localRefreshTokens)
    .where(eq(localRefreshTokens.tokenHash, hashToken(token)))
  if (!row) return null

  if (row.revokedAt !== null) {
    await revokeAllRefreshTokens(row.userId)
    return null
  }
  if (row.expiresAt < now()) return null

  const next = await insertRefreshToken(row.userId, meta)
  await db
    .update(localRefreshTokens)
    .set({ revokedAt: now(), replacedById: next.id })
    .where(eq(localRefreshTokens.id, row.id))

  return { token: next.token, expiresAt: next.expiresAt, userId: row.userId }
}
