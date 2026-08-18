/**
 * Organization CRUD, gated exclusively through access.ts (assertOrgAccess)
 * — for the NotFoundError vs ForbiddenError convention. Split out of
 * registry.ts, then further split into organization-members-store.ts, to
 * keep every file under the ESLint max-lines limit.
 */

import { asc, eq } from "drizzle-orm"
import {
  db,
  organizations,
  organizationMembers,
  userActiveOrganization,
} from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors"
import {
  assertOrgAccess,
  resolveActiveWorkspaceId,
  type AccessUser,
  type OrgRoleName,
} from "./access"

export interface OrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  role: OrgRoleName
  active: boolean
}

function toOrgOut(
  org: typeof organizations.$inferSelect,
  role: OrgRoleName,
  activeId: number | null
): OrganizationOut {
  return {
    id: String(org.id),
    slug: org.slug,
    name: org.name,
    is_personal: org.isPersonal,
    enabled: org.enabled,
    role,
    active: org.id === activeId,
  }
}

async function getActiveOrganizationId(userId: string): Promise<number | null> {
  const [active] = await db
    .select({ organizationId: userActiveOrganization.organizationId })
    .from(userActiveOrganization)
    .where(eq(userActiveOrganization.userId, userId))
  return active?.organizationId ?? null
}

export async function listOrganizationsForUser(
  user: AccessUser
): Promise<OrganizationOut[]> {
  const rows = await db
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .where(eq(organizationMembers.userId, user.id))
    .orderBy(asc(organizations.id))
  if (rows.length === 0) return []

  const activeId = await getActiveOrganizationId(user.id)
  const memberOf = new Set(rows.map((r) => r.org.id))
  const resolvedActiveId =
    activeId !== null && memberOf.has(activeId) ? activeId : rows[0]!.org.id

  return rows.map((r) =>
    toOrgOut(r.org, r.role as OrgRoleName, resolvedActiveId)
  )
}

/** owner-only. Renaming is an organization-level action, not a workspace one — editor's write rights don't extend to it. */
export async function renameOrganization(
  user: AccessUser,
  organizationId: number,
  name: string
): Promise<OrganizationOut> {
  if (!name?.trim())
    throw new ValidationError("Le nom de l'organisation est requis.")
  const role = await assertOrgAccess(user, organizationId, "manage_members")

  const [org] = await db
    .update(organizations)
    .set({ name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(organizations.id, organizationId))
    .returning()
  if (!org) throw new NotFoundError("Organisation introuvable.")

  const activeId = await getActiveOrganizationId(user.id)
  return toOrgOut(org, role, activeId)
}

export async function activateOrganization(
  user: AccessUser,
  organizationId: number
): Promise<OrganizationOut> {
  const role = await assertOrgAccess(user, organizationId, "read")
  await db
    .insert(userActiveOrganization)
    .values({ userId: user.id, organizationId })
    .onConflictDoUpdate({
      target: userActiveOrganization.userId,
      set: { organizationId },
    })
  // Best-effort: pre-resolve an active workspace for a smoother next request.
  // A brand new organization legitimately has none yet — that's fine, it
  // resolves lazily on the next request that actually needs a workspace.
  try {
    await resolveActiveWorkspaceId(user.id, organizationId)
  } catch {
    /* no workspace yet */
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")
  return toOrgOut(org, role, organizationId)
}
