/**
 * Organization member CRUD, gated exclusively through access.ts
 * (assertOrgAccess) — for the NotFoundError vs ForbiddenError convention.
 * Split out of organizations-store.ts to keep both files under the ESLint
 * max-lines limit.
 */

import { and, asc, eq } from "drizzle-orm"
import { db, organizationMembers, users } from "@workspace/db"
import { findUserByUsername, getKeycloakUser } from "@workspace/auth"
import { NotFoundError, ValidationError } from "./errors"
import { assertOrgAccess, type AccessUser, type OrgRoleName } from "./access"

export interface MemberOut {
  user_id: string
  username: string
  role: OrgRoleName
  created_at: number
}

const VALID_ROLES: OrgRoleName[] = ["owner", "editor", "viewer"]

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

/**
 * Local accounts (`local:<uuid>`, the default auth method) don't exist in
 * Keycloak — resolve their username from the local `users` table instead of
 * calling the Keycloak admin API, which would 404/throw for them.
 */
async function resolveUsername(userId: string): Promise<string> {
  if (userId.startsWith("local:")) {
    const [localUser] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
    return localUser?.username ?? userId
  }
  const kcUser = await getKeycloakUser(userId)
  return kcUser?.username ?? userId
}

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
    rows.map(async (m) => ({
      user_id: m.userId,
      username: await resolveUsername(m.userId),
      role: m.role as OrgRoleName,
      created_at: m.createdAt,
    }))
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
  return {
    user_id: targetUserId,
    username: await resolveUsername(targetUserId),
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
