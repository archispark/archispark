import { describe, expect, it } from "vitest"
import { datasourceTypesUsed } from "./datasource-badge"
import type { DashboardDefinition } from "./contracts"

function panel(id: string, datasourceId: string): DashboardDefinition["panels"][number] {
  return {
    id,
    panel: {
      title: id,
      description: "",
      resultType: "metrics",
      query: { datasourceId, language: "cypher", text: "RETURN 1 AS count" },
      parameters: [],
      visualization: { type: "metric" },
    },
    layout: { x: 0, y: 0, width: 12, height: 4 },
    parameterBindings: {},
  }
}

function definition(panels: DashboardDefinition["panels"]): DashboardDefinition {
  const now = new Date().toISOString()
  return {
    id: "dashboard",
    title: "Dashboard",
    description: "",
    category: "Tests",
    schemaVersion: 2,
    parameters: [],
    panels,
    createdAt: now,
    updatedAt: now,
    createdBy: "test-user",
    updatedBy: "test-user",
  }
}

describe("datasourceTypesUsed", () => {
  it("returns the single datasource type of a mono-panel dashboard", () => {
    const dashboard = definition([panel("principal", "architecture-neo4j")])
    expect(datasourceTypesUsed(dashboard)).toEqual(["neo4j"])
  })

  it("deduplicates when multiple panels share the same datasource", () => {
    const dashboard = definition([
      panel("premier", "architecture-neo4j"),
      panel("second", "architecture-neo4j"),
    ])
    expect(datasourceTypesUsed(dashboard)).toEqual(["neo4j"])
  })
})
