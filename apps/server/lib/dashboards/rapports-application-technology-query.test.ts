/**
 * Regression test for "rapports-application"'s "composants-technologiques"
 * and "traceabilite-exigences" panel queries
 * (packages/db/drizzle-pg/0037_rapports_application_datasource_postgres.sql),
 * read directly from the migration so this always exercises the shipped
 * SQL. The hop-based panels are covered separately in
 * rapports-application-hops-query.test.ts.
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
  "0037_rapports_application_datasource_postgres.sql"
)

describe("rapports-application technology panel queries (0037 migration)", () => {
  let organizationId: number
  let workspaceId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `rapp-tech-test-${randomUUID()}`,
        name: "Rapports App Tech Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Rapports App Tech Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    workspaceId = ws!.id
  })

  it("composants-technologiques finds tech elements documented via the Application property, and rank-groups a root CommunicationNetwork and a TechnologyInterface", async () => {
    const app = randomUUID()
    const [propDef] = await db
      .insert(propertyDefinitions)
      .values({
        workspaceId,
        uuid: randomUUID(),
        name: "Application",
        type: "string",
      })
      .returning()
    const rootNetwork = randomUUID()
    const childNetwork = randomUUID()
    const techInterface = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: app, type: "ApplicationComponent", name: "MyApp" },
      {
        workspaceId,
        uuid: rootNetwork,
        type: "CommunicationNetwork",
        name: "Root Net",
      },
      {
        workspaceId,
        uuid: childNetwork,
        type: "CommunicationNetwork",
        name: "Child Net",
      },
      {
        workspaceId,
        uuid: techInterface,
        type: "TechnologyInterface",
        name: "Iface",
      },
    ])
    await db
      .insert(relationships)
      .values({
        workspaceId,
        uuid: randomUUID(),
        type: "Composition",
        sourceUuid: childNetwork,
        targetUuid: rootNetwork,
      })
    const [appRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, app))
    const [rootNetRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, rootNetwork))
    const [childNetRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, childNetwork))
    const [ifaceRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, techInterface))
    await db.insert(elementProperties).values([
      {
        elementId: rootNetRow!.id,
        propertyDefUuid: propDef!.uuid,
        value: appRow!.name,
      },
      {
        elementId: childNetRow!.id,
        propertyDefUuid: propDef!.uuid,
        value: appRow!.name,
      },
      {
        elementId: ifaceRow!.id,
        propertyDefUuid: propDef!.uuid,
        value: appRow!.name,
      },
    ])

    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "composants-technologiques"),
      "graph",
      { appId: app },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([rootNetwork, childNetwork, techInterface])
    )
    const rankGroups = execution.rows[0]?.["rankGroups"] as Array<{
      id: string
      rankGroup: string
    }>
    expect(rankGroups).toEqual(
      expect.arrayContaining([
        { id: rootNetwork, rankGroup: "subnet" },
        { id: techInterface, rankGroup: "private-endpoint" },
      ])
    )
    expect(rankGroups.some((r) => r.id === childNetwork)).toBe(false)
  })

  it("traceabilite-exigences includes only tech elements that realize a Requirement, plus the requirements they realize", async () => {
    const app = randomUUID()
    const [propDef] = await db
      .insert(propertyDefinitions)
      .values({
        workspaceId,
        uuid: randomUUID(),
        name: "Application",
        type: "string",
      })
      .returning()
    const realizingTech = randomUUID()
    const nonRealizingTech = randomUUID()
    const requirement = randomUUID()
    await db.insert(elements).values([
      {
        workspaceId,
        uuid: app,
        type: "ApplicationComponent",
        name: "TraceApp",
      },
      { workspaceId, uuid: realizingTech, type: "Node", name: "Realizing" },
      {
        workspaceId,
        uuid: nonRealizingTech,
        type: "Node",
        name: "NonRealizing",
      },
      { workspaceId, uuid: requirement, type: "Requirement", name: "Req" },
    ])
    await db
      .insert(relationships)
      .values({
        workspaceId,
        uuid: randomUUID(),
        type: "Realization",
        sourceUuid: realizingTech,
        targetUuid: requirement,
      })
    const [appRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, app))
    const [realizingRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, realizingTech))
    const [nonRealizingRow] = await db
      .select()
      .from(elements)
      .where(eq(elements.uuid, nonRealizingTech))
    await db.insert(elementProperties).values([
      {
        elementId: realizingRow!.id,
        propertyDefUuid: propDef!.uuid,
        value: appRow!.name,
      },
      {
        elementId: nonRealizingRow!.id,
        propertyDefUuid: propDef!.uuid,
        value: appRow!.name,
      },
    ])

    const execution = await executePostgresQuery(
      migrationPanelQuery(definition, "traceabilite-exigences"),
      "graph",
      { appId: app },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([realizingTech, requirement])
    )
  })
})
