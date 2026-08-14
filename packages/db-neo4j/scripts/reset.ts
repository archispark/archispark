/**
 * Remove all ArchiSpark graph data while preserving Neo4j schema migrations,
 * constraints, and indexes.
 *
 * Usage:
 *   NEO4J_URI=<uri> NEO4J_USER=<user> NEO4J_PASSWORD=<password> \
 *     pnpm --filter @workspace/db-neo4j reset
 */

import "@workspace/env/register"

if (!process.env["NEO4J_URI"]) {
  console.error("Missing NEO4J_URI.")
  process.exit(1)
}

const { getDriver, closeDriver } = await import("../src/connection.js")

try {
  const result = await getDriver().executeQuery(
    "MATCH (n) WHERE NOT n:SchemaMigration DETACH DELETE n RETURN count(n) AS deleted"
  )
  const deleted = result.records[0]?.get("deleted")
  console.log(`Reset ${String(deleted ?? 0)} Neo4j node(s).`)
} finally {
  await closeDriver()
}
