/**
 * Tests for platform_admin's full owner-equivalent access to organization
 * content (src/access.ts) — split out of access.test.ts to stay under the
 * max-lines limit. Covers assertOrgAccess/assertWorkspaceAccess bypass
 * behaviour and the admin-mode active-organization pointer
 * (resolveActivePlatformOrganizationId/setActivePlatformOrganization/
 * clearActivePlatformOrganization).
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
  resolveActiveOrganizationId,
  resolveActivePlatformOrganizationId,
  setActivePlatformOrganization,
  clearActivePlatformOrganization,
  type AccessUser,
} from "./access"
import { NotFoundError } from "./errors"

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
  it("gets full owner-equivalent access regardless of any membership row", async () => {
    // Give platform_admin a viewer membership row on purpose — it must be
    // ignored entirely; the effective role is always the synthetic "owner".
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: PLATFORM_ADMIN.id,
      role: "viewer",
    })
    await expect(assertOrgAccess(PLATFORM_ADMIN, orgId, "read")).resolves.toBe(
      "owner"
    )
    await expect(assertOrgAccess(PLATFORM_ADMIN, orgId, "write")).resolves.toBe(
      "owner"
    )
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, orgId, "manage_members")
    ).resolves.toBe("owner")
  })

  it("bypasses organization suspension, unlike owner/editor/viewer", async () => {
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, suspendedOrgId, "read")
    ).resolves.toBe("owner")
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, suspendedOrgId, "write")
    ).resolves.toBe("owner")
  })

  it("still gets NotFoundError for an organization that doesn't exist", async () => {
    await expect(
      assertOrgAccess(PLATFORM_ADMIN, 999999, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("assertWorkspaceAccess — platform_admin", () => {
  it("can act on a workspace by explicit id without having entered its organization", async () => {
    const ctx = await assertWorkspaceAccess(
      PLATFORM_ADMIN,
      workspaceId,
      "write"
    )
    expect(ctx).toEqual({
      organizationId: orgId,
      workspaceId,
      orgRole: "owner",
    })
  })
})

describe("resolveActiveContext — platform_admin", () => {
  it("has no active organization until it explicitly enters one", async () => {
    await expect(
      resolveActiveContext(PLATFORM_ADMIN, "read")
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("platform_admin admin mode", () => {
  it("resolveActivePlatformOrganizationId throws NotFoundError before any organization is entered", async () => {
    const freshAdmin: AccessUser = {
      id: `platform-fresh-${randomUUID()}`,
      role: "platform_admin",
    }
    await expect(
      resolveActivePlatformOrganizationId(freshAdmin.id)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("setActivePlatformOrganization persists the pointer, resolveActivePlatformOrganizationId reads it back", async () => {
    const admin: AccessUser = {
      id: `platform-enter-${randomUUID()}`,
      role: "platform_admin",
    }
    await setActivePlatformOrganization(admin.id, orgId)
    await expect(resolveActivePlatformOrganizationId(admin.id)).resolves.toBe(
      orgId
    )
  })

  it("clearActivePlatformOrganization removes the pointer ('exit')", async () => {
    const admin: AccessUser = {
      id: `platform-exit-${randomUUID()}`,
      role: "platform_admin",
    }
    await setActivePlatformOrganization(admin.id, orgId)
    await clearActivePlatformOrganization(admin.id)
    await expect(
      resolveActivePlatformOrganizationId(admin.id)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("a platform_admin's active-organization pointer never leaks into resolveActiveOrganizationId (regular members)", async () => {
    const admin: AccessUser = {
      id: `platform-isolated-${randomUUID()}`,
      role: "platform_admin",
    }
    await setActivePlatformOrganization(admin.id, orgId)
    // A regular user with this same id is never a member of anything, so
    // the membership-based resolver must still reject it — the pointer
    // table is shared, but its meaning depends entirely on the caller's role.
    await expect(resolveActiveOrganizationId(admin.id)).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it("resolveActiveOrganization fails before enter, succeeds after", async () => {
    const admin: AccessUser = {
      id: `platform-resolve-${randomUUID()}`,
      role: "platform_admin",
    }
    await expect(
      resolveActiveOrganization(admin, "read")
    ).rejects.toBeInstanceOf(NotFoundError)

    await setActivePlatformOrganization(admin.id, orgId)
    await expect(resolveActiveOrganization(admin, "read")).resolves.toEqual({
      organizationId: orgId,
      orgRole: "owner",
    })
  })

  it("resolveActiveContext resolves a full context once entered, workspace included", async () => {
    const admin: AccessUser = {
      id: `platform-context-${randomUUID()}`,
      role: "platform_admin",
    }
    await setActivePlatformOrganization(admin.id, orgId)
    const ctx = await resolveActiveContext(admin, "write")
    expect(ctx).toEqual({
      organizationId: orgId,
      workspaceId,
      orgRole: "owner",
    })
  })
})
