// Standalone entry point copied into the production Docker image (see
// .docker/server/*/Dockerfile) and run by `docker compose run --rm migrate`
// (see .docker/docker-compose.prod.yml) — the only way migrations get
// applied in a self-hosted deployment; the `server` service never runs them
// automatically (see apps/server/instrumentation.ts).

import { runMigrations, runOrganizationBackfill } from "@workspace/db"
import {
  isNeo4jEnabled,
  runNeo4jMigrations,
  closeDriver,
} from "@workspace/db-neo4j"

try {
  await runMigrations()
  await runOrganizationBackfill()
  console.log("Postgres migrations and backfill applied.")

  if (isNeo4jEnabled()) {
    await runNeo4jMigrations()
    console.log("Neo4j migrations applied.")
  } else {
    console.log("Neo4j disabled (NEO4J_ENABLED=false), skipped.")
  }
} catch (err) {
  console.error("Migration failed:", err)
  process.exitCode = 1
} finally {
  await closeDriver()
  process.exit(process.exitCode ?? 0)
}
