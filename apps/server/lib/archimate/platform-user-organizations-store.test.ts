/**
 * Tests for platform-user-organizations-store.ts — add/remove a local
 * account's organization memberships from the platform_admin user detail
 * page, bypassing the regular owner-only assertOrgAccess gate.
 */

import { describe, it, expect } from "vitest"
import { randomUUID } from "crypto"
import { and, eq } from "drizzle-orm"
import { db, users, organizations, organizationMembers } from "@workspace/db"
import {
  addUserToOrganization,
  removeUserFromOrganization,
} from "./platform-user-organizations-store"
import { NotFoundError, ValidationError } from "./errors"

async function insertUser() {
  const suffix = randomUUID()
  const [row] = await db
    .insert(users)
    .values({
      id: `local:${suffix}`,
      username: `platform-user-orgs-test-${suffix}`,
      email: `platform-user-orgs-test-${suffix}@example.com`,
      passwordHash: "irrelevant",
    })
    .returning()
  return row!
}

async function insertOrg() {
  const [row] = await db
    .insert(organizations)
    .values({ slug: `platform-user-orgs-test-${randomUUID()}`, name: "Test Org" })
    .returning()
  return row!
}

describe("addUserToOrganization", () => {
  it("adds a membership with the given role", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    const result = await addUserToOrganization(user.id, org.id, "editor")
    expect(result).toEqual({
      id: String(org.id),
      slug: org.slug,
      name: org.name,
      is_personal: false,
      enabled: true,
      role: "editor",
    })
  })

  it("rejects an invalid role", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await expect(
      addUserToOrganization(user.id, org.id, "nope")
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("throws NotFoundError for an unknown user or organization", async () => {
    const org = await insertOrg()
    await expect(
      addUserToOrganization("local:does-not-exist", org.id, "viewer")
    ).rejects.toBeInstanceOf(NotFoundError)

    const user = await insertUser()
    await expect(
      addUserToOrganization(user.id, 999999999, "viewer")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses to add an already-existing membership", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await addUserToOrganization(user.id, org.id, "viewer")
    await expect(
      addUserToOrganization(user.id, org.id, "editor")
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe("removeUserFromOrganization", () => {
  it("removes an existing membership", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await addUserToOrganization(user.id, org.id, "editor")
    await removeUserFromOrganization(user.id, org.id)

    const [remaining] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, user.id)
        )
      )
    expect(remaining).toBeUndefined()
  })

  it("throws NotFoundError when the membership doesn't exist", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await expect(
      removeUserFromOrganization(user.id, org.id)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("refuses to remove the last owner", async () => {
    const user = await insertUser()
    const org = await insertOrg()
    await addUserToOrganization(user.id, org.id, "owner")
    await expect(
      removeUserFromOrganization(user.id, org.id)
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows removing an owner when another owner remains", async () => {
    const userA = await insertUser()
    const userB = await insertUser()
    const org = await insertOrg()
    await addUserToOrganization(userA.id, org.id, "owner")
    await addUserToOrganization(userB.id, org.id, "owner")
    await expect(
      removeUserFromOrganization(userA.id, org.id)
    ).resolves.toBeUndefined()
  })
})
