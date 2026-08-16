/**
 * Tests for src/organizations-store.ts — organization/member CRUD and the
 * last-owner invariant (Phase 4).
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { eq, and } from "drizzle-orm"
import { db, organizations, organizationMembers } from "@workspace/db"
import {
  listOrganizationsForUser,
  renameOrganization,
  activateOrganization,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "./organizations-store"
import { ValidationError, ForbiddenError, NotFoundError } from "./errors"
import type { AccessUser } from "./access"
import { DEMO_KEYCLOAK_SUBS } from "./test/keycloak-token-fake"

const OWNER: AccessUser = {
  id: `org-store-owner-${randomUUID()}`,
  role: "user",
}
const EDITOR: AccessUser = {
  id: `org-store-editor-${randomUUID()}`,
  role: "user",
}
const PLATFORM_ADMIN: AccessUser = {
  id: `org-store-platform-${randomUUID()}`,
  role: "platform_admin",
}

let orgId: number

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ slug: `org-store-test-${randomUUID()}`, name: "Org Store Test" })
    .returning()
  orgId = org!.id
  await db.insert(organizationMembers).values([
    { organizationId: orgId, userId: OWNER.id, role: "owner" },
    { organizationId: orgId, userId: EDITOR.id, role: "editor" },
  ])
})

describe("listOrganizationsForUser", () => {
  it("platform_admin without any real membership sees an empty list", async () => {
    await expect(listOrganizationsForUser(PLATFORM_ADMIN)).resolves.toEqual([])
  })

  it("platform_admin sees an organization it's a real member of, like anyone else", async () => {
    const admin: AccessUser = {
      id: `org-store-platform-member-${randomUUID()}`,
      role: "platform_admin",
    }
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: admin.id,
      role: "viewer",
    })
    const orgs = await listOrganizationsForUser(admin)
    expect(orgs.find((o) => o.id === String(orgId))?.role).toBe("viewer")
  })
})

describe("renameOrganization / activateOrganization", () => {
  it("owner can rename; editor cannot (manage_members is owner-only)", async () => {
    const renamed = await renameOrganization(OWNER, orgId, "Renamed by owner")
    expect(renamed.name).toBe("Renamed by owner")
    await expect(
      renameOrganization(EDITOR, orgId, "Renamed by editor")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("activateOrganization marks the organization active for that user", async () => {
    const activated = await activateOrganization(OWNER, orgId)
    expect(activated.active).toBe(true)
  })
})

describe("addMember", () => {
  it("owner can add an existing Keycloak user", async () => {
    const added = await addMember(OWNER, orgId, "contrib", "viewer")
    expect(added.user_id).toBe(DEMO_KEYCLOAK_SUBS.contrib)
    expect(added.role).toBe("viewer")
  })

  it("editor cannot add a member (manage_members is owner-only)", async () => {
    await expect(
      addMember(EDITOR, orgId, "user", "viewer")
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it("rejects a username that doesn't exist in Keycloak", async () => {
    await expect(
      addMember(OWNER, orgId, "does-not-exist", "viewer")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects adding a user who is already a member", async () => {
    await expect(
      addMember(OWNER, orgId, "contrib", "editor")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("listMembers returns usernames resolved from Keycloak", async () => {
    const members = await listMembers(OWNER, orgId)
    expect(members.find((m) => m.user_id === OWNER.id)?.role).toBe("owner")
    expect(
      members.find((m) => m.user_id === DEMO_KEYCLOAK_SUBS.contrib)?.username
    ).toBe("contrib")
  })
})

describe("last-owner invariant", () => {
  let soloOrgId: number
  const SOLO_OWNER: AccessUser = {
    id: `org-store-solo-${randomUUID()}`,
    role: "user",
  }

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `org-store-solo-${randomUUID()}`,
        name: "Solo Owner Org",
      })
      .returning()
    soloOrgId = org!.id
    await db.insert(organizationMembers).values({
      organizationId: soloOrgId,
      userId: SOLO_OWNER.id,
      role: "owner",
    })
  })

  it("refuses to demote the last owner", async () => {
    await expect(
      updateMemberRole(SOLO_OWNER, soloOrgId, SOLO_OWNER.id, "editor")
    ).rejects.toBeInstanceOf(ValidationError)
    const [row] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, soloOrgId),
          eq(organizationMembers.userId, SOLO_OWNER.id)
        )
      )
    expect(row!.role).toBe("owner")
  })

  it("refuses to remove the last owner, including self-removal", async () => {
    await expect(
      removeMember(SOLO_OWNER, soloOrgId, SOLO_OWNER.id)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows demoting an owner once a second owner exists", async () => {
    await addMember(SOLO_OWNER, soloOrgId, "user", "owner")
    await expect(
      updateMemberRole(SOLO_OWNER, soloOrgId, SOLO_OWNER.id, "editor")
    ).resolves.toMatchObject({ role: "editor" })
  })
})

describe("last-owner invariant — platform_admin", () => {
  // platform_admin has no unconditional manage_members access anymore — it
  // must be a real owner of the organization first, exactly like any other
  // user, and is then bound by the same last-owner invariant.
  let soloOrgId: number
  const PLATFORM_OWNER: AccessUser = {
    id: `org-store-platform-solo-owner-${randomUUID()}`,
    role: "platform_admin",
  }

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `org-store-platform-solo-${randomUUID()}`,
        name: "Platform Admin Solo Owner Org",
      })
      .returning()
    soloOrgId = org!.id
    await db.insert(organizationMembers).values({
      organizationId: soloOrgId,
      userId: PLATFORM_OWNER.id,
      role: "owner",
    })
  })

  it("platform_admin without a real membership on this org cannot manage its members", async () => {
    await expect(
      updateMemberRole(PLATFORM_ADMIN, soloOrgId, PLATFORM_OWNER.id, "editor")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses to demote the last real owner, even a platform_admin one", async () => {
    await expect(
      updateMemberRole(PLATFORM_OWNER, soloOrgId, PLATFORM_OWNER.id, "editor")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("refuses to remove the last real owner, even a platform_admin one", async () => {
    await expect(
      removeMember(PLATFORM_OWNER, soloOrgId, PLATFORM_OWNER.id)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows demoting once a second real owner exists", async () => {
    await addMember(PLATFORM_OWNER, soloOrgId, "user", "owner")
    await expect(
      updateMemberRole(PLATFORM_OWNER, soloOrgId, PLATFORM_OWNER.id, "editor")
    ).resolves.toMatchObject({ role: "editor" })
  })
})
