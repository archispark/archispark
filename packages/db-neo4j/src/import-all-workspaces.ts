/**
 * Imports every workspace's ArchiMate model from PostgreSQL into Neo4j —
 * the reusable core of
 * `packages/db-neo4j/scripts/import-all-workspaces.ts` (`pnpm run
 * import:workspaces`).
 */

import { db as defaultDb, workspaces, organizations, modelFromDb } from "@workspace/db"
import { importModelToNeo4j } from "./import-model.js"
import type { Neo4jOrganizationParam } from "./mapping.js"
import { closeDriver } from "./connection.js"
import { MAX_IMPORT_ATTEMPTS, isRetriableNeo4jFailure, wait } from "./retry.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface ImportAllWorkspacesResult {
  imported: string[]
  failed: { name: string; error: string }[]
}

export async function importAllWorkspacesToNeo4j(
  database: Db = defaultDb
): Promise<ImportAllWorkspacesResult> {
  const allWorkspaces = await database.select().from(workspaces)
  const orgById = new Map<number, Neo4jOrganizationParam>(
    (await database.select().from(organizations)).map(
      (org: Neo4jOrganizationParam) => [org.id, org]
    )
  )

  const imported: string[] = []
  const failed: { name: string; error: string }[] = []

  for (const ws of allWorkspaces) {
    const org =
      ws.organizationId === null ? undefined : orgById.get(ws.organizationId)
    if (!org) {
      failed.push({
        name: ws.name,
        error: "no organization associated with this workspace",
      })
      continue
    }
    try {
      const model = await modelFromDb(ws.id)
      for (let attempt = 1; ; attempt++) {
        try {
          await importModelToNeo4j(model, org)
          break
        } catch (err) {
          if (!isRetriableNeo4jFailure(err) || attempt === MAX_IMPORT_ATTEMPTS) {
            throw err
          }
          await closeDriver()
          await wait(attempt * 1_000)
        }
      }
      imported.push(ws.name)
    } catch (err) {
      failed.push({
        name: ws.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { imported, failed }
}
