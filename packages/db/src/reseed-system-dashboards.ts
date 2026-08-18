/**
 * Restores the system dashboards (dashboards.workspace_id IS NULL) from
 * packages/db/seeds/dashboards.sql — the same source
 * 0032_dashboard_system_seed.sql was generated from.
 *
 * That migration is the only place documented to write these rows and
 * deliberately runs once. But `truncateApplicationTables` (reset-application-
 * data.ts) TRUNCATEs every application table, including `dashboards` — and
 * once truncated, `0032` never reapplies (Drizzle skips migrations already
 * recorded in `__drizzle_migrations`, which the reset preserves), leaving
 * every workspace without system dashboards. This is the reusable core
 * behind reset-application-data.ts's post-truncate restore, invoked from
 * there rather than from a migration.
 *
 * Idempotent: `onConflictDoNothing()` on both inserts makes this safe to
 * call even when the rows already exist (e.g. against a freshly migrated,
 * never-reset database).
 */

import { readFileSync } from "node:fs"
import { sql } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { dashboards, dashboardRevisions } from "./schema.js"
import { seedsPath } from "./seeds-path.js"
import { parseSourceRevisions } from "./seed-dashboards-data.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function reseedSystemDashboards(
  database: Db = defaultDb
): Promise<void> {
  const revisions = parseSourceRevisions(
    readFileSync(seedsPath("dashboards.sql"), "utf-8")
  )
  const latestRevisionByDashboard = new Map<string, number>()
  for (const { dashboardId, revision } of revisions) {
    latestRevisionByDashboard.set(
      dashboardId,
      Math.max(revision, latestRevisionByDashboard.get(dashboardId) ?? 0)
    )
  }

  await database.transaction(async (tx: Db) => {
    for (const [dashboardId, latestRevision] of latestRevisionByDashboard) {
      await tx
        .insert(dashboards)
        .values({
          workspaceId: null,
          dashboardId,
          isSystem: true,
          latestRevision,
          createdById: "system",
        })
        .onConflictDoNothing()
    }

    const systemDashboards: { id: number; dashboardId: string }[] = await tx
      .select({ id: dashboards.id, dashboardId: dashboards.dashboardId })
      .from(dashboards)
      .where(sql`${dashboards.workspaceId} IS NULL`)
    const idByDashboard = new Map(
      systemDashboards.map((row) => [row.dashboardId, row.id])
    )

    for (const { dashboardId, revision, definition } of revisions) {
      const id = idByDashboard.get(dashboardId)
      if (id === undefined) continue
      await tx
        .insert(dashboardRevisions)
        .values({
          dashboardId: id,
          revision,
          definition,
          createdById: "system",
        })
        .onConflictDoNothing()
    }
  })
}
