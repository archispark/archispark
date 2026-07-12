/**
 * Auth middleware — verifies a Keycloak access token (Bearer or `access_token`
 * cookie) via JWKS, or a personal `apiTokens` Bearer token.
 */

import type { Request, Response, NextFunction } from "express"
import { eq } from "drizzle-orm"
import { db, apiTokens } from "@workspace/db"
import {
  verifyAccessToken,
  type KeycloakClaims,
  getKeycloakUser,
  getUserRealmRoles,
} from "@workspace/auth"

const PLATFORM_ADMIN_ROLE = "platform_admin"

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string }
  /** Set by requireAuth for Bearer-token requests (api_tokens row). */
  tokenContext?: { organizationId: number; workspaceId: number | null }
}

export interface TokenUser {
  id: string
  username: string
  role: string
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
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
  }

  db.update(apiTokens)
    .set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {})
  return result
}

/** Builds `req.user` from a verified Keycloak access token's claims. */
function resolveKeycloakUser(claims: KeycloakClaims): {
  id: string
  username: string
  role: string
} {
  return {
    id: claims.sub,
    username: claims.preferred_username ?? claims.sub,
    role: claims.realm_access?.roles?.includes("platform_admin")
      ? "platform_admin"
      : "user",
  }
}

/** Reads a single cookie value from a raw `Cookie` request header. */
function getCookieValue(
  cookieHeader: string | undefined,
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

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"]
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    lookupApiToken(token)
      .then(async (tokenUser) => {
        if (tokenUser) {
          req.user = {
            id: tokenUser.id,
            username: tokenUser.username,
            role: tokenUser.role,
          }
          req.tokenContext = {
            organizationId: tokenUser.organizationId,
            workspaceId: tokenUser.workspaceId,
          }
          next()
          return
        }
        // Not a personal API token — try a Keycloak-issued access token.
        const claims = await verifyAccessToken(token)
        if (!claims) {
          res.status(401).json({ detail: "Token invalide." })
          return
        }
        req.user = resolveKeycloakUser(claims)
        next()
      })
      .catch(() => {
        res.status(401).json({ detail: "Erreur d'authentification." })
      })
    return
  }

  const cookieToken = getCookieValue(req.headers["cookie"], "access_token")
  if (!cookieToken) {
    res.status(401).json({ detail: "Non authentifié." })
    return
  }
  verifyAccessToken(cookieToken)
    .then((claims) => {
      if (!claims) {
        res.status(401).json({ detail: "Session invalide." })
        return
      }
      req.user = resolveKeycloakUser(claims)
      next()
    })
    .catch(() => {
      res.status(401).json({ detail: "Session invalide." })
    })
}

export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "platform_admin") {
      res.status(403).json({ detail: "Accès réservé aux administrateurs." })
      return
    }
    next()
  })
}
