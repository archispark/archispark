/**
 * Wipes every application table (all data), preserving the PostgreSQL
 * schema and Drizzle's own migration history (`__drizzle_migrations`) —
 * the reusable core behind `packages/db/scripts/reset.ts`, also used by the
 * `seed-demo.yml` GitHub Actions workflow, which needs a full
 * fresh-reinstall-style wipe rather than a scoped delete since the public
 * demo lets visitors create their own accounts/organizations.
 *
 * `TRUNCATE ... CASCADE` also empties `dashboards` (system dashboards,
 * `workspace_id IS NULL`) via its FK to `workspaces` — even though
 * `dashboards` isn't itself in `tableList` below, cascading truncation
 * doesn't check row values. System dashboards aren't reproducible from a
 * single seed file: `0032_dashboard_system_seed.sql` seeded them once, and
 * several later migrations (e.g. `0034_demonstration_datasources_postgres.sql`
 * through `0040_vue_architecture_applicative_datasource_postgres.sql`) each
 * hand-patched one dashboard's latest revision in place — none of that is
 * replayed by re-running migrations (Drizzle skips already-recorded ones).
 * So instead of regenerating them from source (which previously
 * reintroduced the pre-patch Neo4j queries those migrations had already
 * fixed), snapshot whatever rows actually exist and restore them verbatim
 * in the same transaction as the truncate.
 */

import { sql, isNull, inArray } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { dashboards, dashboardRevisions } from "./schema.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

export interface TruncateResult {
  tables: number
}

export async function truncateApplicationTables(
  database: Db = defaultDb
): Promise<TruncateResult> {
  const { rows } = await database.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '__drizzle_migrations'
    ORDER BY table_name
  `)

  if (rows.length === 0) return { tables: 0 }

  const tableList = rows
    .map((row: { table_name: string }) => quoteIdentifier(row.table_name))
    .join(", ")

  await database.transaction(async (tx: Db) => {
    const systemDashboards = await tx
      .select()
      .from(dashboards)
      .where(isNull(dashboards.workspaceId))
    const systemDashboardIds = systemDashboards.map((d: { id: number }) => d.id)
    const systemRevisions = systemDashboardIds.length
      ? await tx
          .select()
          .from(dashboardRevisions)
          .where(inArray(dashboardRevisions.dashboardId, systemDashboardIds))
      : []

    await tx.execute(
      sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
    )

    if (systemDashboards.length > 0) {
      await tx.insert(dashboards).values(systemDashboards)
      await tx.insert(dashboardRevisions).values(systemRevisions)
      await tx.execute(
        sql`SELECT setval(pg_get_serial_sequence('dashboards', 'id'), (SELECT MAX(id) FROM dashboards))`
      )
      await tx.execute(
        sql`SELECT setval(pg_get_serial_sequence('dashboard_revisions', 'id'), (SELECT MAX(id) FROM dashboard_revisions))`
      )
    }
  })

  return { tables: rows.length }
}
