/**
 * Tests for platform_admin's access to organization content (access.ts) —
 * split out of access.test.ts to stay under the max-lines limit. Since the
 * removal of the "admin mode" bypass, platform_admin follows the exact same
 * organization_members-based rules as any other user for workspace/element/
 * dashboard content; its only unconditional access is to /platform/**,
 * gated separately by withSuperAdmin.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import {
  db,
  organizations,
  organizationMembers,
  workspaces,
} from "@workspace/db"
import {
  assertOrgAccess,
  assertWorkspaceAccess,
  resolveActiveContext,
  resolveActiveOrganization,
  type AccessUser,
} from "./access"
import { NotFoundError, ForbiddenError } from "./errors"

const PLATFORM_ADMIN: AccessUser = {
  id: `platform-${randomUUID()}`,
  role: "platform_admin",
}

let orgId: number
let suspendedOrgId: number
let workspaceId: number

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({
      slug: `access-platform-test-${randomUUID()}`,
      name: "Access Platform Test Org",
    })
    .returning()
  orgId = org!.id

  const [suspended] = await db
    .insert(organizations)
    .values({
      slug: `access-platform-suspended-${randomUUID()}`,
      name: "Suspended Org",
      enabled: false,
    })
    .returning()
  suspendedOrgId = suspended!.id

  const [ws] = await db
    .insert(workspaces)
    .values({
      uuid: `id-${randomUUID()}`,
      name: "Access Platform Test WS",
      organizationId: orgId,
      createdById: `creator-${randomUUID()}`,
    })
    .returning()
  workspaceId = ws!.id
})

describe("assertOrgAccess — platform_admin", () => {
  it("gets NotFoundError like any other user without a membership row", async () => {
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, orgId, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("follows its real membership role once it has one", async () => {
    const admin: AccessUser = {
      id: `platform-member-${randomUUID()}`,
      role: "platform_admin",
    }
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: admin.id,
      role: "viewer",
    })
    await expect(assertOrgAccess(admin, orgId, "read")).resolves.toBe("viewer")
    await expect(assertOrgAccess(admin, orgId, "write")).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })

  it("is refused on a suspended organization even as a real owner", async () => {
    const admin: AccessUser = {
      id: `platform-suspended-owner-${randomUUID()}`,
      role: "platform_admin",
    }
    await db.insert(organizationMembers).values({
      organizationId: suspendedOrgId,
      userId: admin.id,
      role: "owner",
    })
    await expect(
      assertOrgAccess(admin, suspendedOrgId, "read")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("still gets NotFoundError for an organization that doesn't exist", async () => {
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, 999999, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("assertWorkspaceAccess — platform_admin", () => {
  it("is refused without a membership row on the workspace's organization", async () => {
    await expect(
      assertWorkspaceAccess(PLATFORM_ADMIN, workspaceId, "write")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("succeeds once it's a real member of the workspace's organization", async () => {
    const admin: AccessUser = {
      id: `platform-workspace-member-${randomUUID()}`,
      role: "platform_admin",
    }
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: admin.id,
      role: "editor",
    })
    const ctx = await assertWorkspaceAccess(admin, workspaceId, "write")
    expect(ctx).toEqual({
      organizationId: orgId,
      workspaceId,
      orgRole: "editor",
    })
  })
})

describe("resolveActiveContext / resolveActiveOrganization — platform_admin", () => {
  it("has no active organization without any real membership", async () => {
    await expect(
      resolveActiveContext(PLATFORM_ADMIN, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      resolveActiveOrganization(PLATFORM_ADMIN, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("resolves its active organization the same way a regular member would once it has a real membership", async () => {
    const admin: AccessUser = {
      id: `platform-active-${randomUUID()}`,
      role: "platform_admin",
    }
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: admin.id,
      role: "owner",
    })
    await expect(resolveActiveOrganization(admin, "read")).resolves.toEqual({
      organizationId: orgId,
      orgRole: "owner",
    })
    const ctx = await resolveActiveContext(admin, "write")
    expect(ctx).toEqual({
      organizationId: orgId,
      workspaceId,
      orgRole: "owner",
    })
  })
})
