import { describe, it, expect, beforeAll } from "vitest"
import { eq } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import { workspaces, dashboards, dashboardRevisions } from "./schema.js"
import { seedDemoWorkspaces } from "./seed-demo-data.js"
import {
  seedDashboardsForAllWorkspaces,
  parseSourceRevisions,
} from "./seed-dashboards-data.js"

beforeAll(async () => {
  await runMigrations()
  await seedDemoWorkspaces(async (username) => `local:${username}`)
})

describe("seedDashboardsForAllWorkspaces", () => {
  it("seeds the same dashboard revisions into every workspace, idempotently", async () => {
    const first = await seedDashboardsForAllWorkspaces()
    expect(first.workspaces).toBe(3)
    expect(first.seededRevisions).toBeGreaterThan(0)

    const [workspace] = await db.select({ id: workspaces.id }).from(workspaces).limit(1)
    const dashboardRows = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.workspaceId, workspace!.id))
    expect(dashboardRows.length).toBeGreaterThan(0)
    expect(dashboardRows.length).toBeLessThanOrEqual(first.seededRevisions)
    for (const row of dashboardRows) expect(row.isProvisioned).toBe(true)

    const revisionRows = await db
      .select()
      .from(dashboardRevisions)
      .innerJoin(dashboards, eq(dashboardRevisions.dashboardId, dashboards.id))
      .where(eq(dashboards.workspaceId, workspace!.id))
    expect(revisionRows.length).toBe(first.seededRevisions)

    const second = await seedDashboardsForAllWorkspaces()
    expect(second.seededRevisions).toBe(first.seededRevisions)
    const dashboardRowsAfter = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.workspaceId, workspace!.id))
    expect(dashboardRowsAfter.length).toBe(dashboardRows.length)
  })
})

describe("parseSourceRevisions", () => {
  it("throws when no dashboard tuple is found in the source text", () => {
    expect(() => parseSourceRevisions("select 1;")).toThrow()
  })
})
