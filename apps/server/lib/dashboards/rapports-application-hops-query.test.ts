/**
 * Regression test for "rapports-application"'s "acteurs-metier" and
 * "fonctions-metier" panel queries
 * (packages/db/drizzle-pg/0037_rapports_application_datasource_postgres.sql),
 * read directly from the migration so this always exercises the shipped
 * SQL. The property/rankGroup-driven panels are covered separately in
 * rapports-application-technology-query.test.ts.
 */
import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import {
  db,
  organizations,
  workspaces,
  elements,
  relationships,
} from "@workspace/db"
import { executePostgresQuery } from "./datasource-executors/postgres"
import {
  migrationPanelQuery,
  readMigrationDefinition,
} from "./migration-fixtures"

const definition = readMigrationDefinition(
  "0037_rapports_application_datasource_postgres.sql"
)

describe("rapports-application hop-based panel queries (0037 migration)", () => {
  let organizationId: number
  let workspaceId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `rapp-hops-test-${randomUUID()}`,
        name: "Rapports App Hops Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Rapports App Hops Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    workspaceId = ws!.id
  })

  it("acteurs-metier finds a directly served BusinessActor (1 hop) and one reached via an intermediate ApplicationComponent (2 hops)", async () => {
    const app = randomUUID()
    const directActor = randomUUID()
    const midApp = randomUUID()
    const indirectRole = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: app, type: "ApplicationComponent", name: "App" },
      { workspaceId, uuid: directActor, type: "BusinessActor", name: "Direct" },
      { workspaceId, uuid: midApp, type: "ApplicationComponent", name: "Mid" },
      {
        workspaceId,
        uuid: indirectRole,
        type: "BusinessRole",
        name: "Indirect",
      },
    ])
    await db.insert(relationships).values([
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Serving",
        sourceUuid: app,
        targetUuid: directActor,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Composition",
        sourceUuid: app,
        targetUuid: midApp,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Assignment",
        sourceUuid: midApp,
        targetUuid: indirectRole,
      },
    ])
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "acteurs-metier"),
      "graph",
      { appId: app },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([directActor, indirectRole])
    )
  })

  it("fonctions-metier returns the root plus directly linked ApplicationComponents", async () => {
    const app = randomUUID()
    const other = randomUUID()
    const nonApp = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: app, type: "ApplicationComponent", name: "Root" },
      { workspaceId, uuid: other, type: "ApplicationComponent", name: "Other" },
      { workspaceId, uuid: nonApp, type: "BusinessActor", name: "NonApp" },
    ])
    await db.insert(relationships).values([
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Association",
        sourceUuid: app,
        targetUuid: other,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Serving",
        sourceUuid: app,
        targetUuid: nonApp,
      },
    ])
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "fonctions-metier"),
      "graph",
      { appId: app },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([app, other])
    )
    expect(execution.rows[0]?.["emphasizedId"]).toBe(app)
  })

  it("fonctions-metier returns nothing when the app doesn't exist", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "fonctions-metier"),
      "graph",
      { appId: randomUUID() },
      organizationId
    )
    expect(execution.rows).toEqual([])
  })
})
