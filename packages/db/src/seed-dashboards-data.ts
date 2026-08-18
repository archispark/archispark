/**
 * Parses and normalizes `packages/db/seeds/dashboards.sql` into
 * `DashboardDefinition` JSON — the data source for
 * `0032_dashboard_system_seed.sql`. System dashboards are seeded exactly
 * once, by that migration; there is deliberately no runtime seed/reseed
 * path. If `seeds/dashboards.sql` changes (new dashboard, new revision),
 * regenerate the JSON with `parseSourceRevisions()` and hand-write a new
 * numbered backfill migration, the same way `0032_dashboard_system_seed.sql`
 * was produced.
 */

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

function scopeSqlQuery(text: string): string {
  if (/\$organizationId\b/.test(text)) return text
  return /\bWHERE\b/i.test(text)
    ? text.replace(/\bWHERE\b/i, "WHERE organization_id = $organizationId AND")
    : `${text} WHERE organization_id = $organizationId`
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
    // ArchiSpark exposes a native Postgres datasource
    // (apps/server/lib/dashboards/contracts.ts's POSTGRES_DATASOURCE) backed
    // by its own application database, distinct from the upstream companion
    // project's standalone demo Postgres — retarget the datasource id and
    // add the organization scoping every panel query must carry.
    if (queryRecord["language"] === "sql") {
      queryRecord["datasourceId"] = "postgres-app-db"
      if (typeof queryRecord["text"] === "string") {
        queryRecord["text"] = scopeSqlQuery(queryRecord["text"])
      }
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
