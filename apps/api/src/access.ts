/**
 * Single authorization gateway, shared in-process by apps/api (app.ts) and
 * apps/mcp-server (server.ts imports apps/api's compiled output directly —
 * see apps/mcp-server/src/token-auth.ts — there is no HTTP hop between the
 * two). Every workspace/organization access check in the codebase goes
 * through resolveActiveContext/assertOrgAccess/assertWorkspaceAccess; nothing
 * else queries organization_members directly for authorization decisions.
 *
 * Two-level error convention (see .claude/rules/api.md):
 *   - NotFoundError (404): no membership row for this org (or the org/
 *     workspace id doesn't exist) — deliberately disguises "not a member" as
 *     "not found" to avoid leaking existence to non-members.
 *   - ForbiddenError (403): the caller IS a recognized member, but their role
 *     is insufficient for the requested intent, or the organization is
 *     suspended — existence and membership are already established, so 404
 *     would be misleading.
 *
 * platform_admin is structurally rejected by every function here — it always
 * gets NotFoundError, regardless of any organization_members row that may
 * exist for that user. Organization data is never visible to the platform
 * role; this isolation is enforced once, here, rather than left to be
 * remembered at every call site.
 */

import { and, asc, eq } from "drizzle-orm"
import {
  db,
  organizations,
  organizationMembers,
  userActiveOrganization,
  userActiveWorkspace,
  workspaces,
} from "@workspace/db"
import { NotFoundError, ForbiddenError } from "./errors.js"
import type { AuthRequest } from "./auth.js"

export type OrgRoleName = "owner" | "admin" | "member"
export type Intent = "read" | "write" | "manage_members"

const PLATFORM_ADMIN_ROLE = "platform_admin"

/** The subset of `req.user` every access check needs. */
export interface AccessUser {
  id: string
  role: string
}

/** Mirrors `AuthRequest.tokenContext` (auth.ts) — an API token's pinned scope. */
export interface TokenContext {
  organizationId: number
  workspaceId: number | null
}

export interface ActiveContext {
  organizationId: number
  workspaceId: number
  orgRole: OrgRoleName
}

function roleSatisfies(role: OrgRoleName, intent: Intent): boolean {
  if (intent === "read") return true
  if (intent === "manage_members") return role === "owner"
  return role === "owner" || role === "admin" // write
}

/**
 * Verifies `user` belongs to `organizationId` with a role sufficient for
 * `intent`, and that the organization isn't suspended. Returns the caller's
 * role on success.
 */
export async function assertOrgAccess(
  user: AccessUser,
  organizationId: number,
  intent: Intent
): Promise<OrgRoleName> {
  if (user.role === PLATFORM_ADMIN_ROLE)
    throw new NotFoundError("Organisation introuvable.")

  const [org] = await db
    .select({ enabled: organizations.enabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, user.id)
      )
    )
  if (!membership) throw new NotFoundError("Organisation introuvable.")

  const role = membership.role as OrgRoleName
  if (!org.enabled) throw new ForbiddenError("Organisation suspendue.")
  if (!roleSatisfies(role, intent))
    throw new ForbiddenError("Rôle insuffisant pour cette action.")

  return role
}

/**
 * Resolves the organization a user is currently "in": their persisted
 * user_active_organization if they're still a member of it, otherwise the
 * smallest organizationId they belong to (persisted as the new active one).
 * Throws NotFoundError if the user belongs to no organization at all.
 */
export async function resolveActiveOrganizationId(
  userId: string
): Promise<number> {
  const memberships = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.organizationId))
  if (memberships.length === 0)
    throw new NotFoundError("Aucune organisation disponible.")
  const memberOf = new Set(memberships.map((m) => m.organizationId))

  const [active] = await db
    .select({ organizationId: userActiveOrganization.organizationId })
    .from(userActiveOrganization)
    .where(eq(userActiveOrganization.userId, userId))
  if (active && memberOf.has(active.organizationId))
    return active.organizationId

  const fallback = memberships[0]!.organizationId
  await db
    .insert(userActiveOrganization)
    .values({ userId, organizationId: fallback })
    .onConflictDoUpdate({
      target: userActiveOrganization.userId,
      set: { organizationId: fallback },
    })
  return fallback
}

/**
 * Resolves the active workspace for `userId` within `organizationId`: their
 * persisted user_active_workspace for this org if it still belongs to it,
 * otherwise the smallest workspaceId in the org (persisted as the new
 * active one). Throws NotFoundError if the organization has no workspace.
 */
export async function resolveActiveWorkspaceId(
  userId: string,
  organizationId: number
): Promise<number> {
  const orgWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId))
    .orderBy(asc(workspaces.id))
  if (orgWorkspaces.length === 0)
    throw new NotFoundError("Aucun workspace disponible.")
  const inOrg = new Set(orgWorkspaces.map((w) => w.id))

  const [active] = await db
    .select({ workspaceId: userActiveWorkspace.workspaceId })
    .from(userActiveWorkspace)
    .where(
      and(
        eq(userActiveWorkspace.userId, userId),
        eq(userActiveWorkspace.organizationId, organizationId)
      )
    )
  if (active && inOrg.has(active.workspaceId)) return active.workspaceId

  const fallback = orgWorkspaces[0]!.id
  await db
    .insert(userActiveWorkspace)
    .values({ userId, organizationId, workspaceId: fallback })
    .onConflictDoUpdate({
      target: [userActiveWorkspace.userId, userActiveWorkspace.organizationId],
      set: { workspaceId: fallback },
    })
  return fallback
}

/**
 * Verifies `user` may act on `workspaceId` with the given `intent`. Looks up
 * the workspace's organization and delegates to assertOrgAccess.
 */
export async function assertWorkspaceAccess(
  user: AccessUser,
  workspaceId: number,
  intent: Intent
): Promise<ActiveContext> {
  const [ws] = await db
    .select({ organizationId: workspaces.organizationId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  // organizationId is only nullable during the expand→backfill migration
  // window (see packages/db/src/schema.ts) — the backfill runs before the
  // app ever serves traffic, so every row the app can see has one.
  if (!ws || ws.organizationId === null)
    throw new NotFoundError("Workspace introuvable.")

  const orgRole = await assertOrgAccess(user, ws.organizationId, intent)
  return { organizationId: ws.organizationId, workspaceId, orgRole }
}

/**
 * Resolves the full active context (organization + workspace + role) for a
 * request. When `tokenContext` is present (personal API token request), its
 * pinned organization/workspace take priority over the user's interactively
 * active selection — see Phase 5 (packages/db api_tokens.organization_id).
 */
export async function resolveActiveContext(
  user: AccessUser,
  intent: Intent,
  tokenContext?: TokenContext | null
): Promise<ActiveContext> {
  if (tokenContext) {
    const orgRole = await assertOrgAccess(
      user,
      tokenContext.organizationId,
      intent
    )
    if (tokenContext.workspaceId !== null) {
      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.id, tokenContext.workspaceId),
            eq(workspaces.organizationId, tokenContext.organizationId)
          )
        )
      if (!ws) throw new NotFoundError("Workspace introuvable.")
      return {
        organizationId: tokenContext.organizationId,
        workspaceId: ws.id,
        orgRole,
      }
    }
    const workspaceId = await resolveActiveWorkspaceId(
      user.id,
      tokenContext.organizationId
    )
    return { organizationId: tokenContext.organizationId, workspaceId, orgRole }
  }

  const { organizationId, orgRole } = await resolveActiveOrganization(
    user,
    intent
  )
  const workspaceId = await resolveActiveWorkspaceId(user.id, organizationId)
  return { organizationId, workspaceId, orgRole }
}

/**
 * Resolves the user's active organization (see resolveActiveOrganizationId)
 * and asserts their role is sufficient for `intent` — without requiring the
 * organization to already have a workspace. Used by registry.ts to list/
 * create workspaces, where an empty organization is a valid state.
 */
export async function resolveActiveOrganization(
  user: AccessUser,
  intent: Intent
): Promise<{ organizationId: number; orgRole: OrgRoleName }> {
  if (user.role === PLATFORM_ADMIN_ROLE)
    throw new NotFoundError("Aucune organisation disponible.")
  const organizationId = await resolveActiveOrganizationId(user.id)
  const orgRole = await assertOrgAccess(user, organizationId, intent)
  return { organizationId, orgRole }
}

/**
 * Convenience wrapper for apps/api route handlers: resolves just the active
 * workspace id for this request, honouring a pinned API token scope. Mirrors
 * the old `getActiveWorkspaceId(userId)` call shape so route handlers only
 * need to add an `intent` argument.
 */
export async function activeWorkspaceId(
  req: AuthRequest,
  intent: Intent
): Promise<number> {
  const ctx = await resolveActiveContext(
    { id: req.user!.id, role: req.user!.role },
    intent,
    req.tokenContext ?? null
  )
  return ctx.workspaceId
}
