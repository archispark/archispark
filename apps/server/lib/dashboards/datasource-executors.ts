/**
 * Exécution des requêtes Cypher d'un panneau contre le Neo4j natif
 * d'ArchiSpark (`@workspace/db-neo4j`, le même graphe que `POST
 * /api/export/neo4j` — voir docs/architecture.md#neo4j-export), au lieu du
 * driver dédié et de la datasource `postgres` de démo du portail d'origine
 * (`datasource-executors.ts`, ofr-archimate-reports/apps/portal).
 *
 * Scoping de sécurité multi-tenant : `organizationId` est injecté ici dans
 * les paramètres liés (`session.run(text, { ...parameters, organizationId }`)
 * — jamais laissé au texte de la requête, écrit par l'auteur du panel — et
 * `assertPanelQuerySafe` exige statiquement que ce paramètre soit référencé
 * dans le texte, à la fois à l'enregistrement d'une révision de dashboard
 * (voir app/api/dashboards/**) et ici, en défense en profondeur. Sans cette
 * double vérification, un panel mal écrit pourrait lire les éléments d'une
 * autre organisation.
 */
import neo4j, { type Session } from "neo4j-driver"
import { getDriver } from "@workspace/db-neo4j"
import type { DashboardDefinition, PanelContent, PanelResult } from "./contracts"

export type QueryParameters = Record<string, string | number | boolean>
export type QueryRow = Record<string, unknown>
export interface GraphEdgeRow {
  id: string
  source: string
  target: string
  type: string
}
export interface GraphNodeRow {
  id: string
  name: string
  type: string
}
export interface DatasourceExecution {
  rows: QueryRow[]
  nodes?: GraphNodeRow[]
  edges?: GraphEdgeRow[]
}

const MAX_ROWS = 500

/** Rejects anything but a single read-only Cypher statement (no `;`, starts with MATCH/WITH/CALL). */
export function assertReadOnly(text: string): void {
  const normalized = text.trim().replace(/;\s*$/, "")
  if (normalized.includes(";") || !/^(MATCH|OPTIONAL\s+MATCH|WITH|CALL\s*\{)/i.test(normalized)) {
    throw new Error("La requête Cypher doit être une requête de lecture unique.")
  }
}

/** Requires `$organizationId` to appear in the query text — the multi-tenant scoping contract every panel must honour. */
export function assertOrganizationScoped(text: string): void {
  if (!/\$organizationId\b/.test(text)) {
    throw new Error(
      "La requête doit filtrer sur « $organizationId » (paramètre injecté automatiquement à l'exécution)."
    )
  }
}

/** Full static validation of a panel's Cypher text — called both when a dashboard revision is saved and before every execution. */
export function assertPanelQuerySafe(text: string): void {
  assertReadOnly(text)
  assertOrganizationScoped(text)
}

/** Validates every embedded panel's query at dashboard-save time — throws with the offending panel's title in the message. */
export function assertDashboardQueriesSafe(definition: DashboardDefinition): void {
  for (const instance of definition.panels) {
    try {
      assertPanelQuerySafe(instance.panel.query.text)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Panneau « ${instance.panel.title} » (${instance.id}) : ${message}`)
    }
  }
}

export function boundedCypher(text: string): string {
  return `CALL {\n${text.trim().replace(/;\s*$/, "")}\n}\nRETURN *\nLIMIT ${MAX_ROWS}`
}

/** Name/type for a graph panel's selected node ids, scoped to the same organization — hydrates `nodeIds` into renderable nodes without loading the whole model. */
export async function nodeMetadata(session: Session, nodeIds: string[], organizationId: number): Promise<GraphNodeRow[]> {
  if (nodeIds.length === 0) return []
  const result = await session.run(
    `UNWIND $nodeIds AS eid
     MATCH (e:Element {id: eid, organizationId: $organizationId})
     RETURN e.id AS id, e.name AS name, e.type AS type`,
    { nodeIds, organizationId }
  )
  return result.records.map((record) => ({
    id: record.get("id") as string,
    name: record.get("name") as string,
    type: record.get("type") as string,
  }))
}

/** Relationships induced between a graph panel's selected node ids, scoped to the same organization. */
export async function inducedEdges(
  session: Session,
  nodeIds: string[],
  organizationId: number
): Promise<GraphEdgeRow[]> {
  if (nodeIds.length === 0) return []
  const result = await session.run(
    `UNWIND $nodeIds AS sid
     MATCH (s:Element {id: sid, organizationId: $organizationId})-[r]->(t:Element {organizationId: $organizationId})
     WHERE t.id IN $nodeIds AND type(r) <> 'HAS_PROPERTY'
     RETURN r.id AS id, s.id AS source, t.id AS target, r.archiType AS type`,
    { nodeIds, organizationId }
  )
  return result.records.map((record) => ({
    id: record.get("id") as string,
    source: record.get("source") as string,
    target: record.get("target") as string,
    type: record.get("type") as string,
  }))
}

export async function executeNeo4jQuery(
  query: PanelContent["query"],
  resultType: PanelContent["resultType"],
  parameters: QueryParameters,
  organizationId: number
): Promise<DatasourceExecution> {
  assertPanelQuerySafe(query.text)
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ })
  try {
    const result = await session.run(boundedCypher(query.text), { ...parameters, organizationId }, {
      timeout: 10_000,
    })
    const rows = result.records.map((record) =>
      Object.fromEntries(record.keys.map((key) => [key as string, record.get(key)]))
    )
    let edges: GraphEdgeRow[] | undefined
    let nodes: GraphNodeRow[] | undefined
    if (resultType === "graph") {
      const nodeIds = rows[0]?.nodeIds
      if (Array.isArray(nodeIds) && nodeIds.every((value) => typeof value === "string")) {
        // neo4j-driver permits only one in-flight query per session. Keep
        // these hydration queries sequential; running them in Promise.all
        // causes "session with ongoing work" failures.
        edges = await inducedEdges(session, nodeIds as string[], organizationId)
        nodes = await nodeMetadata(session, nodeIds as string[], organizationId)
      }
    }
    return { rows, nodes, edges }
  } finally {
    await session.close()
  }
}

export type DatasourceFailureCode = "query" | "timeout" | "unavailable"

export function classifyDatasourceFailure(message: string): DatasourceFailureCode {
  if (/timeout|timed out|statement timeout/i.test(message)) return "timeout"
  if (/connect|connection|unavailable|ECONNREFUSED/i.test(message)) return "unavailable"
  return "query"
}

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString()
  if (value instanceof Date) return value.toISOString()
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber()
  }
  if (Array.isArray(value)) return value.map(jsonValue)
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
  return value
}

/** Normalizes every row's values to JSON-safe types (neo4j-driver returns Integer/DateTime wrapper objects). */
export function normalizeExecution(execution: DatasourceExecution): DatasourceExecution {
  return {
    rows: execution.rows.map((row) => jsonValue(row) as QueryRow),
    nodes: execution.nodes,
    edges: execution.edges,
  }
}

export async function executeDatasourceQuery(
  query: PanelContent["query"],
  resultType: PanelContent["resultType"],
  parameters: QueryParameters,
  organizationId: number
): Promise<DatasourceExecution> {
  const execution = await executeNeo4jQuery(query, resultType, parameters, organizationId)
  return normalizeExecution(execution)
}

export type { PanelResult }
