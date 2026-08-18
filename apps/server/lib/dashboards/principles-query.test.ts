/**
 * Regression test for the "principles" system dashboard's Postgres panel
 * query (packages/db/drizzle-pg/0036_principles_datasource_postgres.sql),
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
  "0036_principles_datasource_postgres.sql"
)
const query = migrationPanelQuery(definition, "chaine-conformite")

describe("principles panel query (0036 migration)", () => {
  let organizationId: number
  let workspaceId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `principles-test-${randomUUID()}`,
        name: "Principles Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Principles Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    workspaceId = ws!.id
  })

  it("keeps just the principle when it has no requirements", async () => {
    const principle = randomUUID()
    await db
      .insert(elements)
      .values([{ workspaceId, uuid: principle, type: "Principle", name: "P1" }])
    const execution = await executePostgresQuery(
      query,
      "graph",
      { principleId: principle },
      organizationId
    )
    expect(execution.rows[0]?.["nodeIds"]).toEqual([principle])
    expect(execution.rows[0]?.["emphasizedId"]).toBe(principle)
  })

  it("falls back to principle + direct requirements when none have a constraint", async () => {
    const principle = randomUUID()
    const req1 = randomUUID()
    const req2 = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: principle, type: "Principle", name: "P2" },
      { workspaceId, uuid: req1, type: "Requirement", name: "R1" },
      { workspaceId, uuid: req2, type: "Requirement", name: "R2" },
    ])
    await db.insert(relationships).values([
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Realization",
        sourceUuid: req1,
        targetUuid: principle,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Realization",
        sourceUuid: req2,
        targetUuid: principle,
      },
    ])
    const execution = await executePostgresQuery(
      query,
      "graph",
      { principleId: principle },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([principle, req1, req2])
    )
  })

  it("keeps only requirements that chain to a constraint once at least one does", async () => {
    const principle = randomUUID()
    const reqWithConstraint = randomUUID()
    const reqWithoutConstraint = randomUUID()
    const constraint = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: principle, type: "Principle", name: "P3" },
      {
        workspaceId,
        uuid: reqWithConstraint,
        type: "Requirement",
        name: "R-with",
      },
      {
        workspaceId,
        uuid: reqWithoutConstraint,
        type: "Requirement",
        name: "R-without",
      },
      { workspaceId, uuid: constraint, type: "Constraint", name: "C1" },
    ])
    await db.insert(relationships).values([
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Realization",
        sourceUuid: reqWithConstraint,
        targetUuid: principle,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Realization",
        sourceUuid: reqWithoutConstraint,
        targetUuid: principle,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Realization",
        sourceUuid: constraint,
        targetUuid: reqWithConstraint,
      },
    ])
    const execution = await executePostgresQuery(
      query,
      "graph",
      { principleId: principle },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([principle, reqWithConstraint, constraint])
    )
  })

  it("returns no rows when the principle doesn't exist", async () => {
    const execution = await executePostgresQuery(
      query,
      "graph",
      { principleId: randomUUID() },
      organizationId
    )
    expect(execution.rows).toEqual([])
  })
})
