/**
 * Exécution des requêtes Cypher d'un panneau contre le Neo4j natif
 * d'ArchiSpark (`@workspace/db-neo4j`, le même graphe que `POST
 * /api/export/neo4j` — voir docs/architecture.md#neo4j-export).
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
import type { PanelContent } from "../contracts"
import type { DatasourceExecution, GraphEdgeRow, GraphNodeRow, QueryParameters } from "./shared"

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
