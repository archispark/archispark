/**
 * Regression test for "rapports-architecture"'s Postgres panel queries
 * (packages/db/drizzle-pg/0038_rapports_architecture_datasource_postgres.sql),
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
  views,
} from "@workspace/db"
import { executePostgresQuery } from "./datasource-executors/postgres"
import {
  migrationPanelQuery,
  readMigrationDefinition,
} from "./migration-fixtures"

const definition = readMigrationDefinition(
  "0038_rapports_architecture_datasource_postgres.sql"
)

describe("rapports-architecture panel queries (0038 migration)", () => {
  let organizationId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `rapports-architecture-test-${randomUUID()}`,
        name: "Rapports Architecture Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Rapports Architecture Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    const workspaceId = ws!.id

    const businessActor = randomUUID()
    const appComponent = randomUUID()
    const node = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: businessActor, type: "BusinessActor", name: "A1" },
      {
        workspaceId,
        uuid: appComponent,
        type: "ApplicationComponent",
        name: "A2",
      },
      { workspaceId, uuid: node, type: "Node", name: "A3" },
    ])
    await db.insert(relationships).values({
      workspaceId,
      uuid: randomUUID(),
      type: "Serving",
      sourceUuid: businessActor,
      targetUuid: appComponent,
    })
    await db
      .insert(views)
      .values({ workspaceId, uuid: randomUUID(), name: "View 1" })
  })

  it("counts elements", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "elements"),
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 3 }])
  })

  it("counts relationships", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "relations"),
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 1 }])
  })

  it("counts views", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "vues"),
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 1 }])
  })

  it("counts distinct ArchiMate layers (Business, Application, Technology)", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "couches"),
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 3 }])
  })
})
