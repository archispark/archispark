import { describe, it, expect, beforeAll } from "vitest"
import { eq, isNull } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { dashboards, organizations, users } from "./schema.js"
import { seedLocalUsers } from "./local-users.js"
import { truncateApplicationTables } from "./reset-application-data.js"

beforeAll(async () => {
  await runMigrations()
})

describe("truncateApplicationTables", () => {
  it("wipes application data but preserves migration history", async () => {
    await db
      .insert(organizations)
      .values({ slug: "to-be-wiped", name: "To be wiped" })
    await seedLocalUsers([
      {
        username: "visitor",
        email: "visitor@archispark.internal",
        password: "visitor",
      },
    ])
    await expect(
      db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, "to-be-wiped"))
    ).resolves.toHaveLength(1)

    const result = await truncateApplicationTables()
    expect(result.tables).toBeGreaterThan(0)

    await expect(db.select().from(organizations)).resolves.toHaveLength(0)
    await expect(db.select().from(users)).resolves.toHaveLength(0)
  })

  it("succeeds again on already-empty tables", async () => {
    const result = await truncateApplicationTables()
    expect(result.tables).toBeGreaterThan(0)
  })

  it("restores system dashboards wiped by the truncate", async () => {
    await truncateApplicationTables()
    const systemDashboards = await db
      .select()
      .from(dashboards)
      .where(isNull(dashboards.workspaceId))
    expect(systemDashboards.length).toBeGreaterThan(0)
    expect(systemDashboards.every((d) => d.isSystem)).toBe(true)
  })
})
