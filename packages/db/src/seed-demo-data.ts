/**
 * Seeds the ArchiMate demo data (ArchiMetal, ArchiSurance, Open Day) into
 * their demo organizations — the reusable core of
 * `packages/db/scripts/seed-demo.ts`, shared with the demo reset cron.
 * `resolveUserId` plugs in either Keycloak's `findUserByUsername` or the
 * local-accounts `findLocalUserIdByUsername` (see `seed-demo-organizations.ts`).
 */

import { readFileSync } from "fs"
import { sql } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { seedsPath } from "./seeds-path.js"
import { seedDemoOrganizations, type DemoOrgsFile } from "./seed-demo-organizations.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface SeedDemoWorkspacesResult {
  orgIdByWorkspace: Map<string, number>
}

function organizationIdPlaceholder(workspace: string): string {
  return `__${workspace.toUpperCase().replace(/[^A-Z0-9]/g, "")}_ORGANIZATION_ID__`
}

export async function seedDemoWorkspaces(
  resolveUserId: (username: string) => Promise<string>,
  database: Db = defaultDb
): Promise<SeedDemoWorkspacesResult> {
  const demoOrgsFile: DemoOrgsFile = JSON.parse(
    readFileSync(seedsPath("demo-orgs.json"), "utf-8")
  )
  const sqlTemplate = readFileSync(seedsPath("demo.sql"), "utf-8")

  const archiId = await resolveUserId("archi")
  const orgIdByWorkspace = await seedDemoOrganizations(
    demoOrgsFile,
    resolveUserId,
    database
  )

  let sqlText = sqlTemplate.replaceAll("'__CREATED_BY_ID__'", `'${archiId}'`)
  for (const [workspace, orgId] of orgIdByWorkspace) {
    sqlText = sqlText.replaceAll(
      organizationIdPlaceholder(workspace),
      String(orgId)
    )
  }

  await database.execute(sql.raw(sqlText))

  return { orgIdByWorkspace }
}
