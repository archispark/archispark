import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { and, eq } from "drizzle-orm"
import { db, users, organizations, organizationMembers } from "@workspace/db"
import {
  listAllUsers,
  createPlatformUser,
  getPlatformUser,
  updatePlatformUser,
} from "./platform-users-store"
import { NotFoundError, ValidationError } from "./errors"

async function insertUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const suffix = randomUUID()
  const [row] = await db
    .insert(users)
    .values({
      id: `local:${suffix}`,
      username: `platform-users-test-${suffix}`,
      email: `platform-users-test-${suffix}@example.com`,
      passwordHash: "irrelevant",
      role: "user",
      enabled: true,
      ...overrides,
    })
    .returning()
  return row!
}

// 0025_seed_local_admin.sql seeds an active "admin" platform_admin into
// every fresh (migrated) test database. Tests asserting the "last active
// platform_admin" count call this first so it's deterministic regardless
// of that seed or what earlier tests in this file left behind.
async function demoteAllActiveAdmins() {
  await db
    .update(users)
    .set({ role: "user" })
    .where(and(eq(users.role, "platform_admin"), eq(users.enabled, true)))
}

describe("platform-users-store", () => {
  beforeAll(demoteAllActiveAdmins)

  it("lists users", async () => {
    const user = await insertUser()
    const list = await listAllUsers()
    expect(list.find((u) => u.id === user.id)).toBeDefined()
  })

  it("creates a local account with a normalized username/email and forces a password change", async () => {
    const suffix = randomUUID()
    const created = await createPlatformUser({
      username: `New-User-${suffix}`.toUpperCase(),
      email: `New-User-${suffix}@Example.com`,
      password: "correct-horse-battery-staple",
      first_name: "Ada",
      last_name: "Lovelace",
    })
    expect(created.username).toBe(`new-user-${suffix}`.toLowerCase())
    expect(created.email).toBe(`new-user-${suffix}@example.com`.toLowerCase())
    expect(created.role).toBe("user")
    expect(created.must_change_password).toBe(true)
  })

  it("refuses to create a duplicate username or email", async () => {
    const user = await insertUser()
    await expect(
      createPlatformUser({
        username: user.username,
        email: `other-${randomUUID()}@example.com`,
        password: "correct-horse-battery-staple",
      })
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("updates role and enabled status", async () => {
    // Another active admin so disabling `user` below isn't blocked as
    // "last active platform_admin" — that guard has its own tests further
    // down.
    await insertUser({ role: "platform_admin", enabled: true })
    const user = await insertUser()
    const promoted = await updatePlatformUser(user.id, {
      role: "platform_admin",
    })
    expect(promoted.role).toBe("platform_admin")

    const suspended = await updatePlatformUser(user.id, { enabled: false })
    expect(suspended.enabled).toBe(false)
    expect(suspended.role).toBe("platform_admin")
  })

  it("throws NotFoundError for an unknown user id", async () => {
    await expect(
      updatePlatformUser("local:does-not-exist", { enabled: false })
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("returns a user detail with no organizations", async () => {
    const user = await insertUser()
    const detail = await getPlatformUser(user.id)
    expect(detail.id).toBe(user.id)
    expect(detail.organizations).toEqual([])
  })

  it("returns a user detail with its organization memberships", async () => {
    const user = await insertUser()
    const [org] = await db
      .insert(organizations)
      .values({ slug: `org-${randomUUID()}`, name: "Test Org" })
      .returning()
    await db
      .insert(organizationMembers)
      .values({ organizationId: org!.id, userId: user.id, role: "editor" })

    const detail = await getPlatformUser(user.id)
    expect(detail.organizations).toEqual([
      {
        id: String(org!.id),
        slug: org!.slug,
        name: org!.name,
        is_personal: false,
        enabled: true,
        role: "editor",
      },
    ])
  })

  it("throws NotFoundError for getPlatformUser with an unknown id", async () => {
    await expect(
      getPlatformUser("local:does-not-exist")
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("allows demoting a platform_admin when another active one remains", async () => {
    await demoteAllActiveAdmins()
    await insertUser({ role: "platform_admin", enabled: true })
    const target = await insertUser({ role: "platform_admin", enabled: true })

    const demoted = await updatePlatformUser(target.id, { role: "user" })
    expect(demoted.role).toBe("user")
  })

  it("refuses to demote or disable the last active platform_admin", async () => {
    await demoteAllActiveAdmins()
    const lastAdmin = await insertUser({
      role: "platform_admin",
      enabled: true,
    })

    await expect(
      updatePlatformUser(lastAdmin.id, { role: "user" })
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      updatePlatformUser(lastAdmin.id, { enabled: false })
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
