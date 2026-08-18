import { describe, it, expect, beforeAll } from "vitest"
import { eq, isNull, inArray } from "drizzle-orm"
import { runMigrations } from "./migrate.js"
import { db } from "./connection.js"
import {
  dashboards,
  dashboardRevisions,
  organizations,
  users,
} from "./schema.js"
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

  it("restores system dashboards wiped by the truncate, verbatim", async () => {
    const before = await db
      .select()
      .from(dashboards)
      .where(isNull(dashboards.workspaceId))
    const beforeRevisions = await db
      .select()
      .from(dashboardRevisions)
      .where(
        inArray(
          dashboardRevisions.dashboardId,
          before.map((d) => d.id)
        )
      )

    await truncateApplicationTables()

    const after = await db
      .select()
      .from(dashboards)
      .where(isNull(dashboards.workspaceId))
    const afterRevisions = await db
      .select()
      .from(dashboardRevisions)
      .where(
        inArray(
          dashboardRevisions.dashboardId,
          after.map((d) => d.id)
        )
      )

    expect(after.length).toBe(before.length)
    expect(after.every((d) => d.isSystem)).toBe(true)
    expect(afterRevisions.length).toBe(beforeRevisions.length)

    // Restoring from a snapshot (not regenerating from packages/db/seeds/
    // dashboards.sql, which predates the later per-dashboard Postgres
    // migrations) must preserve the migration-patched definitions — every
    // dashboard's *latest* revision now queries postgres-app-db, not the
    // pre-patch architecture-neo4j that older, superseded revisions still
    // carry.
    for (const dashboard of after) {
      const latest = afterRevisions.find(
        (r) =>
          r.dashboardId === dashboard.id &&
          r.revision === dashboard.latestRevision
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const definition = latest?.definition as any
      for (const panel of definition.panels ?? []) {
        expect(panel.panel.query.datasourceId).toBe("postgres-app-db")
      }
    }
  })
})
