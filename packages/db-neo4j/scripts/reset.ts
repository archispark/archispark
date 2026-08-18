/**
 * Remove all ArchiSpark graph data while preserving Neo4j schema migrations,
 * constraints, and indexes. Reusable core in `../src/reset-graph-data.ts`.
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

const { resetGraphData } = await import("../src/reset-graph-data.js")
const { closeDriver } = await import("../src/connection.js")

try {
  const { deleted } = await resetGraphData()
  console.log(`Reset ${deleted} Neo4j node(s).`)
} finally {
  await closeDriver()
}
