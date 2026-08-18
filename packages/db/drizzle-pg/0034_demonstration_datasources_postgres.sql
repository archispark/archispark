-- 0032_dashboard_system_seed.sql seeded the "demonstration-datasources"
-- dashboard's two panels pointing at architecture-neo4j (Cypher) because
-- ArchiSpark only exposed a Neo4j datasource at the time. Now that a native
-- Postgres datasource exists (apps/server/lib/dashboards/contracts.ts's
-- POSTGRES_DATASOURCE), point both panels at it for real: "Éléments" counts
-- rows in the elements/workspaces tables directly (the same ArchiMate
-- content Neo4j is exported from — no "fournisseurs" table involved), and
-- "Fournisseurs actifs" queries the "fournisseurs" table from
-- 0033_fournisseurs.sql. This is the only place that mutates a system
-- dashboard's seeded revision; see 0032's comment for why there is no
-- runtime seed/reseed path.
UPDATE "dashboard_revisions" AS dr
SET "definition" = $def$
{"id": "demonstration-datasources", "title": "Démonstration des datasources", "description": "Deux panneaux PostgreSQL : une agrégation sur les tables ArchiMate natives (elements/workspaces) et une autre sur la table de démonstration « fournisseurs ».", "category": "Démonstration", "schemaVersion": 2, "parameters": [], "panels": [{"id": "elements-postgres", "panel": {"title": "Éléments", "description": "Nombre total d’éléments ArchiMate, compté via les tables PostgreSQL natives « elements »/« workspaces ».", "resultType": "metrics", "parameters": [], "visualization": {"type": "core/metric", "max": 1000}, "query": {"datasourceId": "postgres-app-db", "language": "sql", "text": "SELECT count(*)::integer AS count FROM elements e JOIN workspaces w ON w.id = e.workspace_id WHERE w.organization_id = $organizationId"}}, "layout": {"x": 0, "y": 0, "width": 6, "height": 3}, "parameterBindings": {}}, {"id": "fournisseurs-postgres", "panel": {"title": "Fournisseurs actifs (démonstration PostgreSQL)", "description": "Métrique issue de la table PostgreSQL « fournisseurs » de l’organisation active.", "resultType": "metrics", "query": {"datasourceId": "postgres-app-db", "language": "sql", "text": "SELECT count(*)::integer AS count FROM fournisseurs WHERE organization_id = $organizationId AND actif = $actif"}, "parameters": [{"name": "actif", "label": "Fournisseurs actifs", "type": "boolean", "required": false, "defaultValue": true}], "visualization": {"type": "core/metric"}}, "layout": {"x": 6, "y": 0, "width": 6, "height": 3}, "parameterBindings": {}}], "createdAt": "2026-08-07T20:00:00.000Z", "updatedAt": "2026-08-17T01:00:00.000Z", "createdBy": "codex", "updatedBy": "system"}
$def$::jsonb
FROM "dashboards" AS dd
WHERE dr."dashboard_id" = dd."id"
  AND dd."dashboard_id" = 'demonstration-datasources'
  AND dd."workspace_id" IS NULL
  AND dr."revision" = 1;
