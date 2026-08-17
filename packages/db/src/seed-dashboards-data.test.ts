import { describe, it, expect, beforeAll } from "vitest"
import { eq, isNull } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { dashboards, dashboardRevisions } from "./schema.js"
import { seedSystemDashboards, parseSourceRevisions } from "./seed-dashboards-data.js"

beforeAll(async () => {
  await runMigrations()
})

describe("seedSystemDashboards", () => {
  it("seeds the system dashboards once, shared globally, idempotently", async () => {
    const first = await seedSystemDashboards()
    expect(first.seededDashboards).toBeGreaterThan(0)
    expect(first.seededRevisions).toBeGreaterThanOrEqual(first.seededDashboards)

    const dashboardRows = await db.select().from(dashboards).where(isNull(dashboards.workspaceId))
    expect(dashboardRows.length).toBe(first.seededDashboards)
    for (const row of dashboardRows) expect(row.isSystem).toBe(true)

    const revisionRows = await db
      .select()
      .from(dashboardRevisions)
      .innerJoin(dashboards, eq(dashboardRevisions.dashboardId, dashboards.id))
      .where(isNull(dashboards.workspaceId))
    expect(revisionRows.length).toBe(first.seededRevisions)

    const second = await seedSystemDashboards()
    expect(second.seededRevisions).toBe(first.seededRevisions)
    const dashboardRowsAfter = await db.select().from(dashboards).where(isNull(dashboards.workspaceId))
    expect(dashboardRowsAfter.length).toBe(dashboardRows.length)
  })
})

describe("parseSourceRevisions", () => {
  it("throws when no dashboard tuple is found in the source text", () => {
    expect(() => parseSourceRevisions("select 1;")).toThrow()
  })
})
