/**
 * Single authorization gateway, shared in-process by the REST route handlers
 * (app/api/**) and the MCP tools (lib/mcp/create-mcp-server.ts). Every
 * workspace/organization access check in the codebase goes through
 * resolveActiveContext/assertOrgAccess/assertWorkspaceAccess; nothing else
 * queries organization_members directly for authorization decisions.
 *
 * Two-level error convention:
 *   - NotFoundError (404): no membership row for this org (or the org/
 *     workspace id doesn't exist) — deliberately disguises "not a member" as
 *     "not found" to avoid leaking existence to non-members.
 *   - ForbiddenError (403): the caller IS a recognized member, but their role
 *     is insufficient for the requested intent, or the organization is
 *     suspended — existence and membership are already established, so 404
 *     would be misleading.
 *
 * platform_admin gets full owner-equivalent access to every organization's
 * content — including suspended ones — without ever needing an
 * organization_members row: assertOrgAccess grants it a synthetic "owner"
 * role before organization_members is even queried. Because platform_admin
 * has no natural "home" organization, resolveActiveOrganization does not
 * fall back the way it does for regular members; it requires the caller to
 * have "entered" an organization first (admin mode — see
 * resolveActivePlatformOrganizationId/setActivePlatformOrganization/
 * clearActivePlatformOrganization below, and platform-context-store.ts for
 * the routes that drive them). A platform_admin is entered into the
 * smallest existing organization automatically on login (see
 * ensureDefaultPlatformOrganization in platform-context-store.ts, called
 * from the login routes) so it has default access without a manual step,
 * while "exit" (DELETE /api/platform/organizations/active) still leaves it
 * with none until it next logs in or explicitly enters one. Once entered,
 * every function in this file (assertWorkspaceAccess, resolveActiveContext,
 * activeWorkspaceId, ...) works for platform_admin exactly as it does for a
 * regular owner, with no per-function change needed — the bypass is
 * centralized in assertOrgAccess alone.
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
import { NotFoundError, ForbiddenError } from "./errors"

export type OrgRoleName = "owner" | "editor" | "viewer"
export type Intent = "read" | "write" | "manage_members"

const PLATFORM_ADMIN_ROLE = "platform_admin"
// Synthetic role granted to platform_admin for any organization it accesses
// — always satisfies every intent, never persisted to organization_members,
// never read from it either.
const PLATFORM_ADMIN_EFFECTIVE_ROLE: OrgRoleName = "owner"

/** The subset of the authenticated user every access check needs. */
export interface AccessUser {
  id: string
  role: string
}

/** The full resolved identity — returned by auth.ts's requireAuth. */
export interface AuthUser extends AccessUser {
  username: string
  email?: string
  emailVerified?: boolean
  /** Local accounts only (see local-auth-tokens.ts) — true blocks every page but /change-password (proxy.ts). */
  mustChangePassword?: boolean
}

/** An API token's pinned scope (set by auth.ts's requireAuth for Bearer-token requests). */
export interface TokenContext {
  organizationId: number
  workspaceId: number | null
}

/** Resolved identity for a request — returned by auth.ts's requireAuth. */
export interface AuthContext {
  user: AuthUser
  tokenContext: TokenContext | null
}

export interface ActiveContext {
  organizationId: number
  workspaceId: number
  orgRole: OrgRoleName
}

function roleSatisfies(role: OrgRoleName, intent: Intent): boolean {
  if (intent === "read") return true
  if (intent === "manage_members") return role === "owner"
  return role === "owner" || role === "editor" // write
}

/**
 * Verifies `user` belongs to `organizationId` with a role sufficient for
 * `intent`, and that the organization isn't suspended. Returns the caller's
 * role on success.
 *
 * platform_admin is granted PLATFORM_ADMIN_EFFECTIVE_ROLE unconditionally —
 * before organization_members is queried and without checking `enabled` —
 * so it always succeeds for any organization that exists, suspended or not,
 * regardless of any real membership row for that user.
 */
export async function assertOrgAccess(
  user: AccessUser,
  organizationId: number,
  intent: Intent
): Promise<OrgRoleName> {
  const [org] = await db
    .select({ enabled: organizations.enabled })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")

  if (user.role === PLATFORM_ADMIN_ROLE) {
    // Minimal structured trace of every platform_admin content access —
    // this is the single choke point all such access passes through.
    console.info(
      JSON.stringify({
        event: "platform_admin_org_access",
        userId: user.id,
        organizationId,
        intent,
        at: Date.now(),
      })
    )
    return PLATFORM_ADMIN_EFFECTIVE_ROLE
  }

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
 * Resolves the organization a platform_admin is currently administering.
 * Unlike resolveActiveOrganizationId, there is no membership-based fallback
 * — a platform_admin has no natural "home" organization, and silently
 * landing them in an arbitrary tenant would be a hazard, not a convenience.
 * Requires a prior "enter" action — either explicit
 * (setActivePlatformOrganization via platform-context-store.ts's
 * enterOrganizationAsPlatformAdmin) or the default one performed at login
 * (ensureDefaultPlatformOrganization, also in platform-context-store.ts).
 */
export async function resolveActivePlatformOrganizationId(
  userId: string
): Promise<number> {
  const [active] = await db
    .select({ organizationId: userActiveOrganization.organizationId })
    .from(userActiveOrganization)
    .where(eq(userActiveOrganization.userId, userId))
  if (!active)
    throw new NotFoundError(
      "Aucune organisation sélectionnée en mode administration."
    )
  return active.organizationId
}

/**
 * Persists which organization a platform_admin is administering ("enter") —
 * see resolveActivePlatformOrganizationId. Shares user_active_organization
 * with regular members' active-organization pointer; the two meanings never
 * overlap because a user's role (regular user vs platform_admin) is fixed
 * and exclusive.
 */
export async function setActivePlatformOrganization(
  userId: string,
  organizationId: number
): Promise<void> {
  await db
    .insert(userActiveOrganization)
    .values({ userId, organizationId })
    .onConflictDoUpdate({
      target: userActiveOrganization.userId,
      set: { organizationId },
    })
}

/** Clears a platform_admin's administered-organization pointer ("exit"). */
export async function clearActivePlatformOrganization(
  userId: string
): Promise<void> {
  await db
    .delete(userActiveOrganization)
    .where(eq(userActiveOrganization.userId, userId))
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
 *
 * For platform_admin, "active organization" means the one entered via admin
 * mode (see resolveActivePlatformOrganizationId) — no membership fallback,
 * but login (ensureDefaultPlatformOrganization) enters one by default.
 */
export async function resolveActiveOrganization(
  user: AccessUser,
  intent: Intent
): Promise<{ organizationId: number; orgRole: OrgRoleName }> {
  const organizationId =
    user.role === PLATFORM_ADMIN_ROLE
      ? await resolveActivePlatformOrganizationId(user.id)
      : await resolveActiveOrganizationId(user.id)
  const orgRole = await assertOrgAccess(user, organizationId, intent)
  return { organizationId, orgRole }
}

/**
 * Convenience wrapper for route handlers: resolves just the active workspace
 * id for this request, honouring a pinned API token scope.
 */
export async function activeWorkspaceId(
  auth: AuthContext,
  intent: Intent
): Promise<number> {
  const ctx = await resolveActiveContext(auth.user, intent, auth.tokenContext)
  return ctx.workspaceId
}
