/**
 * Types et normalisation communs aux exécuteurs de datasource (neo4j.ts,
 * postgres.ts) — voir index.ts pour le routage.
 */

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

/** Normalizes every row's values to JSON-safe types (neo4j-driver Integer/DateTime wrappers, pg bigint/Date). */
export function normalizeExecution(execution: DatasourceExecution): DatasourceExecution {
  return {
    rows: execution.rows.map((row) => jsonValue(row) as QueryRow),
    nodes: execution.nodes,
    edges: execution.edges,
  }
}
