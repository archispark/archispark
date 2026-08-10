---
title: Dashboards and Neo4j exploration
description: Export a model to Neo4j, run Cypher and build organization dashboards.
---

Dashboards query the Neo4j read model. PostgreSQL remains authoritative: export
the workspace again whenever its ArchiMate content changes.

## Prepare the graph

Configure `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD`, then call
`POST /api/export/neo4j` for the active workspace. For batch imports, use
`pnpm import:workspace -- <workspace-uuid>` or `pnpm import:workspaces`.

Every exported node and relationship carries `organizationId`. Re-exporting a
workspace replaces only that workspace's graph.

## Explore (`/explore`)

The explorer accepts read-only Cypher and JSON parameters. It provides presets,
keeps the latest 20 executions in browser storage, renders compatible results
as a graph or table, and exports rows to JSON or CSV.

`$organizationId` is injected by the server. Rows containing a node or
relationship from another organization are removed from the result.

```cypher
MATCH (element:Element {organizationId: $organizationId})
RETURN element.type AS type, count(element) AS count
ORDER BY count DESC
```

## Dashboards (`/dashboards`)

All organization members can list dashboards and execute panels. A panel
returns `graph`, `table`, or `metrics`. Owners and admins can create and edit
dashboards; saving an edit creates an immutable revision, and deletion is soft.
Graph panels provide controls for filtering element and relationship types,
choosing the edge style and layout direction, and entering fullscreen. Press
Escape or the minimize control to return to the dashboard.

The form uses structured metadata fields and validated JSON for parameters,
panels, layouts, and tab groups. Identifiers use lowercase kebab-case. Every
panel query must use `architecture-neo4j`, reference `$organizationId`, and
select a compatible visualization: `core/graph`, `core/table`, or
`core/metric`.

## Current limits

- Neo4j is not updated automatically after model edits.
- Dashboard content uses a JSON editor, not a visual panel builder.
- Declared client-side `transformations` are accepted but not yet applied.
- Explorer queries are read-only and results may be truncated.

See [Architecture](../development/architecture.md#dashboards) for persistence
and tenant-isolation details.
