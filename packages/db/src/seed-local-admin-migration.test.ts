/**
 * Tests for migration 0025_seed_local_admin.sql — the first-boot admin/admin
 * account (see apps/docs/content/docs/reference/authentication.mdx#local-accounts).
 */

import { describe, it, expect, beforeAll } from "vitest"
import { verifyPassword } from "@workspace/auth"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { users } from "./schema.js"

beforeAll(async () => {
  await runMigrations()
})

describe("0025_seed_local_admin", () => {
  it("seeds a platform_admin admin/admin account on an empty users table", async () => {
    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)

    const [admin] = rows
    expect(admin!.id.startsWith("local:")).toBe(true)
    expect(admin!.username).toBe("admin")
    expect(admin!.role).toBe("platform_admin")
    expect(admin!.enabled).toBe(true)
    expect(admin!.mustChangePassword).toBe(true)
    await expect(verifyPassword(admin!.passwordHash, "admin")).resolves.toBe(
      true
    )
  })
})
