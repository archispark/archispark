/**
 * Seeds the default dashboards for every workspace — the reusable core of
 * `packages/db/scripts/seed-dashboards.ts`, ported to Drizzle so it can be
 * shared with the demo reset cron. Dashboards are intentionally
 * workspace-scoped: two workspaces in the same organization receive
 * independent copies and revision histories.
 */

import { readFileSync } from "fs"
import { sql } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { seedsPath } from "./seeds-path.js"
import { workspaces, dashboards, dashboardRevisions } from "./schema.js"

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
  seededRevisions: number
  workspaces: number
}

export async function seedDashboardsForAllWorkspaces(
  database: Db = defaultDb
): Promise<SeedDashboardsResult> {
  const revisions = parseSourceRevisions(
    readFileSync(seedsPath("dashboards.sql"), "utf-8")
  )
  const workspaceRows = await database
    .select({ id: workspaces.id, createdById: workspaces.createdById })
    .from(workspaces)
    .orderBy(workspaces.id)

  await database.transaction(async (tx: Db) => {
    for (const workspace of workspaceRows) {
      for (const source of revisions) {
        const [dashboardRow] = await tx
          .insert(dashboards)
          .values({
            workspaceId: workspace.id,
            dashboardId: source.dashboardId,
            isProvisioned: true,
            latestRevision: source.revision,
            createdById: workspace.createdById,
          })
          .onConflictDoUpdate({
            target: [dashboards.workspaceId, dashboards.dashboardId],
            set: {
              isProvisioned: true,
              latestRevision: sql`GREATEST(${dashboards.latestRevision}, excluded.latest_revision)`,
            },
          })
          .returning({ id: dashboards.id })

        await tx
          .insert(dashboardRevisions)
          .values({
            dashboardId: dashboardRow!.id,
            revision: source.revision,
            definition: source.definition,
            createdById: workspace.createdById,
          })
          .onConflictDoUpdate({
            target: [dashboardRevisions.dashboardId, dashboardRevisions.revision],
            set: {
              definition: source.definition,
              createdById: workspace.createdById,
            },
          })
      }
    }
  })

  return { seededRevisions: revisions.length, workspaces: workspaceRows.length }
}
