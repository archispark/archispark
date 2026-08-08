import { describe, expect, it } from "vitest"
import {
  panelContentSchema,
  dashboardDefinitionSchema,
  panelVisualizationMetadataSchema,
  normalizePanelVisualizationId,
  type PanelContent,
} from "./contracts"

const validPanelContent: PanelContent = {
  title: "Acteurs métier servis par les composants applicatifs",
  description: "Liste les acteurs métier servis directement.",
  resultType: "table",
  query: {
    datasourceId: "architecture-neo4j",
    language: "cypher",
    text: "MATCH (:Element {type: 'ApplicationComponent'})-[:SERVING]->(target:Element {type: 'BusinessActor'})\nWHERE target.name IS NOT NULL AND target.layer = $couche AND target.organizationId = $organizationId\nWITH DISTINCT target ORDER BY target.name ASC LIMIT 500\nRETURN collect({id: target.id, name: target.name, type: target.type}) AS rows",
  },
  parameters: [
    {
      name: "couche",
      label: "Couche ArchiMate",
      type: "enum",
      required: false,
      defaultValue: "Business",
      allowedValues: ["Application", "Business"],
    },
  ],
  visualization: { type: "table" },
}

const validAnchoredPanelContent: PanelContent = {
  ...validPanelContent,
  title: "Acteurs métier",
  resultType: "graph",
  query: {
    datasourceId: "architecture-neo4j",
    language: "cypher",
    text: "MATCH (:Element {id: $appId, type: 'ApplicationComponent', organizationId: $organizationId})-[:COMPOSITION|AGGREGATION|ASSIGNMENT|REALIZATION|SERVING|ACCESS|INFLUENCE|TRIGGERING|FLOW|SPECIALIZATION|ASSOCIATION*1..2]-(target:Element)\nWHERE target.type IN ['BusinessActor', 'BusinessRole']\nWITH DISTINCT target LIMIT 500\nRETURN collect(target.id) AS nodeIds",
  },
  parameters: [{ name: "appId", label: "Application", type: "string", required: true }],
  visualization: { type: "graph" },
}

describe("panelContentSchema", () => {
  it("accepts a valid table panel", () => {
    expect(panelContentSchema.safeParse(validPanelContent).success).toBe(true)
  })

  it("accepts a valid graph panel", () => {
    expect(panelContentSchema.safeParse(validAnchoredPanelContent).success).toBe(true)
  })

  it("rejects an enum parameter without allowedValues", () => {
    const result = panelContentSchema.safeParse({
      ...validPanelContent,
      parameters: [{ name: "couche", label: "Couche", type: "enum", required: false }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a model-elements selector on a non-string parameter", () => {
    const result = panelContentSchema.safeParse({
      ...validPanelContent,
      parameters: [
        {
          name: "driverId",
          label: "Driver",
          type: "number",
          required: true,
          selector: { source: "model-elements", elementTypes: ["Driver"] },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rejects a visualization type incompatible with the result type", () => {
    const result = panelContentSchema.safeParse({ ...validPanelContent, visualization: { type: "graph" } })
    expect(result.success).toBe(false)
  })

  it("rejects column options on a non-table panel", () => {
    const result = panelContentSchema.safeParse({
      ...validAnchoredPanelContent,
      visualization: { type: "graph", columnOrder: ["id"] },
    })
    expect(result.success).toBe(false)
  })
})

describe("dashboardDefinitionSchema", () => {
  const panelContent = {
    ...validAnchoredPanelContent,
    parameters: [{ name: "appId", label: "Application", type: "string" as const, required: true }],
  }
  const valid = {
    id: "mon-dashboard",
    title: "Mon dashboard",
    description: "",
    category: "Tests",
    schemaVersion: 2 as const,
    parameters: [{ name: "scope", label: "Périmètre", type: "string" as const, required: true }],
    panels: [
      {
        id: "principal",
        panel: panelContent,
        layout: { x: 0, y: 0, width: 12, height: 4 },
        parameterBindings: { appId: { source: "dashboard" as const, parameter: "scope" } },
      },
    ],
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
    createdBy: "test",
    updatedBy: "test",
  }

  it("accepts a dashboard composed of panels", () => {
    expect(dashboardDefinitionSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects a duplicated panel instance id", () => {
    expect(
      dashboardDefinitionSchema.safeParse({ ...valid, panels: [valid.panels[0], valid.panels[0]] }).success
    ).toBe(false)
  })

  it("rejects a panel that overflows the 12-column grid", () => {
    expect(
      dashboardDefinitionSchema.safeParse({
        ...valid,
        panels: [{ ...valid.panels[0], layout: { x: 8, y: 0, width: 6, height: 4 } }],
      }).success
    ).toBe(false)
  })

  it("rejects a binding to an unknown dashboard parameter", () => {
    expect(
      dashboardDefinitionSchema.safeParse({
        ...valid,
        panels: [{ ...valid.panels[0], parameterBindings: { appId: { source: "dashboard", parameter: "absent" } } }],
      }).success
    ).toBe(false)
  })

  it("rejects a required panel parameter left unbound with no default", () => {
    expect(
      dashboardDefinitionSchema.safeParse({ ...valid, panels: [{ ...valid.panels[0], parameterBindings: {} }] })
        .success
    ).toBe(false)
  })

  it("accepts panels grouped into tabs", () => {
    expect(
      dashboardDefinitionSchema.safeParse({
        ...valid,
        tabGroups: [{ id: "details", tabs: [{ id: "principal", title: "Principal", panelIds: ["principal"] }] }],
      }).success
    ).toBe(true)
  })

  it("rejects a panel placed in more than one tab", () => {
    expect(
      dashboardDefinitionSchema.safeParse({
        ...valid,
        tabGroups: [
          {
            id: "details",
            tabs: [
              { id: "premier", title: "Premier", panelIds: ["principal"] },
              { id: "second", title: "Second", panelIds: ["principal"] },
            ],
          },
        ],
      }).success
    ).toBe(false)
  })
})

describe("normalizePanelVisualizationId", () => {
  it("maps legacy unnamespaced ids to core/* ids", () => {
    expect(normalizePanelVisualizationId("graph")).toBe("core/graph")
    expect(normalizePanelVisualizationId("table")).toBe("core/table")
    expect(normalizePanelVisualizationId("metric")).toBe("core/metric")
  })

  it("leaves already-namespaced ids untouched", () => {
    expect(normalizePanelVisualizationId("core/graph")).toBe("core/graph")
  })
})

describe("panelVisualizationMetadataSchema", () => {
  it("accepts a core visualization descriptor", () => {
    const result = panelVisualizationMetadataSchema.safeParse({
      id: "core/graph",
      name: "Graphe",
      description: "Vue graphe ReactFlow.",
      version: "1.0.0",
      acceptedResultTypes: ["graph"],
      status: "active",
      options: [],
    })
    expect(result.success).toBe(true)
  })
})
