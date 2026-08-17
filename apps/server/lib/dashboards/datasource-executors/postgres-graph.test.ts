import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { db, organizations, workspaces, elements, relationships } from "@workspace/db"
import { executePostgresQuery, inducedEdges, nodeMetadata } from "./postgres"
import type { PanelContent } from "../contracts"

function query(text: string): PanelContent["query"] {
  return { datasourceId: "postgres-app-db", language: "sql", text }
}

describe("graph panel hydration (nodeMetadata/inducedEdges)", () => {
  let organizationId: number
  let driverUuid: string
  let goalUuid: string
  let otherOrgElementUuid: string

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `postgres-graph-test-${randomUUID()}`,
        name: "Postgres Graph Test Org",
      })
      .returning()
    organizationId = org!.id
    const [other] = await db
      .insert(organizations)
      .values({
        slug: `postgres-graph-test-other-${randomUUID()}`,
        name: "Other Org",
      })
      .returning()

    const [workspace] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Postgres Graph Test Workspace",
        organizationId,
        createdById: "test",
      })
      .returning()
    const [otherWorkspace] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Other Org Workspace",
        organizationId: other!.id,
        createdById: "test",
      })
      .returning()

    driverUuid = randomUUID()
    goalUuid = randomUUID()
    otherOrgElementUuid = randomUUID()
    await db.insert(elements).values([
      {
        workspaceId: workspace!.id,
        uuid: driverUuid,
        type: "Driver",
        name: "Croissance",
      },
      {
        workspaceId: workspace!.id,
        uuid: goalUuid,
        type: "Goal",
        name: "Augmenter le CA",
      },
      {
        workspaceId: otherWorkspace!.id,
        uuid: otherOrgElementUuid,
        type: "Goal",
        name: "Autre organisation",
      },
    ])
    await db.insert(relationships).values({
      workspaceId: workspace!.id,
      uuid: randomUUID(),
      type: "Influence",
      sourceUuid: driverUuid,
      targetUuid: goalUuid,
    })
  })

  it("resolves node metadata for the caller's organization only", async () => {
    const nodes = await nodeMetadata(
      [driverUuid, goalUuid, otherOrgElementUuid],
      organizationId
    )
    expect(nodes).toEqual(
      expect.arrayContaining([
        { id: driverUuid, name: "Croissance", type: "Driver" },
        { id: goalUuid, name: "Augmenter le CA", type: "Goal" },
      ])
    )
    expect(nodes.some((node) => node.id === otherOrgElementUuid)).toBe(false)
  })

  it("resolves relationships induced strictly between the given node ids", async () => {
    const edges = await inducedEdges([driverUuid, goalUuid], organizationId)
    expect(edges).toEqual([
      expect.objectContaining({
        source: driverUuid,
        target: goalUuid,
        type: "Influence",
      }),
    ])
  })

  it("hydrates nodes/edges for a graph panel, but leaves table/metrics panels untouched", async () => {
    const execution = await executePostgresQuery(
      query(
        `SELECT array_agg(e.uuid) AS "nodeIds", '${driverUuid}' AS "emphasizedId" FROM elements e JOIN workspaces w ON w.id = e.workspace_id WHERE w.organization_id = $organizationId AND e.uuid IN ('${driverUuid}', '${goalUuid}')`
      ),
      "graph",
      {},
      organizationId
    )
    expect(execution.rows[0]?.["emphasizedId"]).toBe(driverUuid)
    expect(execution.nodes).toEqual(
      expect.arrayContaining([
        { id: driverUuid, name: "Croissance", type: "Driver" },
        { id: goalUuid, name: "Augmenter le CA", type: "Goal" },
      ])
    )
    expect(execution.edges).toEqual([
      expect.objectContaining({ source: driverUuid, target: goalUuid }),
    ])

    const metricsExecution = await executePostgresQuery(
      query(
        "SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId"
      ),
      "metrics",
      {},
      organizationId
    )
    expect(metricsExecution.nodes).toBeUndefined()
    expect(metricsExecution.edges).toBeUndefined()
  })
})
