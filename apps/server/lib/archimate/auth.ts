/**
 * Resolves the authenticated caller for a request — verifies a Keycloak
 * access token (Bearer or `access_token` cookie) via JWKS, or a personal
 * `apiTokens` Bearer token. Framework-agnostic: reads the standard Web
 * `Headers` API, usable from Next.js Route Handlers (`NextRequest`).
 */

import { eq } from "drizzle-orm"
import { db, apiTokens } from "@workspace/db"
import {
  verifyAccessToken,
  type KeycloakClaims,
  getKeycloakUser,
  getUserRealmRoles,
} from "@workspace/auth"
import { ForbiddenError, UnauthorizedError } from "./errors"
import type { AuthContext, AuthUser, TokenContext } from "./access"

const PLATFORM_ADMIN_ROLE = "platform_admin"

export interface TokenUser {
  id: string
  username: string
  role: string
  email?: string
  emailVerified?: boolean
  organizationId: number
  workspaceId: number | null
}

export async function lookupApiToken(token: string): Promise<TokenUser | null> {
  const [row] = await db
    .select({
      id: apiTokens.id,
      userId: apiTokens.userId,
      expiresAt: apiTokens.expiresAt,
      organizationId: apiTokens.organizationId,
      workspaceId: apiTokens.workspaceId,
    })
    .from(apiTokens)
    .where(eq(apiTokens.token, token))
  if (!row) return null
  if (row.expiresAt !== null && row.expiresAt < Math.floor(Date.now() / 1000))
    return null
  // organizationId is only nullable during the expand→backfill migration
  // window (see packages/db/src/schema.ts) — every token the app can look up
  // has one by the time it serves traffic.
  if (row.organizationId === null) return null

  const kcUser = await getKeycloakUser(row.userId)
  if (!kcUser) return null
  const roles = await getUserRealmRoles(row.userId)
  const role = roles.some((r) => r.name === PLATFORM_ADMIN_ROLE)
    ? "platform_admin"
    : "user"
  const result: TokenUser = {
    id: kcUser.id!,
    username: kcUser.username,
    role,
    email: kcUser.email,
    emailVerified: kcUser.emailVerified,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
  }

  db.update(apiTokens)
    .set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {})
  return result
}

/** Builds the resolved user from a verified Keycloak access token's claims. */
function resolveKeycloakUser(claims: KeycloakClaims): AuthUser {
  return {
    id: claims.sub,
    username: claims.preferred_username ?? claims.sub,
    role: claims.realm_access?.roles?.includes(PLATFORM_ADMIN_ROLE)
      ? "platform_admin"
      : "user",
    email: claims.email,
    emailVerified: claims.email_verified,
  }
}

/** Reads a single cookie value from a raw `Cookie` request header. */
function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

/** Builds the resolved AuthContext from a personal API token lookup — reused by pages/api/mcp.ts. */
export function tokenUserToContext(tokenUser: TokenUser): AuthContext {
  const user: AuthUser = {
    id: tokenUser.id,
    username: tokenUser.username,
    role: tokenUser.role,
    email: tokenUser.email,
    emailVerified: tokenUser.emailVerified,
  }
  const tokenContext: TokenContext = {
    organizationId: tokenUser.organizationId,
    workspaceId: tokenUser.workspaceId,
  }
  return { user, tokenContext }
}

/**
 * Resolves the authenticated caller for `req`. Bearer token tried first — a
 * personal API token (`apiTokens` row) if it matches, otherwise a Keycloak
 * JWT. Falls back to the `access_token` cookie (Keycloak JWT only — personal
 * tokens are never accepted via cookie). Throws `UnauthorizedError` on any
 * failure — callers don't need to check a return value.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    let tokenUser: TokenUser | null
    try {
      tokenUser = await lookupApiToken(token)
    } catch {
      throw new UnauthorizedError("Erreur d'authentification.")
    }
    if (tokenUser) return tokenUserToContext(tokenUser)

    // Not a personal API token — try a Keycloak-issued access token.
    let claims: KeycloakClaims | null
    try {
      claims = await verifyAccessToken(token)
    } catch {
      throw new UnauthorizedError("Erreur d'authentification.")
    }
    if (!claims) throw new UnauthorizedError("Token invalide.")
    return { user: resolveKeycloakUser(claims), tokenContext: null }
  }

  const cookieToken = getCookieValue(req.headers.get("cookie"), "access_token")
  if (!cookieToken) throw new UnauthorizedError("Non authentifié.")

  let claims: KeycloakClaims | null
  try {
    claims = await verifyAccessToken(cookieToken)
  } catch {
    throw new UnauthorizedError("Session invalide.")
  }
  if (!claims) throw new UnauthorizedError("Session invalide.")
  return { user: resolveKeycloakUser(claims), tokenContext: null }
}

/** Like `requireAuth`, but also rejects anyone who isn't `platform_admin`. */
export async function requireSuperAdmin(req: Request): Promise<AuthContext> {
  const auth = await requireAuth(req)
  if (auth.user.role !== PLATFORM_ADMIN_ROLE)
    throw new ForbiddenError("Accès réservé aux administrateurs.")
  return auth
}
