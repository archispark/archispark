import { describe, expect, it } from "vitest"
import {
  assertDashboardQueriesSafe,
  assertOrganizationScoped,
  assertPanelQuerySafe,
  assertReadOnly,
  boundedCypher,
  classifyDatasourceFailure,
} from "./datasource-executors"
import type { DashboardDefinition } from "./contracts"

describe("boundedCypher", () => {
  it("wraps the query and enforces a server-side row cap", () => {
    expect(boundedCypher("MATCH (n) RETURN n")).toContain("LIMIT 500")
  })
})

describe("assertReadOnly", () => {
  it("accepts a single read statement", () => {
    expect(() => assertReadOnly("MATCH (n) RETURN n")).not.toThrow()
    expect(() => assertReadOnly("OPTIONAL MATCH (n) RETURN n")).not.toThrow()
  })

  it("rejects multiple statements", () => {
    expect(() => assertReadOnly("MATCH (n); RETURN n")).toThrow(/lecture unique/)
  })

  it("rejects a write statement", () => {
    expect(() => assertReadOnly("CREATE (n) RETURN n")).toThrow(/lecture unique/)
  })
})

describe("assertOrganizationScoped", () => {
  it("accepts a query referencing $organizationId", () => {
    expect(() =>
      assertOrganizationScoped("MATCH (e:Element {organizationId: $organizationId}) RETURN e")
    ).not.toThrow()
  })

  it("rejects a query that doesn't reference $organizationId — the multi-tenant scoping contract", () => {
    expect(() => assertOrganizationScoped("MATCH (e:Element) RETURN e")).toThrow(/organizationId/)
  })
})

describe("assertPanelQuerySafe", () => {
  it("combines both checks", () => {
    expect(() =>
      assertPanelQuerySafe("MATCH (e:Element {organizationId: $organizationId}) RETURN e")
    ).not.toThrow()
    expect(() => assertPanelQuerySafe("MATCH (e:Element) RETURN e")).toThrow(/organizationId/)
    expect(() => assertPanelQuerySafe("CREATE (n) RETURN n")).toThrow(/lecture unique/)
  })
})

function dashboardWithQuery(text: string): DashboardDefinition {
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
          query: { datasourceId: "architecture-neo4j", language: "cypher", text },
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
  it("accepts a dashboard where every panel query is organization-scoped", () => {
    expect(() =>
      assertDashboardQueriesSafe(
        dashboardWithQuery("MATCH (e:Element {organizationId: $organizationId}) RETURN count(e) AS count")
      )
    ).not.toThrow()
  })

  it("rejects a dashboard with one unscoped panel query, naming the offending panel", () => {
    expect(() => assertDashboardQueriesSafe(dashboardWithQuery("MATCH (e:Element) RETURN count(e) AS count"))).toThrow(
      /Panneau « Panneau »/
    )
  })
})

describe("classifyDatasourceFailure", () => {
  it("categorizes timeout, unavailable and query errors", () => {
    expect(classifyDatasourceFailure("statement timeout")).toBe("timeout")
    expect(classifyDatasourceFailure("ECONNREFUSED")).toBe("unavailable")
    expect(classifyDatasourceFailure("erreur de syntaxe")).toBe("query")
  })
})
