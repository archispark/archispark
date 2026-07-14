/**
 * Organization invitations — email + token, gated through access.ts for
 * everything an already-established member does (create/list/revoke/resend,
 * "manage_members"), but deliberately NOT for the preview/acceptance
 * functions: an invitee isn't a member yet, so there's nothing in
 * organization_members to check. Their guard is authentication (requireAuth,
 * mounted globally — see app.ts) + a valid token + a verified Keycloak email
 * matching the invited address, not assertOrgAccess. See
 * docs/decisions.md for the full rationale.
 */

import { createHash, randomUUID } from "crypto"
import { and, eq, isNull } from "drizzle-orm"
import {
  db,
  organizations,
  organizationInvitations,
  organizationMembers,
} from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors.js"
import { assertOrgAccess, type AccessUser, type OrgRoleName } from "./access.js"
import { sendInvitationEmail, invitationAcceptUrl } from "./mail.js"

const VALID_ROLES: OrgRoleName[] = ["owner", "admin", "member"]
const EXPIRES_IN_SECONDS = 7 * 24 * 3600
// Postgres unique_violation — see org_invitations_org_email_active_uniq
// (packages/db/src/schema.ts), the real guarantee behind the "one active
// invitation per (org, email)" rule; the app-level pre-check below is only
// there to fail fast, not to be the sole guard against a race.
const UNIQUE_VIOLATION = "23505"

export interface InvitationOut {
  id: string
  email: string
  role: OrgRoleName
  created_at: number
  expires_at: number
  sent_at: number | null
  expired: boolean
}

export interface InvitationPreviewOut {
  organization_name: string
  role: OrgRoleName
  email: string
}

export interface AcceptInvitationOut {
  organization_id: string
  role: OrgRoleName
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function generateToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")
}

function toInvitationOut(
  row: typeof organizationInvitations.$inferSelect
): InvitationOut {
  return {
    id: String(row.id),
    email: row.email,
    role: row.role as OrgRoleName,
    created_at: row.createdAt,
    expires_at: row.expiresAt,
    sent_at: row.sentAt,
    expired: row.expiresAt <= now(),
  }
}

// ---------------------------------------------------------------------------
// Owner-only management (member-gated via assertOrgAccess)
// ---------------------------------------------------------------------------

/**
 * Creates an invitation, or replaces the active one for the same (org,
 * email) — this is also how "resend" works, there's no separate code path.
 * Sending the e-mail happens after the transaction commits (SMTP shouldn't
 * hold a DB transaction open); a send failure leaves the row with
 * sent_at = null rather than rolling back the invitation itself.
 */
export async function createOrReplaceInvitation(
  user: AccessUser,
  organizationId: number,
  email: string,
  role: string
): Promise<InvitationOut> {
  await assertOrgAccess(user, organizationId, "manage_members")
  if (!VALID_ROLES.includes(role as OrgRoleName))
    throw new ValidationError("Rôle invalide.")

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) throw new ValidationError("L'e-mail est requis.")

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = now() + EXPIRES_IN_SECONDS

  let inserted: typeof organizationInvitations.$inferSelect | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inserted = await (db as any).transaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (tx: any) => {
        await tx
          .update(organizationInvitations)
          .set({ revokedAt: now() })
          .where(
            and(
              eq(organizationInvitations.organizationId, organizationId),
              eq(organizationInvitations.email, normalizedEmail),
              isNull(organizationInvitations.acceptedAt),
              isNull(organizationInvitations.revokedAt)
            )
          )
        const [row] = await tx
          .insert(organizationInvitations)
          .values({
            organizationId,
            email: normalizedEmail,
            role,
            tokenHash,
            invitedByUserId: user.id,
            expiresAt,
            sentAt: null,
          })
          .returning()
        return row
      }
    )
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new ValidationError(
        "Une invitation est déjà en cours de création pour cet e-mail, réessayez."
      )
    }
    throw err
  }
  if (!inserted) throw new Error("Failed to create invitation")

  try {
    await sendInvitationEmail(
      normalizedEmail,
      org.name,
      invitationAcceptUrl(token)
    )
    const [updated] = await db
      .update(organizationInvitations)
      .set({ sentAt: now() })
      .where(eq(organizationInvitations.id, inserted.id))
      .returning()
    return toInvitationOut(updated ?? inserted)
  } catch (err) {
    console.error(
      `[invitations] failed to send invitation ${inserted.id} to ${normalizedEmail}:`,
      err
    )
    return toInvitationOut(inserted)
  }
}

export async function listInvitations(
  user: AccessUser,
  organizationId: number
): Promise<InvitationOut[]> {
  await assertOrgAccess(user, organizationId, "read")
  const rows = await db
    .select()
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.organizationId, organizationId),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt)
      )
    )
  return rows.map(toInvitationOut)
}

export async function revokeInvitation(
  user: AccessUser,
  organizationId: number,
  invitationId: number
): Promise<void> {
  await assertOrgAccess(user, organizationId, "manage_members")
  const [revoked] = await db
    .update(organizationInvitations)
    .set({ revokedAt: now() })
    .where(
      and(
        eq(organizationInvitations.id, invitationId),
        eq(organizationInvitations.organizationId, organizationId),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt)
      )
    )
    .returning({ id: organizationInvitations.id })
  if (!revoked) throw new NotFoundError("Invitation introuvable.")
}

/**
 * Resend is not a distinct code path — it re-runs the same
 * revoke-and-reissue logic as createOrReplaceInvitation, for the same
 * (email, role) the invitation already had. Covers both "sentAt is null
 * because SMTP failed" and "the invitee lost the e-mail".
 */
export async function resendInvitation(
  user: AccessUser,
  organizationId: number,
  invitationId: number
): Promise<InvitationOut> {
  await assertOrgAccess(user, organizationId, "manage_members")
  const [existing] = await db
    .select()
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.id, invitationId),
        eq(organizationInvitations.organizationId, organizationId),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt)
      )
    )
  if (!existing) throw new NotFoundError("Invitation introuvable.")
  return createOrReplaceInvitation(
    user,
    organizationId,
    existing.email,
    existing.role
  )
}

// ---------------------------------------------------------------------------
// Invitee-facing (token-gated, not access.ts-gated — see module doc)
// ---------------------------------------------------------------------------

async function findByToken(
  token: string
): Promise<typeof organizationInvitations.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(organizationInvitations)
    .where(eq(organizationInvitations.tokenHash, hashToken(token)))
  return row ?? null
}

function assertInvitationUsable(
  row: typeof organizationInvitations.$inferSelect
): void {
  if (row.acceptedAt !== null)
    throw new ValidationError("Cette invitation a déjà été acceptée.")
  if (row.revokedAt !== null)
    throw new ValidationError("Cette invitation a été révoquée.")
  if (row.expiresAt <= now())
    throw new ValidationError("Cette invitation a expiré.")
}

export async function getInvitationPreview(
  token: string
): Promise<InvitationPreviewOut> {
  const row = await findByToken(token)
  if (!row) throw new NotFoundError("Invitation introuvable.")
  assertInvitationUsable(row)

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, row.organizationId))
  if (!org) throw new NotFoundError("Invitation introuvable.")

  return {
    organization_name: org.name,
    role: row.role as OrgRoleName,
    email: row.email,
  }
}

/**
 * Ordered to avoid any need for rollback: read-and-validate the invitation,
 * then check the caller's identity against it, and only once both pass does
 * a single transaction touch the database — see the compare-and-swap
 * UPDATE below, which closes the race window where the invitation gets
 * accepted/revoked/expires between the initial read and this call.
 */
export async function acceptInvitation(
  user: AccessUser & { email?: string; emailVerified?: boolean },
  token: string
): Promise<AcceptInvitationOut> {
  const row = await findByToken(token)
  if (!row) throw new NotFoundError("Invitation introuvable.")
  assertInvitationUsable(row)

  if (user.emailVerified !== true)
    throw new ValidationError(
      "Veuillez vérifier votre adresse e-mail avant d'accepter cette invitation."
    )
  if (user.email?.toLowerCase() !== row.email)
    throw new ValidationError(
      "Cette invitation est associée à une autre adresse e-mail."
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = await (db as any).transaction(async (tx: any) => {
    const [claimed] = await tx
      .update(organizationInvitations)
      .set({ acceptedAt: now() })
      .where(
        and(
          eq(organizationInvitations.id, row.id),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt)
        )
      )
      .returning()
    if (!claimed)
      throw new ValidationError(
        "Cette invitation vient d'être acceptée, révoquée ou a expiré."
      )

    const [inserted] = await tx
      .insert(organizationMembers)
      .values({
        organizationId: claimed.organizationId,
        userId: user.id,
        role: claimed.role,
      })
      .onConflictDoNothing({
        target: [
          organizationMembers.organizationId,
          organizationMembers.userId,
        ],
      })
      .returning()

    if (inserted) return inserted.role as OrgRoleName

    // Already a member through another path (e.g. a second invitation
    // accepted concurrently) — the membership row wins, not an error.
    const [existing] = await tx
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, claimed.organizationId),
          eq(organizationMembers.userId, user.id)
        )
      )
    return (existing?.role as OrgRoleName) ?? (claimed.role as OrgRoleName)
  })

  return { organization_id: String(row.organizationId), role }
}
