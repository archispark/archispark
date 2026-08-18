/**
 * platform_admin-only local-account administration — role and enabled status
 * for accounts in the local `users` table (packages/db). Keycloak-managed
 * accounts aren't listed here: the Admin API (packages/auth/src/admin-users.ts)
 * has no realm-wide user listing or role-unassignment helper yet.
 */

import { randomUUID } from "crypto"
import { and, asc, eq, ne } from "drizzle-orm"
import { db, users, organizations, organizationMembers } from "@workspace/db"
import { hashPassword } from "@workspace/auth"
import { NotFoundError, ValidationError } from "./errors"
import { revokeAllRefreshTokens } from "./local-auth-tokens"

const UNIQUE_VIOLATION = "23505"

// Drizzle wraps the raw pg error in a DrizzleQueryError, with the pg error
// (and its `.code`) as `.cause` — check both shapes.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION
}

export interface PlatformUserOut {
  id: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  role: string
  enabled: boolean
  must_change_password: boolean
  created_at: number
  last_login_at: number | null
}

export interface PlatformUserUpdateIn {
  role?: string
  enabled?: boolean
  first_name?: string | null
  last_name?: string | null
  email?: string
  password?: string
}

export interface PlatformUserOrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  role: string
}

export interface PlatformUserDetailOut extends PlatformUserOut {
  organizations: PlatformUserOrganizationOut[]
}

function toPlatformUserOut(user: typeof users.$inferSelect): PlatformUserOut {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    display_name: user.displayName,
    role: user.role,
    enabled: user.enabled,
    must_change_password: user.mustChangePassword,
    created_at: user.createdAt,
    last_login_at: user.lastLoginAt,
  }
}

export async function listAllUsers(): Promise<PlatformUserOut[]> {
  const rows = await db.select().from(users).orderBy(asc(users.username))
  return rows.map(toPlatformUserOut)
}

export interface PlatformUserCreateIn {
  username: string
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
  role?: string
}

/**
 * Creates a local account from the admin console. mustChangePassword is
 * forced, same as an admin-set password on an existing account
 * (updatePlatformUser) — the admin picks the initial password, not the user.
 */
export async function createPlatformUser(
  input: PlatformUserCreateIn
): Promise<PlatformUserOut> {
  const username = input.username.trim().toLowerCase()
  const email = input.email.trim().toLowerCase()
  const firstName = input.first_name?.trim() || null
  const lastName = input.last_name?.trim() || null
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null

  try {
    const [inserted] = await db
      .insert(users)
      .values({
        id: `local:${randomUUID()}`,
        username,
        email,
        passwordHash: await hashPassword(input.password),
        firstName,
        lastName,
        displayName,
        role: input.role ?? "user",
        mustChangePassword: true,
      })
      .returning()
    return toPlatformUserOut(inserted!)
  } catch (err) {
    if (isUniqueViolation(err))
      throw new ValidationError(
        "Ce nom d'utilisateur ou cette adresse e-mail est déjà utilisé."
      )
    throw err
  }
}

export async function getPlatformUser(
  userId: string
): Promise<PlatformUserDetailOut> {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new NotFoundError("Utilisateur introuvable.")

  const memberships = await db
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizations.name))

  return {
    ...toPlatformUserOut(user),
    organizations: memberships.map(({ org, role }) => ({
      id: String(org.id),
      slug: org.slug,
      name: org.name,
      is_personal: org.isPersonal,
      enabled: org.enabled,
      role,
    })),
  }
}

async function countOtherEnabledPlatformAdmins(
  excludingUserId: string
): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "platform_admin"),
        eq(users.enabled, true),
        ne(users.id, excludingUserId)
      )
    )
  return rows.length
}

export async function updatePlatformUser(
  targetUserId: string,
  changes: PlatformUserUpdateIn
): Promise<PlatformUserOut> {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
  if (!target) throw new NotFoundError("Utilisateur introuvable.")

  const nextRole = changes.role ?? target.role
  const nextEnabled = changes.enabled ?? target.enabled
  const wasActiveAdmin = target.role === "platform_admin" && target.enabled
  const staysActiveAdmin = nextRole === "platform_admin" && nextEnabled

  if (
    wasActiveAdmin &&
    !staysActiveAdmin &&
    (await countOtherEnabledPlatformAdmins(targetUserId)) === 0
  ) {
    throw new ValidationError(
      "Impossible de retirer le dernier administrateur plateforme actif."
    )
  }

  const nextFirstName =
    changes.first_name !== undefined ? changes.first_name : target.firstName
  const nextLastName =
    changes.last_name !== undefined ? changes.last_name : target.lastName
  const nextDisplayName =
    [nextFirstName, nextLastName].filter(Boolean).join(" ") || null

  const emailChanged =
    changes.email !== undefined && changes.email.toLowerCase() !== target.email
  const nextEmail = emailChanged ? changes.email!.toLowerCase() : target.email

  try {
    const [updated] = await db
      .update(users)
      .set({
        role: nextRole,
        enabled: nextEnabled,
        firstName: nextFirstName,
        lastName: nextLastName,
        displayName: nextDisplayName,
        email: nextEmail,
        emailVerified: emailChanged ? false : target.emailVerified,
        ...(changes.password
          ? { passwordHash: await hashPassword(changes.password) }
          : {}),
        // A new password is set by an admin on the target's behalf — force a
        // change at next login and end their other sessions, same as a
        // self-service password change (see change-password/route.ts).
        ...(changes.password ? { mustChangePassword: true } : {}),
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(users.id, targetUserId))
      .returning()

    if (changes.password) await revokeAllRefreshTokens(targetUserId)

    return toPlatformUserOut(updated!)
  } catch (err) {
    if (isUniqueViolation(err))
      throw new ValidationError("Cette adresse e-mail est déjà utilisée.")
    throw err
  }
}
