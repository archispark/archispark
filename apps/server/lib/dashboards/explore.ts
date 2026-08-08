/**
 * Requêtes Cypher ad hoc en lecture seule (page Explore) — porté de
 * `explore-query.ts` (ofr-archimate-reports/apps/portal), mais avec un
 * scoping multi-tenant strict : contrairement aux panneaux de dashboard
 * (dont le texte est validé une fois à l'enregistrement), une requête
 * Explore est arbitraire et changeante à chaque exécution — impossible de
 * garantir statiquement qu'elle filtre sur `$organizationId`. La défense est
 * donc appliquée sur le RÉSULTAT : toute ligne contenant un nœud ou une
 * relation Neo4j dont `organizationId` diffère de celui de l'appelant est
 * rejetée dans son intégralité, quel que soit le texte de la requête.
 *
 * Contrairement au portail (qui hydrate le graphe depuis un modèle ArchiMate
 * complet chargé en mémoire, `lib/get-model.ts`), le graphe est reconstruit
 * ici via les mêmes requêtes Neo4j déjà utilisées pour les panneaux de
 * dashboard (`nodeMetadata`/`inducedEdges`, déjà scopées par organisation) —
 * plus simple, et cohérent avec le fait que les éléments `:Element` portent
 * déjà toute la donnée nécessaire.
 */
import neo4j from "neo4j-driver"
import { getDriver } from "@workspace/db-neo4j"
import { inducedEdges, nodeMetadata, type GraphEdgeRow, type GraphNodeRow } from "./datasource-executors"

const MAX_QUERY_LENGTH = 20_000
const MAX_ROWS = 500
const MAX_GRAPH_NODES = 200
const QUERY_TIMEOUT_MS = 10_000

export class ExploreQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExploreQueryError"
  }
}

export function wrapExploreQuery(rawQuery: string): string {
  const query = rawQuery.trim().replace(/;+\s*$/, "")
  if (!query) throw new ExploreQueryError("La requête Cypher est obligatoire.")
  if (query.length > MAX_QUERY_LENGTH) throw new ExploreQueryError(`La requête dépasse ${MAX_QUERY_LENGTH} caractères.`)
  if (/^(EXPLAIN|PROFILE)\b/i.test(query)) {
    throw new ExploreQueryError("EXPLAIN et PROFILE sont gérés par le serveur et ne doivent pas être saisis.")
  }
  return `CALL {\n${query}\n}\nRETURN *\nLIMIT ${MAX_ROWS}`
}

function serializeNeo4jValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value)
  if (neo4j.isInt(value)) return value.inSafeRange() ? value.toNumber() : value.toString()
  if (neo4j.isNode(value)) {
    return { ...(serializeNeo4jValue(value.properties, depth + 1) as Record<string, unknown>), _labels: value.labels }
  }
  if (neo4j.isRelationship(value)) {
    return { ...(serializeNeo4jValue(value.properties, depth + 1) as Record<string, unknown>), _type: value.type }
  }
  if (Array.isArray(value)) return value.map((item) => serializeNeo4jValue(item, depth + 1))
  if (typeof value === "object" && depth < 8) {
    if ("toStandardDate" in value && typeof (value as { toStandardDate: unknown }).toStandardDate === "function") {
      return value.toString()
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeNeo4jValue(item, depth + 1)])
    )
  }
  return String(value)
}

/**
 * Parcourt une valeur Bolt et : (1) collecte les ids des `:Element` rencontrés
 * pour reconstruire le graphe, (2) signale si un nœud/relation appartient à
 * une autre organisation — auquel cas la ligne entière est rejetée.
 */
function inspectValue(value: unknown, nodeIds: Set<string>, organizationId: number, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return true
  if (neo4j.isNode(value)) {
    if (value.properties.organizationId !== undefined && value.properties.organizationId !== organizationId) return false
    if (value.labels.includes("Element") && typeof value.properties.id === "string") nodeIds.add(value.properties.id)
    return true
  }
  if (neo4j.isRelationship(value)) {
    return value.properties.organizationId === undefined || value.properties.organizationId === organizationId
  }
  if (Array.isArray(value)) return value.every((item) => inspectValue(item, nodeIds, organizationId, depth + 1))
  if (typeof value === "object" && !neo4j.isInt(value)) {
    return Object.values(value).every((item) => inspectValue(item, nodeIds, organizationId, depth + 1))
  }
  return true
}

export interface ExploreQueryResult {
  rows: Record<string, unknown>[]
  nodes: GraphNodeRow[]
  edges: GraphEdgeRow[]
  truncated: boolean
  durationMs: number
}

export async function runExploreQuery(
  rawQuery: string,
  parameters: Record<string, unknown>,
  organizationId: number
): Promise<ExploreQueryResult> {
  const query = wrapExploreQuery(rawQuery)
  const boundParameters = { ...parameters, organizationId }
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ })
  const startedAt = performance.now()
  try {
    const explanation = await session.run(`EXPLAIN ${query}`, boundParameters, { timeout: QUERY_TIMEOUT_MS })
    // Le protocole Bolt représente une requête en lecture seule par « r ».
    if (explanation.summary.queryType !== "r") {
      throw new ExploreQueryError("Seules les requêtes Cypher strictement en lecture sont autorisées.")
    }

    const result = await session.run(query, boundParameters, { timeout: QUERY_TIMEOUT_MS })
    const nodeIds = new Set<string>()
    const rows: Record<string, unknown>[] = []
    for (const record of result.records) {
      let accepted = true
      for (const key of record.keys) {
        if (!inspectValue(record.get(key), nodeIds, organizationId)) {
          accepted = false
          break
        }
      }
      if (!accepted) continue
      const row: Record<string, unknown> = {}
      for (const key of record.keys) {
        const column = String(key)
        const value = record.get(key)
        if (column === "nodeIds" && Array.isArray(value)) {
          value.forEach((id) => {
            if (typeof id === "string") nodeIds.add(id)
          })
        }
        row[column] = serializeNeo4jValue(value)
      }
      rows.push(row)
    }

    const allNodeIds = [...nodeIds]
    const selectedNodeIds = allNodeIds.slice(0, MAX_GRAPH_NODES)
    const [nodes, edges] = await Promise.all([
      nodeMetadata(session, selectedNodeIds, organizationId),
      inducedEdges(session, selectedNodeIds, organizationId),
    ])

    return {
      rows,
      nodes,
      edges,
      truncated: allNodeIds.length > MAX_GRAPH_NODES || result.records.length >= MAX_ROWS,
      durationMs: Math.round(performance.now() - startedAt),
    }
  } catch (error) {
    if (error instanceof ExploreQueryError) throw error
    throw new ExploreQueryError(error instanceof Error ? error.message : "Échec de la requête Neo4j.")
  } finally {
    await session.close()
  }
}
