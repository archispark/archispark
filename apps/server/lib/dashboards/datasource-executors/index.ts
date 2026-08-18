/**
 * Point d'entrée unique des exécuteurs de datasource — route une requête de
 * panneau vers `neo4j.ts` (Cypher) ou `postgres.ts` (SQL) selon
 * `query.language`, et valide toute requête de panneau à l'enregistrement
 * d'une révision de dashboard (voir app/api/dashboards/**).
 */
import type { DashboardDefinition, PanelContent, PanelResult } from "../contracts"
import {
  assertPanelQuerySafe as assertCypherQuerySafe,
  boundedCypher,
  executeNeo4jQuery,
  inducedEdges,
  nodeMetadata,
} from "./neo4j"
import { assertPanelQuerySafe as assertSqlQuerySafe, executePostgresQuery } from "./postgres"
import { classifyDatasourceFailure, normalizeExecution } from "./shared"
import type {
  DatasourceExecution,
  DatasourceFailureCode,
  GraphEdgeRow,
  GraphNodeRow,
  QueryParameters,
  QueryRow,
} from "./shared"

export { boundedCypher, inducedEdges, nodeMetadata, classifyDatasourceFailure }
export type { DatasourceExecution, DatasourceFailureCode, GraphEdgeRow, GraphNodeRow, QueryParameters, QueryRow, PanelResult }

/** Validates every embedded panel's query at dashboard-save time — throws with the offending panel's title in the message. */
export function assertDashboardQueriesSafe(definition: DashboardDefinition): void {
  for (const instance of definition.panels) {
    try {
      const { language, text } = instance.panel.query
      if (language === "sql") assertSqlQuerySafe(text)
      else assertCypherQuerySafe(text)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Panneau « ${instance.panel.title} » (${instance.id}) : ${message}`)
    }
  }
}

export async function executeDatasourceQuery(
  query: PanelContent["query"],
  resultType: PanelContent["resultType"],
  parameters: QueryParameters,
  organizationId: number
): Promise<DatasourceExecution> {
  const execution =
    query.language === "sql"
      ? await executePostgresQuery(query, resultType, parameters, organizationId)
      : await executeNeo4jQuery(query, resultType, parameters, organizationId)
  return normalizeExecution(execution)
}
