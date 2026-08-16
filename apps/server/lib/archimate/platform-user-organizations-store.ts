/**
 * platform_admin-only — add/remove a local account's organization
 * memberships from the user detail page (app/platform/users/[id]). Distinct
 * from organizations-store.ts's addMember/removeMember, which are gated by
 * assertOrgAccess (an org owner acting within their own org) and resolve
 * usernames through Keycloak — neither applies to a platform_admin managing
 * an arbitrary local account from outside any organization.
 */

import { and, eq } from "drizzle-orm"
import { db, users, organizations, organizationMembers } from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors"
import { type PlatformUserOrganizationOut } from "./platform-users-store"

const VALID_ROLES = ["owner", "editor", "viewer"]

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

function toMembershipOut(
  org: typeof organizations.$inferSelect,
  role: string
): PlatformUserOrganizationOut {
  return {
    id: String(org.id),
    slug: org.slug,
    name: org.name,
    is_personal: org.isPersonal,
    enabled: org.enabled,
    role,
  }
}

export async function addUserToOrganization(
  userId: string,
  organizationId: number,
  role: string
): Promise<PlatformUserOrganizationOut> {
  if (!VALID_ROLES.includes(role)) throw new ValidationError("Rôle invalide.")

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new NotFoundError("Utilisateur introuvable.")

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")

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
  return toMembershipOut(org, inserted!.role)
}

export async function removeUserFromOrganization(
  userId: string,
  organizationId: number
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
