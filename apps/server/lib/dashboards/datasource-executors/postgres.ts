/**
 * Exécution des requêtes SQL d'un panneau contre la base applicative
 * PostgreSQL d'ArchiSpark elle-même (`@workspace/db`, le même schéma Drizzle
 * que le reste du produit — voir docs/architecture.md#dashboards).
 *
 * Scoping de sécurité multi-tenant : même contrat que neo4j.ts —
 * `organizationId` est injecté ici comme paramètre lié (jamais interpolé
 * dans le texte, écrit par l'auteur du panel) et `assertPanelQuerySafe`
 * exige statiquement que `$organizationId` soit référencé dans le texte, à
 * l'enregistrement d'une révision de dashboard (voir app/api/dashboards/**)
 * et de nouveau ici. En défense en profondeur supplémentaire (la base
 * applicative contient des données d'autres organisations, contrairement au
 * Neo4j dédié à l'export), la requête tourne dans une transaction
 * `READ ONLY` avec un `statement_timeout` court : même une requête mal
 * validée ne peut ni écrire, ni tourner indéfiniment.
 */
import { and, eq, inArray, sql, type SQL } from "drizzle-orm"
import { db, elements, relationships, workspaces } from "@workspace/db"
import type { PanelContent } from "../contracts"
import type {
  DatasourceExecution,
  GraphEdgeRow,
  GraphNodeRow,
  QueryParameters,
  QueryRow,
} from "./shared"

const MAX_ROWS = 500
const STATEMENT_TIMEOUT_MS = 10_000
const NAMED_PARAMETER = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g

/** Rejects anything but a single read-only SELECT statement (no `;`, no write/DDL keywords). */
export function assertReadOnly(text: string): void {
  const normalized = text.trim().replace(/;\s*$/, "")
  if (normalized.includes(";") || !/^SELECT\b/i.test(normalized)) {
    throw new Error("La requête SQL doit être une requête SELECT unique.")
  }
  if (
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|CALL|EXECUTE|MERGE)\b/i.test(
      normalized
    )
  ) {
    throw new Error("La requête SQL doit être une requête de lecture seule.")
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

/** Full static validation of a panel's SQL text — called both when a dashboard revision is saved and before every execution. */
export function assertPanelQuerySafe(text: string): void {
  assertReadOnly(text)
  assertOrganizationScoped(text)
}

export function boundedSelect(text: string): string {
  return `SELECT * FROM (\n${text.trim().replace(/;\s*$/, "")}\n) AS panel_query\nLIMIT ${MAX_ROWS}`
}

/**
 * Turns `$name` placeholders into a parameterized `SQL` query — each
 * occurrence becomes a Drizzle-bound value (positional `$n` for `pg` under
 * the hood), never a string interpolation. Throws if the text references a
 * name absent from `parameters`.
 */
export function bindNamedParameters(
  text: string,
  parameters: QueryParameters
): SQL {
  const chunks: SQL[] = []
  let lastIndex = 0
  for (const match of text.matchAll(NAMED_PARAMETER)) {
    const name = match[1]!
    if (!(name in parameters)) {
      throw new Error(
        `Le paramètre « ${name} » référencé par la requête n'est pas défini.`
      )
    }
    chunks.push(sql.raw(text.slice(lastIndex, match.index)))
    chunks.push(sql`${parameters[name]}`)
    lastIndex = match.index + match[0].length
  }
  chunks.push(sql.raw(text.slice(lastIndex)))
  return sql.join(chunks, sql``)
}

/** Name/type for a graph panel's selected node ids (`elements.uuid`), scoped to the same organization via their workspace — hydrates `nodeIds` into renderable nodes without loading the whole model. Mirrors neo4j.ts's `nodeMetadata`. */
export async function nodeMetadata(
  nodeIds: string[],
  organizationId: number
): Promise<GraphNodeRow[]> {
  if (nodeIds.length === 0) return []
  return db
    .select({ id: elements.uuid, name: elements.name, type: elements.type })
    .from(elements)
    .innerJoin(workspaces, eq(workspaces.id, elements.workspaceId))
    .where(
      and(
        eq(workspaces.organizationId, organizationId),
        inArray(elements.uuid, nodeIds)
      )
    )
}

/** Relationships induced between a graph panel's selected node ids, scoped to the same organization via their workspace. Mirrors neo4j.ts's `inducedEdges`. */
export async function inducedEdges(
  nodeIds: string[],
  organizationId: number
): Promise<GraphEdgeRow[]> {
  if (nodeIds.length === 0) return []
  return db
    .select({
      id: relationships.uuid,
      source: relationships.sourceUuid,
      target: relationships.targetUuid,
      type: relationships.type,
    })
    .from(relationships)
    .innerJoin(workspaces, eq(workspaces.id, relationships.workspaceId))
    .where(
      and(
        eq(workspaces.organizationId, organizationId),
        inArray(relationships.sourceUuid, nodeIds),
        inArray(relationships.targetUuid, nodeIds)
      )
    )
}

export async function executePostgresQuery(
  query: PanelContent["query"],
  resultType: PanelContent["resultType"],
  parameters: QueryParameters,
  organizationId: number
): Promise<DatasourceExecution> {
  assertPanelQuerySafe(query.text)
  const statement = bindNamedParameters(boundedSelect(query.text), {
    ...parameters,
    organizationId,
  })
  const rows = await db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    )
    await tx.execute(sql.raw("SET TRANSACTION READ ONLY"))
    const result = await tx.execute<QueryRow>(statement)
    return result.rows
  })
  if (resultType !== "graph") return { rows }
  const nodeIds = rows[0]?.["nodeIds"]
  if (
    !Array.isArray(nodeIds) ||
    !nodeIds.every((value) => typeof value === "string")
  )
    return { rows }
  const [edges, nodes] = await Promise.all([
    inducedEdges(nodeIds as string[], organizationId),
    nodeMetadata(nodeIds as string[], organizationId),
  ])
  return { rows, nodes, edges }
}
