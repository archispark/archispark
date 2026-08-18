/**
 * Regression test for "vue-architecture-applicative"'s Postgres panel
 * queries (packages/db/drizzle-pg/0040_vue_architecture_applicative_datasource_postgres.sql),
 * read directly from the migration so this always exercises the shipped SQL.
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
  "0040_vue_architecture_applicative_datasource_postgres.sql"
)

describe("vue-architecture-applicative panel queries (0040 migration)", () => {
  let organizationId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `vue-app-test-${randomUUID()}`,
        name: "Vue App Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Vue App Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    const workspaceId = ws!.id

    const app1 = randomUUID()
    const app2 = randomUUID()
    const documentedApp = randomUUID()
    const actor = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: app1, type: "ApplicationComponent", name: "App 1" },
      { workspaceId, uuid: app2, type: "ApplicationComponent", name: "App 2" },
      {
        workspaceId,
        uuid: documentedApp,
        type: "ApplicationComponent",
        name: "App 3",
        description: "Documented",
      },
      { workspaceId, uuid: actor, type: "BusinessActor", name: "Actor" },
    ])
    await db.insert(relationships).values([
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Flow",
        sourceUuid: app1,
        targetUuid: app2,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Serving",
        sourceUuid: app1,
        targetUuid: actor,
      },
    ])
  })

  it("finds ApplicationComponents connected by a Flow", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "composants-connectes"),
      "graph",
      {},
      organizationId
    )
    expect(execution.rows[0]?.["nodeIds"]).toHaveLength(1)
  })

  it("counts ApplicationComponents without documentation", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "sans-documentation"),
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 2 }])
  })

  it("lists BusinessActors served, filtered by the couche parameter", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "acteurs-servis"),
      "table",
      { couche: "Business" },
      organizationId
    )
    expect(execution.rows[0]?.["rows"]).toHaveLength(1)
  })

  it("returns nothing when the couche parameter doesn't match BusinessActor's actual layer", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "acteurs-servis"),
      "table",
      { couche: "Application" },
      organizationId
    )
    expect(execution.rows[0]?.["rows"]).toEqual([])
  })
})
