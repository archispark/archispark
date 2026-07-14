/**
 * Tests for src/invitations-store.ts — email invitation CRUD, the
 * one-active-per-(org,email) invariant, and the accept flow's guards
 * (verified email, matching email, single-use token).
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { randomUUID } from "crypto"
import { eq, and } from "drizzle-orm"
import { db, organizations, organizationMembers } from "@workspace/db"
import {
  createOrReplaceInvitation,
  listInvitations,
  revokeInvitation,
  resendInvitation,
  getInvitationPreview,
  acceptInvitation,
} from "./invitations-store.js"
import { ValidationError, NotFoundError, ForbiddenError } from "./errors.js"
import type { AccessUser } from "./access.js"

vi.mock("./mail.js", async () => import("./test/mail-fake.js"))
import {
  resetMailFake,
  setMailFakeShouldFail,
  getSentInvitationEmails,
} from "./test/mail-fake.js"

function tokenFromAcceptUrl(acceptUrl: string): string {
  return acceptUrl.split("/").pop()!
}

async function lastSentToken(): Promise<string> {
  const emails = getSentInvitationEmails()
  return tokenFromAcceptUrl(emails[emails.length - 1]!.acceptUrl)
}

const OWNER: AccessUser = { id: `inv-owner-${randomUUID()}`, role: "user" }
const MEMBER: AccessUser = { id: `inv-member-${randomUUID()}`, role: "user" }

let orgId: number

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `inv-test-${randomUUID()}`, name: "Invitations Test Org" })
    .returning()
  orgId = org!.id
  await db.insert(organizationMembers).values([
    { organizationId: orgId, userId: OWNER.id, role: "owner" },
    { organizationId: orgId, userId: MEMBER.id, role: "member" },
  ])
})

beforeEach(() => {
  resetMailFake()
})

function invitee(
  email: string,
  emailVerified = true
): AccessUser & { email: string; emailVerified: boolean } {
  return { id: `invitee-${randomUUID()}`, role: "user", email, emailVerified }
}

describe("createOrReplaceInvitation", () => {
  it("creates an invitation and sends the e-mail", async () => {
    const email = `invite-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    expect(created.email).toBe(email)
    expect(created.role).toBe("member")
    expect(created.sent_at).not.toBeNull()
    expect(created.expired).toBe(false)
    expect(getSentInvitationEmails()).toHaveLength(1)
    expect(getSentInvitationEmails()[0]!.to).toBe(email)
  })

  it("lowercases the e-mail", async () => {
    const email = `Mixed-Case-${randomUUID()}@Example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    expect(created.email).toBe(email.toLowerCase())
  })

  it("member cannot invite (manage_members is owner-only)", async () => {
    await expect(
      createOrReplaceInvitation(
        MEMBER,
        orgId,
        `forbidden-${randomUUID()}@example.com`,
        "member"
      )
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("rejects an invalid role", async () => {
    await expect(
      createOrReplaceInvitation(
        OWNER,
        orgId,
        `bad-role-${randomUUID()}@example.com`,
        "superadmin"
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("a second invitation for the same e-mail revokes the first — only one active at a time", async () => {
    const email = `resend-race-${randomUUID()}@example.com`
    await createOrReplaceInvitation(OWNER, orgId, email, "member")
    const firstToken = await lastSentToken()

    await createOrReplaceInvitation(OWNER, orgId, email, "admin")
    const secondToken = await lastSentToken()
    expect(secondToken).not.toBe(firstToken)

    const active = (await listInvitations(OWNER, orgId)).filter(
      (i) => i.email === email
    )
    expect(active).toHaveLength(1)
    expect(active[0]!.role).toBe("admin")

    // The old token is revoked, not just superseded.
    await expect(getInvitationPreview(firstToken)).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it("an SMTP failure leaves sent_at null without blocking creation", async () => {
    setMailFakeShouldFail(true)
    const email = `smtp-fail-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    expect(created.sent_at).toBeNull()

    const [row] = await listInvitations(OWNER, orgId).then((rows) =>
      rows.filter((r) => r.email === email)
    )
    expect(row).toBeDefined()
  })
})

describe("resendInvitation", () => {
  it("resends an invitation that previously failed to send", async () => {
    setMailFakeShouldFail(true)
    const email = `resend-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    expect(created.sent_at).toBeNull()

    setMailFakeShouldFail(false)
    const resent = await resendInvitation(OWNER, orgId, Number(created.id))
    expect(resent.sent_at).not.toBeNull()
    expect(resent.email).toBe(email)
    expect(getSentInvitationEmails().some((e) => e.to === email)).toBe(true)
  })

  it("404s for an invitation id that doesn't exist", async () => {
    await expect(
      resendInvitation(OWNER, orgId, 999999999)
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("revokeInvitation", () => {
  it("revokes an active invitation, removing it from the pending list", async () => {
    const email = `revoke-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    await revokeInvitation(OWNER, orgId, Number(created.id))

    const pending = await listInvitations(OWNER, orgId)
    expect(pending.some((i) => i.id === created.id)).toBe(false)
  })

  it("404s revoking an already-revoked invitation", async () => {
    const email = `double-revoke-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    await revokeInvitation(OWNER, orgId, Number(created.id))
    await expect(
      revokeInvitation(OWNER, orgId, Number(created.id))
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("member cannot revoke (manage_members is owner-only)", async () => {
    const email = `revoke-forbidden-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    await expect(
      revokeInvitation(MEMBER, orgId, Number(created.id))
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("getInvitationPreview / acceptInvitation", () => {
  it("previews and accepts a valid invitation", async () => {
    const email = `accept-${randomUUID()}@example.com`
    await createOrReplaceInvitation(OWNER, orgId, email, "admin")
    const token = await lastSentToken()

    const preview = await getInvitationPreview(token)
    expect(preview.role).toBe("admin")
    expect(preview.email).toBe(email)

    const user = invitee(email, true)
    const result = await acceptInvitation(user, token)
    expect(result.organization_id).toBe(String(orgId))
    expect(result.role).toBe("admin")

    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, user.id)
        )
      )
    expect(membership?.role).toBe("admin")
  })

  it("refuses acceptance when the caller's e-mail isn't verified", async () => {
    const email = `unverified-${randomUUID()}@example.com`
    await createOrReplaceInvitation(OWNER, orgId, email, "member")
    const token = await lastSentToken()

    await expect(
      acceptInvitation(invitee(email, false), token)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("refuses acceptance when the caller's e-mail doesn't match the invitation", async () => {
    const email = `mismatch-${randomUUID()}@example.com`
    await createOrReplaceInvitation(OWNER, orgId, email, "member")
    const token = await lastSentToken()

    await expect(
      acceptInvitation(
        invitee(`someone-else-${randomUUID()}@example.com`, true),
        token
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("404s for an unknown token", async () => {
    await expect(getInvitationPreview("does-not-exist")).rejects.toBeInstanceOf(
      NotFoundError
    )
    await expect(
      acceptInvitation(invitee("x@example.com", true), "does-not-exist")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses a revoked invitation", async () => {
    const email = `accept-revoked-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    const token = await lastSentToken()
    await revokeInvitation(OWNER, orgId, Number(created.id))

    await expect(getInvitationPreview(token)).rejects.toBeInstanceOf(
      ValidationError
    )
    await expect(
      acceptInvitation(invitee(email, true), token)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("refuses an expired invitation", async () => {
    const email = `accept-expired-${randomUUID()}@example.com`
    const created = await createOrReplaceInvitation(
      OWNER,
      orgId,
      email,
      "member"
    )
    const token = await lastSentToken()
    // Force expiry directly — createOrReplaceInvitation always issues a
    // 7-day expiry, so simulate the passage of time instead of waiting.
    const { organizationInvitations } = await import("@workspace/db")
    await db
      .update(organizationInvitations)
      .set({ expiresAt: Math.floor(Date.now() / 1000) - 1 })
      .where(eq(organizationInvitations.id, Number(created.id)))

    const pending = await listInvitations(OWNER, orgId)
    expect(pending.find((i) => i.id === created.id)?.expired).toBe(true)

    await expect(getInvitationPreview(token)).rejects.toBeInstanceOf(
      ValidationError
    )
    await expect(
      acceptInvitation(invitee(email, true), token)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("does not error when the invitee is already a member through another path", async () => {
    const email = `already-member-${randomUUID()}@example.com`
    await createOrReplaceInvitation(OWNER, orgId, email, "member")
    const token = await lastSentToken()
    const user = invitee(email, true)

    // Simulate the user already having joined some other way before
    // accepting — onConflictDoNothing means the membership row wins rather
    // than erroring; the invitation is still consumed exactly once (see
    // "two concurrent accepts" below for the actual double-accept guard).
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: user.id, role: "member" })

    await expect(acceptInvitation(user, token)).resolves.toMatchObject({
      organization_id: String(orgId),
    })
  })

  it("two concurrent accepts on the same token: exactly one succeeds, one member row is created", async () => {
    const email = `concurrent-${randomUUID()}@example.com`
    await createOrReplaceInvitation(OWNER, orgId, email, "member")
    const token = await lastSentToken()
    const user = invitee(email, true)

    const [a, b] = await Promise.allSettled([
      acceptInvitation(user, token),
      acceptInvitation(user, token),
    ])
    const fulfilled = [a, b].filter((r) => r.status === "fulfilled")
    const rejected = [a, b].filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ValidationError
    )

    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, user.id)
        )
      )
    expect(memberships).toHaveLength(1)
  })
})
