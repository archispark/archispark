-- 0032_dashboard_system_seed.sql seeded the "principles" dashboard's single
-- panel pointing at architecture-neo4j (Cypher) because ArchiSpark only
-- exposed a Neo4j datasource at the time. Following
-- 0034_demonstration_datasources_postgres.sql and
-- 0035_motivation_datasource_postgres.sql's precedent, point it at the
-- native Postgres datasource instead. Unlike "motivation", the original
-- Cypher here is a fixed 2-hop pattern (principle--requirement--constraint,
-- any relationship type, either direction), not a variable-length traversal,
-- so no recursion is needed: "requirements" collects elements of type
-- Requirement directly related to the principle; "constraint_pairs" collects
-- Constraint elements directly related to those requirements. When at least
-- one such pair exists, nodeIds keeps only the principle plus the
-- requirements/constraints that form a full chain (mirroring the source
-- query's reduce() over matched paths, which drops requirements with no
-- constraint once any other requirement has one); otherwise it falls back to
-- the principle plus every directly related requirement.
UPDATE "dashboard_revisions" AS dr
SET "definition" = $def$
{"id": "principles", "title": "Chaîne de conformité par principe", "description": "Affiche le principe sélectionné et les exigences et contraintes qui lui sont reliées.", "category": "Motivation", "schemaVersion": 2, "parameters": [{"name": "principleId", "label": "Principe", "type": "string", "required": true, "selector": {"source": "model-elements", "elementTypes": ["Principle"]}}], "panels": [{"id": "chaine-conformite", "panel": {"title": "Chaîne de conformité par principe", "description": "Affiche le principe sélectionné et les exigences et contraintes qui lui sont reliées.", "resultType": "graph", "parameters": [{"name": "principleId", "label": "Principe", "type": "string", "required": true, "selector": {"source": "model-elements", "elementTypes": ["Principle"]}}], "visualization": {"colorByProperty": "type", "type": "graph"}, "query": {"datasourceId": "postgres-app-db", "language": "sql", "text": "SELECT \"nodeIds\", \"emphasizedId\"\nFROM (\n  WITH principal AS (\n    SELECT e.uuid AS node_id\n    FROM elements e\n    JOIN workspaces w ON w.id = e.workspace_id\n    WHERE w.organization_id = $organizationId AND e.uuid = $principleId AND e.type = 'Principle'\n  ),\n  requirements AS (\n    SELECT DISTINCT ne.uuid AS node_id\n    FROM principal p\n    JOIN relationships r ON r.source_uuid = p.node_id OR r.target_uuid = p.node_id\n    JOIN workspaces rw ON rw.id = r.workspace_id\n    JOIN elements ne ON ne.uuid = CASE WHEN r.source_uuid = p.node_id THEN r.target_uuid ELSE r.source_uuid END\n    JOIN workspaces nw ON nw.id = ne.workspace_id\n    WHERE rw.organization_id = $organizationId\n      AND nw.organization_id = $organizationId\n      AND ne.type = 'Requirement'\n  ),\n  constraint_pairs AS (\n    SELECT DISTINCT req.node_id AS requirement_id, ce.uuid AS constraint_id\n    FROM requirements req\n    JOIN relationships r ON r.source_uuid = req.node_id OR r.target_uuid = req.node_id\n    JOIN workspaces rw ON rw.id = r.workspace_id\n    JOIN elements ce ON ce.uuid = CASE WHEN r.source_uuid = req.node_id THEN r.target_uuid ELSE r.source_uuid END\n    JOIN workspaces cw ON cw.id = ce.workspace_id\n    WHERE rw.organization_id = $organizationId\n      AND cw.organization_id = $organizationId\n      AND ce.type = 'Constraint'\n  )\n  SELECT\n    CASE\n      WHEN EXISTS (SELECT 1 FROM constraint_pairs) THEN (\n        SELECT array_agg(DISTINCT node_id) FROM (\n          SELECT node_id FROM principal\n          UNION SELECT requirement_id FROM constraint_pairs\n          UNION SELECT constraint_id FROM constraint_pairs\n        ) unioned\n      )\n      ELSE (\n        SELECT array_agg(DISTINCT node_id) FROM (\n          SELECT node_id FROM principal\n          UNION SELECT node_id FROM requirements\n        ) unioned\n      )\n    END AS \"nodeIds\",\n    (SELECT node_id FROM principal) AS \"emphasizedId\"\n  WHERE EXISTS (SELECT 1 FROM principal)\n) AS reachable"}}, "layout": {"x": 0, "y": 0, "width": 12, "height": 8}, "parameterBindings": {"principleId": {"source": "dashboard", "parameter": "principleId"}}}], "createdAt": "2026-08-07T00:00:00.000Z", "updatedAt": "2026-08-17T03:00:00.000Z", "createdBy": "christophe.lacombe", "updatedBy": "system"}
$def$::jsonb
FROM "dashboards" AS dd
WHERE dr."dashboard_id" = dd."id"
  AND dd."dashboard_id" = 'principles'
  AND dd."workspace_id" IS NULL
  AND dr."revision" = dd."latest_revision";
