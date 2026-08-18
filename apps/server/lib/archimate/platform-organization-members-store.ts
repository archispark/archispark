/**
 * platform_admin-only — list/add/remove an organization's members from the
 * organization detail page (app/platform/organizations/[id]). Mirrors
 * platform-user-organizations-store.ts's direction (user -> org) but goes
 * org -> user and returns member-shaped output; neither reuses
 * organizations-store.ts's addMember/removeMember, which are gated by
 * assertOrgAccess (an org owner acting within their own org) rather than a
 * platform_admin managing an arbitrary organization from outside it.
 */

import { and, asc, eq } from "drizzle-orm"
import { db, users, organizations, organizationMembers } from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors"

const VALID_ROLES = ["owner", "editor", "viewer"]

export interface PlatformOrganizationMemberOut {
  id: string
  username: string
  email: string
  display_name: string | null
  role: string
}

function toMemberOut(
  user: typeof users.$inferSelect,
  role: string
): PlatformOrganizationMemberOut {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    display_name: user.displayName,
    role,
  }
}

export async function listOrganizationMembers(
  organizationId: number
): Promise<PlatformOrganizationMemberOut[]> {
  const rows = await db
    .select({ user: users, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(users.username))
  return rows.map(({ user, role }) => toMemberOut(user, role))
}

async function countOwners(organizationId: number): Promise<number> {
  const rows = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner")
      )
    )
  return rows.length
}

export async function addOrganizationMember(
  organizationId: number,
  userId: string,
  role: string
): Promise<PlatformOrganizationMemberOut> {
  if (!VALID_ROLES.includes(role)) throw new ValidationError("Rôle invalide.")

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new NotFoundError("Utilisateur introuvable.")

  const [existing] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
  if (existing)
    throw new ValidationError(
      "Cet utilisateur est déjà membre de cette organisation."
    )

  const [inserted] = await db
    .insert(organizationMembers)
    .values({ organizationId, userId, role })
    .returning()
  return toMemberOut(user, inserted!.role)
}

export async function removeOrganizationMember(
  organizationId: number,
  userId: string
): Promise<void> {
  const [target] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
  if (!target) throw new NotFoundError("Adhésion introuvable.")

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
        eq(organizationMembers.userId, userId)
      )
    )
}
