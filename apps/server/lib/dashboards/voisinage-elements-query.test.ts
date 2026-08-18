/**
 * Regression test for "voisinage-elements"'s Postgres panel queries
 * (packages/db/drizzle-pg/0039_voisinage_elements_datasource_postgres.sql),
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
  elementProperties,
  propertyDefinitions,
} from "@workspace/db"
import { eq } from "drizzle-orm"
import { executePostgresQuery } from "./datasource-executors/postgres"
import {
  migrationPanelQuery,
  readMigrationDefinition,
} from "./migration-fixtures"

const definition = readMigrationDefinition(
  "0039_voisinage_elements_datasource_postgres.sql"
)

describe("voisinage-elements panel queries (0039 migration)", () => {
  let organizationId: number
  let workspaceId: number
  let root: string
  let neighbor: string

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `voisinage-test-${randomUUID()}`,
        name: "Voisinage Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Voisinage Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    workspaceId = ws!.id

    root = randomUUID()
    neighbor = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: root, type: "ApplicationComponent", name: "Root" },
      { workspaceId, uuid: neighbor, type: "BusinessActor", name: "Neighbor" },
    ])
    await db
      .insert(relationships)
      .values({
        workspaceId,
        uuid: randomUUID(),
        type: "Serving",
        sourceUuid: root,
        targetUuid: neighbor,
      })

    const [rootRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, root))
    const [propDef] = await db
      .insert(propertyDefinitions)
      .values({
        workspaceId,
        uuid: randomUUID(),
        name: "Criticité",
        type: "string",
      })
      .returning()
    await db
      .insert(elementProperties)
      .values({
        elementId: rootRow!.id,
        propertyDefUuid: propDef!.uuid,
        value: "Haute",
      })
  })

  it("returns root + 1-hop neighbors with emphasizedId", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "graphe-voisinage"),
      "graph",
      { elementId: root },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([root, neighbor])
    )
    expect(execution.rows[0]?.["emphasizedId"]).toBe(root)
  })

  it("returns no rows when the element doesn't exist", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "graphe-voisinage"),
      "graph",
      { elementId: randomUUID() },
      organizationId
    )
    expect(execution.rows).toEqual([])
  })

  it("lists properties as Nom/Valeur rows", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "proprietes"),
      "table",
      { elementId: root },
      organizationId
    )
    expect(execution.rows[0]?.["rows"]).toEqual([
      { Nom: "Criticité", Valeur: "Haute" },
    ])
  })

  it("lists relations with Direction/Relation/Élément/Type/Couche", async () => {
    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "relations"),
      "table",
      { elementId: root },
      organizationId
    )
    expect(execution.rows[0]?.["rows"]).toEqual([
      {
        Direction: "Sortante",
        Relation: "Serving",
        Élément: "Neighbor",
        Type: "BusinessActor",
        Couche: "Business",
      },
    ])
  })
})
