/**
 * Seeds the fixed set of system dashboards, once, shared by every workspace
 * (`dashboards.workspaceId IS NULL` — see 0032_dashboard_system_seed.sql) —
 * the reusable core of `packages/db/scripts/seed-dashboards.ts`, ported to
 * Drizzle so it can be shared with the demo reset cron.
 */

import { readFileSync } from "fs"
import { sql } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { seedsPath } from "./seeds-path.js"
import { dashboards, dashboardRevisions } from "./schema.js"

const SYSTEM_DASHBOARDS_AUTHOR = "system"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

interface SourceRevision {
  dashboardId: string
  revision: number
  definition: Record<string, unknown>
}

function scopeQuery(text: string): string {
  // Every imported query must satisfy ArchiSpark's organization isolation
  // contract. Element/View labels without a property map get one, while maps
  // receive the organization property first. The source seed contains no
  // pre-existing $organizationId reference.
  return text
    .replace(/:Element\s*\{/g, ":Element {organizationId: $organizationId, ")
    .replace(/:View\s*\{/g, ":View {organizationId: $organizationId, ")
    .replace(/:Element\)/g, ":Element {organizationId: $organizationId})")
    .replace(/:View\)/g, ":View {organizationId: $organizationId})")
}

function normalizeDefinition(
  definition: Record<string, unknown>
): Record<string, unknown> {
  const normalized = structuredClone(definition)
  const panels = normalized["panels"]
  if (!Array.isArray(panels)) return normalized
  for (const instance of panels) {
    if (!instance || typeof instance !== "object") continue
    const panel = (instance as Record<string, unknown>)["panel"]
    if (!panel || typeof panel !== "object") continue
    const panelRecord = panel as Record<string, unknown>
    const visualization = panelRecord["visualization"]
    if (visualization && typeof visualization === "object") {
      const visualizationRecord = visualization as Record<string, unknown>
      // `example/progress` is a plugin visualization from the source portal;
      // ArchiSpark ships only its native core renderers.
      if (visualizationRecord["type"] === "example/progress") {
        visualizationRecord["type"] = "core/metric"
      }
    }
    const query = panelRecord["query"]
    if (!query || typeof query !== "object") continue
    const queryRecord = query as Record<string, unknown>
    // ArchiSpark only exposes its native Neo4j datasource. The upstream
    // PostgreSQL demo metric is mapped to the same safe model metric.
    if (queryRecord["language"] === "sql") {
      queryRecord["datasourceId"] = "architecture-neo4j"
      queryRecord["language"] = "cypher"
      queryRecord["text"] =
        "MATCH (element:Element {organizationId: $organizationId}) RETURN count(element) AS count"
    } else if (typeof queryRecord["text"] === "string") {
      queryRecord["text"] = scopeQuery(queryRecord["text"])
    }
  }
  return normalized
}

export function parseSourceRevisions(sqlText: string): SourceRevision[] {
  const pattern =
    /\('([^']+)',\s*(\d+),\s*\$def_[^$]+\$(.*?)\$def_[^$]+\$::jsonb,\s*'[^']+'\)/gs
  const revisions: SourceRevision[] = []
  for (const match of sqlText.matchAll(pattern)) {
    revisions.push({
      dashboardId: match[1]!,
      revision: Number(match[2]),
      definition: normalizeDefinition(JSON.parse(match[3]!)),
    })
  }
  if (revisions.length === 0)
    throw new Error("Aucun dashboard n'a été trouvé dans le seed importé.")
  return revisions
}

export interface SeedDashboardsResult {
  seededDashboards: number
  seededRevisions: number
}

/**
 * Seeds (or resyncs) the system dashboards, once, shared by every workspace
 * — idempotent (`onConflictDoUpdate`), safe to rerun. Runs once at deploy
 * time via `0032_dashboard_system_seed.sql`; this function is the manual
 * repair path (`pnpm --filter @workspace/db seed:dashboards`) if
 * `seeds/dashboards.sql` changes later, and is also called by the demo
 * reset cron after `truncateApplicationTables()` wipes the table.
 */
export async function seedSystemDashboards(
  database: Db = defaultDb
): Promise<SeedDashboardsResult> {
  const revisions = parseSourceRevisions(
    readFileSync(seedsPath("dashboards.sql"), "utf-8")
  )
  const latestByDashboard = new Map<string, number>()
  for (const source of revisions) {
    latestByDashboard.set(
      source.dashboardId,
      Math.max(latestByDashboard.get(source.dashboardId) ?? 0, source.revision)
    )
  }

  await database.transaction(async (tx: Db) => {
    for (const [dashboardId, latestRevision] of latestByDashboard) {
      const [dashboardRow] = await tx
        .insert(dashboards)
        .values({
          dashboardId,
          isSystem: true,
          latestRevision,
          createdById: SYSTEM_DASHBOARDS_AUTHOR,
        })
        .onConflictDoUpdate({
          target: [dashboards.dashboardId],
          targetWhere: sql`${dashboards.workspaceId} is null`,
          set: {
            isSystem: true,
            latestRevision: sql`GREATEST(${dashboards.latestRevision}, excluded.latest_revision)`,
          },
        })
        .returning({ id: dashboards.id })

      for (const source of revisions.filter((r) => r.dashboardId === dashboardId)) {
        await tx
          .insert(dashboardRevisions)
          .values({
            dashboardId: dashboardRow!.id,
            revision: source.revision,
            definition: source.definition,
            createdById: SYSTEM_DASHBOARDS_AUTHOR,
          })
          .onConflictDoUpdate({
            target: [dashboardRevisions.dashboardId, dashboardRevisions.revision],
            set: {
              definition: source.definition,
              createdById: SYSTEM_DASHBOARDS_AUTHOR,
            },
          })
      }
    }
  })

  return { seededDashboards: latestByDashboard.size, seededRevisions: revisions.length }
}
