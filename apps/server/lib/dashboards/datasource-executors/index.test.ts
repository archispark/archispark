import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { db, organizations, fournisseurs } from "@workspace/db"
import { assertDashboardQueriesSafe, executeDatasourceQuery } from "./index"
import type { DashboardDefinition } from "../contracts"

function dashboardWithQuery(language: "cypher" | "sql", text: string): DashboardDefinition {
  const now = new Date().toISOString()
  return {
    id: "d",
    title: "D",
    description: "",
    category: "Tests",
    schemaVersion: 2,
    parameters: [],
    panels: [
      {
        id: "p",
        panel: {
          title: "Panneau",
          description: "",
          resultType: "metrics",
          query: {
            datasourceId: language === "sql" ? "postgres-app-db" : "architecture-neo4j",
            language,
            text,
          },
          parameters: [],
          visualization: { type: "metric" },
        },
        layout: { x: 0, y: 0, width: 12, height: 4 },
        parameterBindings: {},
      },
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: "test",
    updatedBy: "test",
  }
}

describe("assertDashboardQueriesSafe", () => {
  it("accepts an organization-scoped Cypher panel", () => {
    expect(() =>
      assertDashboardQueriesSafe(
        dashboardWithQuery("cypher", "MATCH (e:Element {organizationId: $organizationId}) RETURN count(e) AS count")
      )
    ).not.toThrow()
  })

  it("accepts an organization-scoped SQL panel", () => {
    expect(() =>
      assertDashboardQueriesSafe(
        dashboardWithQuery("sql", "SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId")
      )
    ).not.toThrow()
  })

  it("rejects an unscoped SQL panel, naming the offending panel", () => {
    expect(() =>
      assertDashboardQueriesSafe(dashboardWithQuery("sql", "SELECT count(*)::integer AS count FROM fournisseurs"))
    ).toThrow(/Panneau « Panneau ».*organizationId/s)
  })

  it("rejects a write SQL panel", () => {
    expect(() =>
      assertDashboardQueriesSafe(dashboardWithQuery("sql", "DELETE FROM fournisseurs WHERE organization_id = $organizationId"))
    ).toThrow(/SELECT unique/)
  })
})

describe("executeDatasourceQuery", () => {
  let organizationId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({ slug: `datasource-index-test-${randomUUID()}`, name: "Datasource Index Test Org" })
      .returning()
    organizationId = org!.id
    await db.insert(fournisseurs).values([{ organizationId, nom: "Un fournisseur", actif: true }])
  })

  it("routes a SQL panel query to the Postgres executor", async () => {
    const execution = await executeDatasourceQuery(
      { datasourceId: "postgres-app-db", language: "sql", text: "SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId" },
      "metrics",
      {},
      organizationId
    )
    expect(execution.rows).toEqual([{ count: 1 }])
  })
})
