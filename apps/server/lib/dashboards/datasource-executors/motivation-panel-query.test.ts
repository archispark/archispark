/**
 * Regression test for the "motivation" system dashboard's Postgres panel
 * query (`packages/db/drizzle-pg/0035_motivation_datasource_postgres.sql`).
 * `MOTIVATION_QUERY_TEXT` below must be kept byte-identical to that
 * migration's `panels[0].panel.query.text` — see its header comment for why
 * this two-pass (forward/reverse breadth-first) shape was chosen over a
 * literal Cypher translation.
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
import { executePostgresQuery } from "./postgres"
import type { PanelContent } from "../contracts"

const MOTIVATION_QUERY_TEXT = `SELECT array_agg(DISTINCT node_id) AS "nodeIds", $driverId AS "emphasizedId"
FROM (
  WITH RECURSIVE
  fwd(node_id, node_type, depth, visited) AS (
      SELECT e.uuid, e.type, 0, ARRAY[e.uuid]
    FROM elements e
    JOIN workspaces w ON w.id = e.workspace_id
    WHERE w.organization_id = $organizationId AND e.uuid = $driverId AND e.type = 'Driver'
      UNION ALL
      SELECT ne.uuid, ne.type, fwd.depth + 1, fwd.visited || ne.uuid
      FROM fwd
      JOIN relationships r ON r.source_uuid = fwd.node_id OR r.target_uuid = fwd.node_id
      JOIN workspaces rw ON rw.id = r.workspace_id
      JOIN elements ne ON ne.uuid = CASE WHEN r.source_uuid = fwd.node_id THEN r.target_uuid ELSE r.source_uuid END
      JOIN workspaces nw ON nw.id = ne.workspace_id
      WHERE fwd.depth < 5
        AND rw.organization_id = $organizationId
        AND nw.organization_id = $organizationId
        AND r.type IN ('Composition', 'Aggregation', 'Assignment', 'Realization', 'Serving', 'Access', 'Influence', 'Triggering', 'Flow', 'Specialization', 'Association')
        AND ne.type IN ('Driver', 'Assessment', 'Goal', 'Outcome')
        AND NOT (ne.uuid = ANY(fwd.visited))
    ),
  fwd_min AS (
    SELECT node_id, node_type, min(depth) AS depth FROM fwd GROUP BY node_id, node_type
  ),
  targets AS (
    SELECT node_id FROM fwd_min WHERE node_type IN ('Assessment', 'Goal', 'Outcome')
  ),
  rev(node_id, depth, visited) AS (
    SELECT t.node_id, 0, ARRAY[t.node_id]
    FROM targets t
    UNION ALL
    SELECT ne.uuid, rev.depth + 1, rev.visited || ne.uuid
    FROM rev
    JOIN relationships r ON r.source_uuid = rev.node_id OR r.target_uuid = rev.node_id
    JOIN workspaces rw ON rw.id = r.workspace_id
    JOIN elements ne ON ne.uuid = CASE WHEN r.source_uuid = rev.node_id THEN r.target_uuid ELSE r.source_uuid END
    JOIN workspaces nw ON nw.id = ne.workspace_id
    WHERE rev.depth < 5
      AND rw.organization_id = $organizationId
      AND nw.organization_id = $organizationId
      AND r.type IN ('Composition', 'Aggregation', 'Assignment', 'Realization', 'Serving', 'Access', 'Influence', 'Triggering', 'Flow', 'Specialization', 'Association')
      AND ne.type IN ('Driver', 'Assessment', 'Goal', 'Outcome')
      AND NOT (ne.uuid = ANY(rev.visited))
  ),
  rev_min AS (
    SELECT node_id, min(depth) AS depth FROM rev GROUP BY node_id
  )
  SELECT fwd_min.node_id
  FROM fwd_min
  JOIN rev_min ON rev_min.node_id = fwd_min.node_id
  WHERE fwd_min.depth + rev_min.depth <= 5
  UNION
  SELECT node_id FROM fwd_min WHERE depth = 0
) AS reachable(node_id)`

function query(): PanelContent["query"] {
  return {
    datasourceId: "postgres-app-db",
    language: "sql",
    text: MOTIVATION_QUERY_TEXT,
  }
}

describe("motivation dashboard panel query (0035 migration)", () => {
  let organizationId: number
  let workspaceId: number

  beforeAll(async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        slug: `motivation-query-test-${randomUUID()}`,
        name: "Motivation Query Test Org",
      })
      .returning()
    organizationId = org!.id
    const [ws] = await db
      .insert(workspaces)
      .values({
        uuid: randomUUID(),
        name: "Motivation Query Test WS",
        organizationId,
        createdById: "test",
      })
      .returning()
    workspaceId = ws!.id
  })

  it("keeps just the driver when it has no motivation relationships", async () => {
    const driver = randomUUID()
    await db
      .insert(elements)
      .values([{ workspaceId, uuid: driver, type: "Driver", name: "Solo" }])
    const execution = await executePostgresQuery(
      query(),
      "graph",
      { driverId: driver },
      organizationId
    )
    expect(execution.rows[0]?.["nodeIds"]).toEqual([driver])
  })

  it("includes a Goal directly influenced by the driver", async () => {
    const driver = randomUUID()
    const goal = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: driver, type: "Driver", name: "D1" },
      { workspaceId, uuid: goal, type: "Goal", name: "G1" },
    ])
    await db
      .insert(relationships)
      .values({
        workspaceId,
        uuid: randomUUID(),
        type: "Influence",
        sourceUuid: driver,
        targetUuid: goal,
      })
    const execution = await executePostgresQuery(
      query(),
      "graph",
      { driverId: driver },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([driver, goal])
    )
  })

  it("relays through a secondary Driver two hops from a Goal, like the demo dataset", async () => {
    const driver = randomUUID()
    const secondaryDriver = randomUUID()
    const goal = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: driver, type: "Driver", name: "D1" },
      { workspaceId, uuid: secondaryDriver, type: "Driver", name: "D2" },
      { workspaceId, uuid: goal, type: "Goal", name: "G1" },
    ])
    await db.insert(relationships).values([
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Association",
        sourceUuid: driver,
        targetUuid: secondaryDriver,
      },
      {
        workspaceId,
        uuid: randomUUID(),
        type: "Influence",
        sourceUuid: secondaryDriver,
        targetUuid: goal,
      },
    ])
    const execution = await executePostgresQuery(
      query(),
      "graph",
      { driverId: driver },
      organizationId
    )
    expect(new Set(execution.rows[0]?.["nodeIds"] as string[])).toEqual(
      new Set([driver, secondaryDriver, goal])
    )
  })

  it("excludes an unrelated element type even when directly connected", async () => {
    const driver = randomUUID()
    const appComponent = randomUUID()
    await db.insert(elements).values([
      { workspaceId, uuid: driver, type: "Driver", name: "D1" },
      {
        workspaceId,
        uuid: appComponent,
        type: "ApplicationComponent",
        name: "App",
      },
    ])
    await db
      .insert(relationships)
      .values({
        workspaceId,
        uuid: randomUUID(),
        type: "Association",
        sourceUuid: driver,
        targetUuid: appComponent,
      })
    const execution = await executePostgresQuery(
      query(),
      "graph",
      { driverId: driver },
      organizationId
    )
    expect(execution.rows[0]?.["nodeIds"]).toEqual([driver])
  })
})
