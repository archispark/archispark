/**
 * Tests for the single authorization gateway (src/access.ts) — the full
 * {owner, admin, member, platform_admin, non-member} × {read, write,
 * manage_members} × {org active/suspended} × {stale active pointer} matrix.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import {
  db,
  organizations,
  organizationMembers,
  userActiveOrganization,
  userActiveWorkspace,
  workspaces,
} from "@workspace/db"
import {
  assertOrgAccess,
  assertWorkspaceAccess,
  resolveActiveContext,
  resolveActiveOrganizationId,
  type AccessUser,
} from "./access.js"
import { NotFoundError, ForbiddenError } from "./errors.js"

const OWNER: AccessUser = { id: `owner-${randomUUID()}`, role: "user" }
const ADMIN: AccessUser = { id: `admin-${randomUUID()}`, role: "user" }
const MEMBER: AccessUser = { id: `member-${randomUUID()}`, role: "user" }
const PLATFORM_ADMIN: AccessUser = {
  id: `platform-${randomUUID()}`,
  role: "platform_admin",
}
const NON_MEMBER: AccessUser = { id: `stranger-${randomUUID()}`, role: "user" }

let orgId: number
let suspendedOrgId: number
let workspaceId: number

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `access-test-${randomUUID()}`, name: "Access Test Org" })
    .returning()
  orgId = org!.id

  const [suspended] = await db
    .insert(organizations)
    .values({
      slug: `access-suspended-${randomUUID()}`,
      name: "Suspended Org",
      enabled: false,
    })
    .returning()
  suspendedOrgId = suspended!.id

  await db.insert(organizationMembers).values([
    { organizationId: orgId, userId: OWNER.id, role: "owner" },
    { organizationId: orgId, userId: ADMIN.id, role: "admin" },
    { organizationId: orgId, userId: MEMBER.id, role: "member" },
    { organizationId: suspendedOrgId, userId: OWNER.id, role: "owner" },
  ])

  const [ws] = await db
    .insert(workspaces)
    .values({
      uuid: `id-${randomUUID()}`,
      name: "Access Test WS",
      organizationId: orgId,
      createdById: OWNER.id,
    })
    .returning()
  workspaceId = ws!.id
})

describe("assertOrgAccess", () => {
  it("owner satisfies read, write, and manage_members", async () => {
    await expect(assertOrgAccess(OWNER, orgId, "read")).resolves.toBe("owner")
    await expect(assertOrgAccess(OWNER, orgId, "write")).resolves.toBe("owner")
    await expect(assertOrgAccess(OWNER, orgId, "manage_members")).resolves.toBe(
      "owner"
    )
  })

  it("admin satisfies read and write but not manage_members", async () => {
    await expect(assertOrgAccess(ADMIN, orgId, "read")).resolves.toBe("admin")
    await expect(assertOrgAccess(ADMIN, orgId, "write")).resolves.toBe("admin")
    await expect(
      assertOrgAccess(ADMIN, orgId, "manage_members")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("member satisfies only read", async () => {
    await expect(assertOrgAccess(MEMBER, orgId, "read")).resolves.toBe("member")
    await expect(
      assertOrgAccess(MEMBER, orgId, "write")
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      assertOrgAccess(MEMBER, orgId, "manage_members")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("platform_admin is structurally rejected regardless of a membership row", async () => {
    // Give platform_admin a membership row on purpose — it must still be denied.
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: PLATFORM_ADMIN.id,
      role: "owner",
    })
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, orgId, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("non-member gets NotFoundError, not ForbiddenError", async () => {
    await expect(
      assertOrgAccess(NON_MEMBER, orgId, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("unknown organization id gets NotFoundError", async () => {
    await expect(assertOrgAccess(OWNER, 999999, "read")).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it("suspended organization rejects even its owner with ForbiddenError", async () => {
    await expect(
      assertOrgAccess(OWNER, suspendedOrgId, "read")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe("assertWorkspaceAccess", () => {
  it("resolves the organization and role for a valid workspace", async () => {
    const ctx = await assertWorkspaceAccess(OWNER, workspaceId, "write")
    expect(ctx).toEqual({
      organizationId: orgId,
      workspaceId,
      orgRole: "owner",
    })
  })

  it("member is denied write access to a workspace in their organization", async () => {
    await expect(
      assertWorkspaceAccess(MEMBER, workspaceId, "write")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("non-member gets NotFoundError for a workspace outside their organizations", async () => {
    await expect(
      assertWorkspaceAccess(NON_MEMBER, workspaceId, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("unknown workspace id gets NotFoundError", async () => {
    await expect(
      assertWorkspaceAccess(OWNER, 999999, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("resolveActiveContext — auto-heal", () => {
  it("falls back to the smallest organization id when user_active_organization points at a revoked membership", async () => {
    // A real organization OWNER is (for now) a member of, set as active, then
    // the membership is revoked — the pointer row itself is untouched (no FK
    // forces it to disappear), simulating "membership révoqué entre-temps".
    const [staleOrg] = await db
      .insert(organizations)
      .values({ slug: `access-stale-org-${randomUUID()}`, name: "Stale Org" })
      .returning()
    await db
      .insert(organizationMembers)
      .values({ organizationId: staleOrg!.id, userId: OWNER.id, role: "owner" })
    await db
      .insert(userActiveOrganization)
      .values({ userId: OWNER.id, organizationId: staleOrg!.id })
      .onConflictDoUpdate({
        target: userActiveOrganization.userId,
        set: { organizationId: staleOrg!.id },
      })
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationId, staleOrg!.id))

    const ctx = await resolveActiveContext(OWNER, "read")
    expect(ctx.organizationId).toBe(await resolveActiveOrganizationId(OWNER.id))
    expect(ctx.organizationId).not.toBe(staleOrg!.id)
    expect(ctx.workspaceId).toBe(workspaceId)

    const [healed] = await db
      .select()
      .from(userActiveOrganization)
      .where(eq(userActiveOrganization.userId, OWNER.id))
    expect(healed!.organizationId).toBe(ctx.organizationId)
  })

  it("falls back to the smallest workspace id when user_active_workspace points outside the active organization", async () => {
    // A workspace that genuinely exists (satisfies the FK) but belongs to a
    // different organization than the one being resolved — an inconsistent
    // pointer, not a deleted one (workspace deletion cascades the pointer
    // row away entirely, so it can never be "stale" that way).
    const [otherOrg] = await db
      .insert(organizations)
      .values({
        slug: `access-other-ws-org-${randomUUID()}`,
        name: "Other WS Org",
      })
      .returning()
    const [otherWs] = await db
      .insert(workspaces)
      .values({
        uuid: `id-${randomUUID()}`,
        name: "Other Org WS",
        organizationId: otherOrg!.id,
        createdById: OWNER.id,
      })
      .returning()
    await db
      .insert(userActiveWorkspace)
      .values({
        userId: OWNER.id,
        organizationId: orgId,
        workspaceId: otherWs!.id,
      })
      .onConflictDoUpdate({
        target: [
          userActiveWorkspace.userId,
          userActiveWorkspace.organizationId,
        ],
        set: { workspaceId: otherWs!.id },
      })

    const ctx = await resolveActiveContext(OWNER, "read")
    expect(ctx.workspaceId).toBe(workspaceId)
  })

  it("honours a token's pinned organization/workspace over the interactive active selection", async () => {
    const ctx = await resolveActiveContext(MEMBER, "read", {
      organizationId: orgId,
      workspaceId: null,
    })
    expect(ctx.organizationId).toBe(orgId)
    expect(ctx.workspaceId).toBe(workspaceId)
  })

  it("rejects a token pinned to a workspace outside its pinned organization", async () => {
    const [otherOrg] = await db
      .insert(organizations)
      .values({ slug: `access-other-${randomUUID()}`, name: "Other Org" })
      .returning()
    const [otherWs] = await db
      .insert(workspaces)
      .values({
        uuid: `id-${randomUUID()}`,
        name: "Other WS",
        organizationId: otherOrg!.id,
        createdById: OWNER.id,
      })
      .returning()
    await db
      .insert(organizationMembers)
      .values({ organizationId: otherOrg!.id, userId: OWNER.id, role: "owner" })

    await expect(
      resolveActiveContext(OWNER, "read", {
        organizationId: orgId,
        workspaceId: otherWs!.id,
      })
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("platform_admin has no active organization at all", async () => {
    await expect(
      resolveActiveContext(PLATFORM_ADMIN, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
