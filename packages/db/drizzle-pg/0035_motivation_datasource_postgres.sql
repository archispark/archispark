-- 0032_dashboard_system_seed.sql seeded the "motivation" dashboard's single
-- panel pointing at architecture-neo4j (Cypher) because ArchiSpark only
-- exposed a Neo4j datasource at the time. Following
-- 0034_demonstration_datasources_postgres.sql's precedent, point it at the
-- native Postgres datasource (apps/server/lib/dashboards/contracts.ts's
-- POSTGRES_DATASOURCE) instead, over "elements"/"relationships"
-- (packages/db/src/schema.ts).
--
-- The original Cypher matched every simple path of length 1..5 from the
-- driver, through Composition/Aggregation/Assignment/Realization/Serving/
-- Access/Influence/Triggering/Flow/Specialization/Association relationships,
-- confined at every hop to Driver/Assessment/Goal/Outcome elements and
-- ending on an Assessment/Goal/Outcome, then collected every node on every
-- such path (including intermediate Drivers relayed through, which the demo
-- dataset's model actually contains — e.g. "Stakeholder satisfaction" ->
-- "Sales target" -> a Goal). A single recursive SQL SELECT can't enumerate
-- "every node on every path" the way Cypher does, so the query below
-- approximates it with two bounded breadth-first searches over the same
-- allowed-type/allowed-relationship subgraph: "fwd" from the driver records
-- each reachable node's shortest depth; "rev" does the same backwards from
-- every Assessment/Goal/Outcome "fwd" found. A node is kept when
-- fwd_depth + rev_depth <= 5 — i.e. some shortest driver->node and
-- node->target combination fits the same 5-hop budget Cypher enforced.
-- This matches Cypher exactly whenever the shortest path through a node is
-- also a valid (non-node-repeating) path, true for the demo data and for
-- any tree-shaped or acyclic motivation chain; it can only diverge from
-- Cypher's output on a graph dense enough that the shortest driver->node and
-- node->target routes overlap on a shared intermediate node, an edge case
-- judged acceptable for this reporting dashboard.
UPDATE "dashboard_revisions" AS dr
SET "definition" = $def$
{"id": "motivation", "title": "Chaîne de motivation par driver", "description": "Affiche les Drivers, Assessments, Goals et Outcomes reliés au driver sélectionné.", "category": "Motivation", "schemaVersion": 2, "parameters": [{"name": "driverId", "label": "Driver", "type": "string", "required": true, "selector": {"source": "model-elements", "elementTypes": ["Driver"]}}], "panels": [{"id": "chaine-motivation", "panel": {"title": "Chaîne de motivation par driver", "description": "Affiche les Drivers, Assessments, Goals et Outcomes reliés au driver sélectionné.", "resultType": "graph", "parameters": [{"name": "driverId", "label": "Driver", "type": "string", "required": true, "selector": {"source": "model-elements", "elementTypes": ["Driver"]}}], "visualization": {"colorByProperty": "type", "type": "graph"}, "query": {"datasourceId": "postgres-app-db", "language": "sql", "text": "SELECT array_agg(DISTINCT node_id) AS \"nodeIds\", $driverId AS \"emphasizedId\"\nFROM (\n  WITH RECURSIVE\n  fwd(node_id, node_type, depth, visited) AS (\n      SELECT e.uuid, e.type, 0, ARRAY[e.uuid]\n    FROM elements e\n    JOIN workspaces w ON w.id = e.workspace_id\n    WHERE w.organization_id = $organizationId AND e.uuid = $driverId AND e.type = 'Driver'\n      UNION ALL\n      SELECT ne.uuid, ne.type, fwd.depth + 1, fwd.visited || ne.uuid\n      FROM fwd\n      JOIN relationships r ON r.source_uuid = fwd.node_id OR r.target_uuid = fwd.node_id\n      JOIN workspaces rw ON rw.id = r.workspace_id\n      JOIN elements ne ON ne.uuid = CASE WHEN r.source_uuid = fwd.node_id THEN r.target_uuid ELSE r.source_uuid END\n      JOIN workspaces nw ON nw.id = ne.workspace_id\n      WHERE fwd.depth < 5\n        AND rw.organization_id = $organizationId\n        AND nw.organization_id = $organizationId\n        AND r.type IN ('Composition', 'Aggregation', 'Assignment', 'Realization', 'Serving', 'Access', 'Influence', 'Triggering', 'Flow', 'Specialization', 'Association')\n        AND ne.type IN ('Driver', 'Assessment', 'Goal', 'Outcome')\n        AND NOT (ne.uuid = ANY(fwd.visited))\n    ),\n  fwd_min AS (\n    SELECT node_id, node_type, min(depth) AS depth FROM fwd GROUP BY node_id, node_type\n  ),\n  targets AS (\n    SELECT node_id FROM fwd_min WHERE node_type IN ('Assessment', 'Goal', 'Outcome')\n  ),\n  rev(node_id, depth, visited) AS (\n    SELECT t.node_id, 0, ARRAY[t.node_id]\n    FROM targets t\n    UNION ALL\n    SELECT ne.uuid, rev.depth + 1, rev.visited || ne.uuid\n    FROM rev\n    JOIN relationships r ON r.source_uuid = rev.node_id OR r.target_uuid = rev.node_id\n    JOIN workspaces rw ON rw.id = r.workspace_id\n    JOIN elements ne ON ne.uuid = CASE WHEN r.source_uuid = rev.node_id THEN r.target_uuid ELSE r.source_uuid END\n    JOIN workspaces nw ON nw.id = ne.workspace_id\n    WHERE rev.depth < 5\n      AND rw.organization_id = $organizationId\n      AND nw.organization_id = $organizationId\n      AND r.type IN ('Composition', 'Aggregation', 'Assignment', 'Realization', 'Serving', 'Access', 'Influence', 'Triggering', 'Flow', 'Specialization', 'Association')\n      AND ne.type IN ('Driver', 'Assessment', 'Goal', 'Outcome')\n      AND NOT (ne.uuid = ANY(rev.visited))\n  ),\n  rev_min AS (\n    SELECT node_id, min(depth) AS depth FROM rev GROUP BY node_id\n  )\n  SELECT fwd_min.node_id\n  FROM fwd_min\n  JOIN rev_min ON rev_min.node_id = fwd_min.node_id\n  WHERE fwd_min.depth + rev_min.depth <= 5\n  UNION\n  SELECT node_id FROM fwd_min WHERE depth = 0\n) AS reachable(node_id)"}}, "layout": {"x": 0, "y": 0, "width": 12, "height": 8}, "parameterBindings": {"driverId": {"source": "dashboard", "parameter": "driverId"}}}], "createdAt": "2026-08-07T00:00:00.000Z", "updatedAt": "2026-08-17T02:00:00.000Z", "createdBy": "christophe.lacombe", "updatedBy": "system"}
$def$::jsonb
FROM "dashboards" AS dd
WHERE dr."dashboard_id" = dd."id"
  AND dd."dashboard_id" = 'motivation'
  AND dd."workspace_id" IS NULL
  AND dr."revision" = 1;
