/**
 * Seeds the default dashboards for every workspace. Dashboards are
 * intentionally workspace-scoped: two workspaces
 * in the same organization receive independent copies and revision histories.
 */
import { readFileSync } from "fs"
import { resolve } from "path"
import pg from "pg"

interface SourceRevision {
  dashboardId: string
  revision: number
  definition: Record<string, unknown>
}

const SQL_PATH = resolve(import.meta.dirname, "../seeds/dashboards.sql")

function isLocal(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\]|postgres)[:/]/.test(url)
}

function makeClient(url: string): pg.Client {
  const local = isLocal(url)
  if (local) return new pg.Client({ connectionString: url })

  const connectionString = new URL(url)
  connectionString.searchParams.delete("sslmode")
  return new pg.Client({
    connectionString: connectionString.toString(),
    ssl: { rejectUnauthorized: false },
  })
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

function normalizeDefinition(definition: Record<string, unknown>): Record<string, unknown> {
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
      queryRecord["text"] = "MATCH (element:Element {organizationId: $organizationId}) RETURN count(element) AS count"
    } else if (typeof queryRecord["text"] === "string") {
      queryRecord["text"] = scopeQuery(queryRecord["text"])
    }
  }
  return normalized
}

export function parseSourceRevisions(sql: string): SourceRevision[] {
  const pattern = /\('([^']+)',\s*(\d+),\s*\$def_[^$]+\$(.*?)\$def_[^$]+\$::jsonb,\s*'[^']+'\)/gs
  const revisions: SourceRevision[] = []
  for (const match of sql.matchAll(pattern)) {
    revisions.push({
      dashboardId: match[1]!,
      revision: Number(match[2]),
      definition: normalizeDefinition(JSON.parse(match[3]!)),
    })
  }
  if (revisions.length === 0) throw new Error("Aucun dashboard n'a été trouvé dans le seed importé.")
  return revisions
}

const dbUrl = process.env["DATABASE_URL"]
if (!dbUrl) throw new Error("DATABASE_URL is required.")

const client = makeClient(dbUrl)
await client.connect()
try {
  const revisions = parseSourceRevisions(readFileSync(SQL_PATH, "utf-8"))
  const { rows: workspaces } = await client.query<{ id: number; created_by_id: string }>(
    `SELECT id, created_by_id FROM workspaces ORDER BY id`
  )
  await client.query("BEGIN")
  for (const workspace of workspaces) {
    for (const source of revisions) {
      const { rows: dashboards } = await client.query<{ id: number }>(
        `INSERT INTO dashboards (workspace_id, dashboard_id, is_provisioned, latest_revision, created_by_id)
         VALUES ($1, $2, true, $3, $4)
         ON CONFLICT (workspace_id, dashboard_id) DO UPDATE SET is_provisioned = true, latest_revision = GREATEST(dashboards.latest_revision, EXCLUDED.latest_revision)
         RETURNING id`,
        [workspace.id, source.dashboardId, source.revision, workspace.created_by_id]
      )
      const dashboardId = dashboards[0]!.id
      await client.query(
        `INSERT INTO dashboard_revisions (dashboard_id, revision, definition, created_by_id)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (dashboard_id, revision) DO UPDATE
         SET definition = EXCLUDED.definition,
             created_by_id = EXCLUDED.created_by_id`,
        [dashboardId, source.revision, JSON.stringify(source.definition), workspace.created_by_id]
      )
    }
  }
  await client.query("COMMIT")
  console.log(`Seeded ${revisions.length} dashboard revision(s) into ${workspaces.length} workspace(s).`)
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
