/**
 * Tests for ensureDefaultPlatformOrganization — the login-time default-entry
 * helper called from the local login and Keycloak callback routes (see
 * their route.ts files). Split out from access-platform-admin.test.ts,
 * which covers resolveActivePlatformOrganizationId/setActivePlatformOrganization/
 * clearActivePlatformOrganization directly.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { randomUUID } from "crypto"
import { db, organizations } from "@workspace/db"
import {
  resolveActivePlatformOrganizationId,
  setActivePlatformOrganization,
} from "./access"
import { ensureDefaultPlatformOrganization } from "./platform-context-store"

let firstOrgId: number
let secondOrgId: number

beforeAll(async () => {
  const [first] = await db
    .insert(organizations)
    .values({
      slug: `platform-context-first-${randomUUID()}`,
      name: "Platform Context First Org",
    })
    .returning()
  firstOrgId = first!.id

  const [second] = await db
    .insert(organizations)
    .values({
      slug: `platform-context-second-${randomUUID()}`,
      name: "Platform Context Second Org",
    })
    .returning()
  secondOrgId = second!.id
})

describe("ensureDefaultPlatformOrganization", () => {
  it("enters a platform_admin with no active organization into the smallest existing one", async () => {
    const userId = `platform-default-${randomUUID()}`
    await ensureDefaultPlatformOrganization(userId)
    await expect(resolveActivePlatformOrganizationId(userId)).resolves.toBe(
      firstOrgId
    )
  })

  it("is a no-op when the platform_admin already has an active organization", async () => {
    const userId = `platform-already-active-${randomUUID()}`
    await setActivePlatformOrganization(userId, secondOrgId)
    await ensureDefaultPlatformOrganization(userId)
    await expect(resolveActivePlatformOrganizationId(userId)).resolves.toBe(
      secondOrgId
    )
  })
})
