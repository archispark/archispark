/**
 * Organization + member CRUD, gated exclusively through access.ts
 * (assertOrgAccess) — see .claude/rules/api.md for the NotFoundError vs
 * ForbiddenError convention. Split out of registry.ts to keep it under the
 * ESLint max-lines limit.
 */

import { and, asc, eq } from "drizzle-orm"
import {
  db,
  organizations,
  organizationMembers,
  userActiveOrganization,
} from "@workspace/db"
import { findUserByUsername, getKeycloakUser } from "@workspace/auth"
import { NotFoundError, ValidationError } from "./errors.js"
import {
  assertOrgAccess,
  resolveActiveWorkspaceId,
  type AccessUser,
  type OrgRoleName,
} from "./access.js"

export interface OrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  role: OrgRoleName
  active: boolean
}

export interface MemberOut {
  user_id: string
  username: string
  role: OrgRoleName
  created_at: number
}

const VALID_ROLES: OrgRoleName[] = ["owner", "admin", "member"]

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

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "org"
  let slug = base
  let suffix = 2
  while (true) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
    if (!existing) return slug
    slug = `${base}-${suffix++}`
  }
}

async function countOwners(organizationId: number): Promise<number> {
  const owners = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner")
      )
    )
  return owners.length
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

/** platform_admin has no organization membership by design — returns []. */
export async function listOrganizationsForUser(
  user: AccessUser
): Promise<OrganizationOut[]> {
  if (user.role === "platform_admin") return []

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

/** Creating a "team" organization is free for any authenticated, non-platform-admin user. */
export async function createOrganization(
  user: AccessUser,
  name: string
): Promise<OrganizationOut> {
  if (user.role === "platform_admin")
    throw new NotFoundError("Organisation introuvable.")
  if (!name?.trim())
    throw new ValidationError("Le nom de l'organisation est requis.")

  const slug = await uniqueSlug(name)
  const [org] = await db
    .insert(organizations)
    .values({ slug, name: name.trim(), isPersonal: false })
    .returning()
  if (!org) throw new Error("Failed to create organization")
  await db
    .insert(organizationMembers)
    .values({ organizationId: org.id, userId: user.id, role: "owner" })

  const activeId = await getActiveOrganizationId(user.id)
  return toOrgOut(org, "owner", activeId)
}

export async function renameOrganization(
  user: AccessUser,
  organizationId: number,
  name: string
): Promise<OrganizationOut> {
  if (!name?.trim())
    throw new ValidationError("Le nom de l'organisation est requis.")
  const role = await assertOrgAccess(user, organizationId, "write")

  const [org] = await db
    .update(organizations)
    .set({ name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(organizations.id, organizationId))
    .returning()
  if (!org) throw new NotFoundError("Organisation introuvable.")

  const activeId = await getActiveOrganizationId(user.id)
  return toOrgOut(org, role, activeId)
}

/** owner-only: reuses the "manage_members" intent, which assertOrgAccess restricts to owner. */
export async function deleteOrganization(
  user: AccessUser,
  organizationId: number
): Promise<void> {
  await assertOrgAccess(user, organizationId, "manage_members")
  await db.delete(organizations).where(eq(organizations.id, organizationId))
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

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(
  user: AccessUser,
  organizationId: number
): Promise<MemberOut[]> {
  await assertOrgAccess(user, organizationId, "read")
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(organizationMembers.id))

  return Promise.all(
    rows.map(async (m) => {
      const kcUser = await getKeycloakUser(m.userId)
      return {
        user_id: m.userId,
        username: kcUser?.username ?? m.userId,
        role: m.role as OrgRoleName,
        created_at: m.createdAt,
      }
    })
  )
}

/** owner-only. Requires an existing Keycloak user — to invite someone without one yet, see invitations-store.ts. */
export async function addMember(
  user: AccessUser,
  organizationId: number,
  username: string,
  role: string
): Promise<MemberOut> {
  await assertOrgAccess(user, organizationId, "manage_members")
  if (!VALID_ROLES.includes(role as OrgRoleName))
    throw new ValidationError("Rôle invalide.")

  const kcUser = await findUserByUsername(username)
  if (!kcUser?.id)
    throw new ValidationError(`Utilisateur '${username}' introuvable.`)

  const [existing] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, kcUser.id)
      )
    )
  if (existing)
    throw new ValidationError(
      `'${username}' est déjà membre de cette organisation.`
    )

  const [inserted] = await db
    .insert(organizationMembers)
    .values({ organizationId, userId: kcUser.id, role })
    .returning()
  return {
    user_id: kcUser.id,
    username: kcUser.username,
    role: inserted!.role as OrgRoleName,
    created_at: inserted!.createdAt,
  }
}

/** owner-only. Refuses to demote the last remaining owner (Phase 4 invariant). */
export async function updateMemberRole(
  user: AccessUser,
  organizationId: number,
  targetUserId: string,
  role: string
): Promise<MemberOut> {
  await assertOrgAccess(user, organizationId, "manage_members")
  if (!VALID_ROLES.includes(role as OrgRoleName))
    throw new ValidationError("Rôle invalide.")

  const [target] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUserId)
      )
    )
  if (!target) throw new NotFoundError("Membre introuvable.")

  if (
    target.role === "owner" &&
    role !== "owner" &&
    (await countOwners(organizationId)) <= 1
  ) {
    throw new ValidationError(
      "Impossible de rétrograder le dernier propriétaire de l'organisation."
    )
  }

  const [updated] = await db
    .update(organizationMembers)
    .set({ role })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUserId)
      )
    )
    .returning()
  const kcUser = await getKeycloakUser(targetUserId)
  return {
    user_id: targetUserId,
    username: kcUser?.username ?? targetUserId,
    role: updated!.role as OrgRoleName,
    created_at: updated!.createdAt,
  }
}

/** owner-only, including self-removal. Refuses to remove the last remaining owner. */
export async function removeMember(
  user: AccessUser,
  organizationId: number,
  targetUserId: string
): Promise<void> {
  await assertOrgAccess(user, organizationId, "manage_members")

  const [target] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUserId)
      )
    )
  if (!target) throw new NotFoundError("Membre introuvable.")

  if (target.role === "owner" && (await countOwners(organizationId)) <= 1) {
    throw new ValidationError(
      "Impossible de retirer le dernier propriétaire de l'organisation."
    )
  }

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, targetUserId)
      )
    )
}
