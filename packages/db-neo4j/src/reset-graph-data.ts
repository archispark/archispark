/**
 * Removes all ArchiSpark graph data while preserving Neo4j schema
 * migrations, constraints, and indexes — the reusable core of
 * `packages/db-neo4j/scripts/reset.ts`, also used by the demo reset cron.
 */

import { getDriver } from "./connection.js"

export interface ResetGraphDataResult {
  deleted: number
}

export async function resetGraphData(): Promise<ResetGraphDataResult> {
  const result = await getDriver().executeQuery(
    "MATCH (n) WHERE NOT n:SchemaMigration DETACH DELETE n RETURN count(n) AS deleted"
  )
  const deleted = result.records[0]?.get("deleted")
  return { deleted: Number(deleted ?? 0) }
}
