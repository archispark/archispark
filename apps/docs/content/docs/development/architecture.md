---
title: Persistence & Architecture
description: Database schema, application architecture, Neo4j export and deployment model.
---

All data lives in a single shared PostgreSQL database, used by `apps/server`.
Schema follows ArchiMate 3 Open Exchange XSDs (`models/xsd/`).

The test suite runs against [PGlite](https://pglite.dev) (Postgres compiled to
WASM, in-memory) — full Postgres fidelity, no Docker required.

## Database schema

`packages/db/src/schema.ts` defines every table in one place, following an
**Organisation → Workspace** hierarchy: `organizations` (`slug`, `name`,
`isPersonal`, `enabled` — a suspension flag settable only by an Admin
(`platform_admin`)), `organizationMembers` (`organizationId`, `userId` — a
Keycloak `sub` — and `role`: `"owner" | "admin" | "member"`),
`organizationInvitations` (email-based invitations — `email`, `role`,
`tokenHash` (SHA-256 of a random token, the clear-text token itself is
never persisted), `expiresAt`/`sentAt`/`acceptedAt`/`revokedAt`; a partial
unique index on `(organizationId, email)` restricted to rows where
`acceptedAt IS NULL AND revokedAt IS NULL` enforces at most one active
invitation per organization/e-mail pair — see
[Organization invitations by e-mail](../reference/authentication.md#organization-invitations-by-e-mail)),
`userActiveOrganization` (per-user pointer to the organization currently in
use), `siteSettings` (login/banner messages), `apiTokens` (personal API
tokens, each scoped to one `organizationId` and optionally pinned to one
`workspaceId`), `workspaces` (each belonging to exactly one organization —
`organizationId`; `createdById`, a Keycloak `sub`, is traceability only and
never used for access control), `userActiveWorkspace` (per-user,
per-organization pointer to the workspace currently in use), and the
ArchiMate content tables (`elements`, `relationships`,
`propertyDefinitions`, `elementProperties`, `relationshipProperties`,
`views`, `nodes`, `connections`, `bendpoints`), all keyed by `workspace_id`
with cascading foreign keys.

A fourth role, Admin (Keycloak identifier `platform_admin`), is a Keycloak
**realm** role (not an `organization_members` row) — it administers organizations
(`/api/platform/organizations*`, metadata only) but is structurally denied
any access to organization content, enforced once in
[`apps/server/lib/archimate/access.ts`](https://github.com/archispark/archispark/blob/main/apps/server/lib/archimate/access.ts)
rather than left to be remembered at every call site. See
[Authentication](../reference/authentication.md) for the full role matrix.

There is no local `users` table — identities live entirely in Keycloak.
`apiTokens.userId`/`organizationMembers.userId`/`workspaces.createdById` are
plain Keycloak `sub` values.

`apiTokens.organizationId`/`workspaces.organizationId` are nullable at the
DB level only during the expand→backfill→contract
migration window (see
[`packages/db/src/backfill-organizations.ts`](https://github.com/archispark/archispark/blob/main/packages/db/src/backfill-organizations.ts));
the backfill runs automatically right after migrations, before the app
serves any traffic, so every row the application ever reads has one.

To generate a migration after a schema change:

```bash
cd packages/db
npx drizzle-kit generate   # writes to drizzle-pg/
```

## `apps/server`

`apps/server` is the single application — a Next.js app combining the
workspace UI, the REST API, and the MCP server in one process and one
deployment. It owns authentication (`requireAuth`, verifying a Keycloak
access token via JWKS or a personal API token), personal settings (`/api/me`,
`/api/settings/api-tokens`, `/api/settings/messages`), organization/member
management (`/api/organizations*`, `/api/platform/organizations*`), every
ArchiMate modeling route (`/api/workspaces`, `/api/elements`,
`/api/relationships`, `/api/views`, `/api/property-definitions`,
`/api/export`, `/api/export/neo4j`, `/api/import`, `/api/openapi.json`,
`/api/docs`), and the MCP
transport (`/mcp/`, ~38 tools). REST routes are Next.js App Router Route
Handlers (`app/api/**/route.ts`); the MCP transport is a Pages Router route
(`pages/api/mcp.ts`) — the only exception, required because the MCP SDK's
`StreamableHTTPServerTransport` needs a raw Node `http.IncomingMessage`/
`ServerResponse`, which only the Pages Router exposes. Every
workspace/organization route resolves access through the single
authorization gateway,
[`apps/server/lib/archimate/access.ts`](https://github.com/archispark/archispark/blob/main/apps/server/lib/archimate/access.ts)
(`resolveActiveContext`/`assertOrgAccess`/`assertWorkspaceAccess`) — a user
sees and acts on every workspace of every organization they belong to,
subject to their role (`owner`/`admin`: read+write, `member`: read-only).

The MCP tools (`apps/server/lib/mcp/`) import `lib/archimate/store.ts`/
`registry.ts` directly — same process, same module graph, no HTTP hop and no
package boundary to cross — authenticated via the same personal API tokens
as the REST API.

Self-hosted Docker: `apps/server` is the only application Compose service,
reached through Traefik. Vercel: `apps/server` is its own project (root
directory `apps/server`) — see [Vercel](deployment.md#vercel).

## Neo4j export

`POST /api/export/neo4j` (`apps/server/app/api/export/neo4j/route.ts`) reads
the active workspace's model from PostgreSQL (`loadModel` /
[`modelFromDb`](https://github.com/archispark/archispark/blob/main/packages/db/src/model-io.ts)) and rewrites it into a Neo4j
graph, for reporting use cases that need graph queries rather than the
relational model. Postgres stays the single source of truth — Neo4j is a
disposable read-side copy, rebuilt on demand by calling this route again.

The same logic is also reachable outside the HTTP API, without a
session/token, via two scripts:

- `pnpm import:workspace -- <workspace-uuid>`
  (`packages/db-neo4j/scripts/import-workspace.ts`) — one workspace.
- `pnpm import:workspaces` (`packages/db-neo4j/scripts/import-all-workspaces.ts`) —
  every workspace in the database, one at a time; one workspace failing
  doesn't stop the others, and the script exits non-zero if any import
  failed.

Both read `DATABASE_URL`/`NEO4J_*` from the environment, falling back to
`.env` at the repo root if not already set, falling back to `.env.$ENV`
(`.env.dev` by default) when `.env` is absent — so `pnpm import:workspaces`
just works against the local dev stack with no extra flags. Pass an explicit
env file as the last
argument to target another environment (`pnpm import:workspace --
<workspace-uuid> .env.prod`, `pnpm import:workspaces .env.prod`) — same
convention as `migrate:prod`/`backfill:prod` in `packages/db`. A relative
path is resolved against the repo root (not the current directory), since
`pnpm --filter` runs the underlying script from `packages/db-neo4j`.
`${VAR}` references inside the file (e.g. `DATABASE_URL` interpolating
`DB_PASSWORD`, as `.env`/`.env.prod` do) are expanded against vars
already loaded earlier in the same file.

Both are root `package.json` scripts (delegating to
`@workspace/db-neo4j`, the same pattern as `seed:demo`/`setup:realm`
delegating to `@workspace/db`).

The write logic lives in `packages/db-neo4j` (`@workspace/db-neo4j`), a
package mirroring `packages/db`'s shape (driver singleton, versioned schema
migrations, `migrate:prod` script) but for the Neo4j service instead of
Postgres:

- `mapping.ts` — pure `(ArchiModel, organization) → Cypher parameters`
  transform. Resolves element/relationship property names via
  `propertyDefinitions` (properties are stored keyed by `propertyDefUuid` in
  Postgres), flattens each view's node tree into the set of element ids it
  contains, rejects any relationship type that wouldn't be safe to
  interpolate into a Cypher relationship type (relationship types aren't
  parameterizable in Cypher), and stamps every element/relationship/view/
  property param with the workspace's Postgres `organizationId` (multi-tenant
  tag, see below).
- `import-model.ts` — writes `Model`/`Element`/`Property`/`View` nodes and
  ArchiMate relationships as native Neo4j relationship types
  (`COMPOSITION`, `AGGREGATION`, `ASSIGNMENT`, `REALIZATION`, `SERVING`,
  `ACCESS`, `INFLUENCE`, `TRIGGERING`, `FLOW`, `SPECIALIZATION`,
  `ASSOCIATION` — the same set as `RELATIONSHIP_TYPES` in
  `apps/server/lib/archimate/schemas.ts`), linked by `CONTAINS`. Element
  properties become `Property` nodes linked via `HAS_PROPERTY` (`Element`
  is a node, so this is representable); relationship properties are set
  natively on the relationship itself (`SET r += rel.properties`) since
  Neo4j relationships can't be the endpoint of another relationship — a
  `HAS_PROPERTY` edge from a relationship isn't expressible. Each import is
  a wipe-and-reload, but scoped to the subgraph reachable from
  `(:Model {id: workspace.uuid})` — importing one workspace never touches
  another workspace's data already in Neo4j.
- **Multi-tenancy**: `importModelToNeo4j(model, organization)` takes the
  workspace's Postgres organization (`{id, slug, name}`) as an explicit
  second argument — it's not part of `ArchiModel`, which stays a pure
  Postgres representation. Every write merges an `(:Organization {id})` node
  (shared across that organization's workspaces, `MERGE`d — never deleted by
  a single workspace's wipe-and-reload) linked to the `:Model` via
  `HAS_MODEL`, and additionally stamps `organizationId` directly on
  `Model`/`Element`/`View`/`Property` nodes and on every relationship, so
  tenant-scoped reporting queries (`MATCH (n:Element {organizationId: $id})`)
  can filter by index without traversing from `:Model` first. Both call
  sites (`POST /api/export/neo4j` and the two CLI scripts below) resolve the
  organization from Postgres before calling `importModelToNeo4j`.
- `schema/migrations/*.cypher` — versioned, numbered Cypher migration files
  (constraints/indexes), applied in order and tracked via
  `(:SchemaMigration {version})` nodes, the same append-only convention as
  `packages/db/drizzle-pg/`. Neo4j has no `drizzle-kit` equivalent, so
  `schema/migrate.ts` implements this runner directly; `ensureNeo4jSchema()`
  applies pending migrations once per process before every import.
  `0002_organization_index.cypher` adds the `organizationId` indexes (one
  per node label plus one per relationship type) and the `Organization.id`
  uniqueness constraint described above.

Configured via `NEO4J_URI` (defaults to `bolt://localhost:7687`),
`NEO4J_USER`, `NEO4J_PASSWORD`.

## Dashboards

Configurable reporting dashboards — composed of panels (graph/table/metric),
each embedding its own Cypher query, parameters and visualization inline (no
external panel/query catalogue) — integrated from a companion project
(`ofr-archimate-reports/apps/portal`) and rebuilt on top of ArchiSpark's own
data and access model rather than ported as a separate app. Business logic
lives in `apps/server/lib/dashboards/`:

- `contracts.ts` — Zod schemas for `DashboardDefinition`, `PanelContent`,
  `PanelResult`, `PanelVisualizationMetadata`. `ELEMENT_TYPES`/layers reuse
  `lib/archimate-helpers.ts` (`getLayer`, `ALL_ELEMENT_TYPES`) rather than a
  separate ArchiMate domain module — ArchiSpark already has one.
- `repository.ts` — CRUD over `dashboards`/`dashboard_revisions`
  (`packages/db/src/schema.ts`), on Drizzle/Postgres like every other table.
  Every method takes `organizationId`: dashboards are scoped per
  organization (not global), edits create a new immutable revision, deletes
  are soft (`deletedAt`).
- `panel-execution.ts` — resolves a panel instance's parameters and runs its
  query, normalizing the result to the `graph`/`table`/`metrics` shape the
  frontend expects.
- `datasource-executors.ts` — executes a panel's Cypher against the same
  Neo4j graph as [the Neo4j export](#neo4j-export) above (`@workspace/db-neo4j`'s
  driver singleton), instead of a separate Neo4j instance fed by a one-off
  XML import (the companion project's original design). **Multi-tenant
  scoping**: `organizationId` is injected into the query's bound parameters
  by the executor — never trusted from the query text — and
  `assertPanelQuerySafe` statically requires every panel's Cypher to
  reference `$organizationId`, checked both when a dashboard revision is
  saved (`app/api/dashboards/**`) and again before every execution (defense
  in depth). `Element` nodes also carry a `layer` property (added by the
  Neo4j export specifically for this — see `packages/db-neo4j/src/layer.ts`)
  so panels can filter by ArchiMate layer without recomputing it from `type`.
- `explore.ts` — the ad hoc Cypher query page (`/explore`) runs arbitrary
  read-only queries, so its text can't be statically validated the way a
  saved panel's can. Scoping is instead enforced on the _result_: any row
  containing a Neo4j node or relationship whose `organizationId` doesn't
  match the caller's is dropped in its entirety, regardless of the query's
  own `WHERE` clause.

Routes live under `app/api/dashboards/**`, `app/api/explore`, and
`app/api/panel-visualizations`, gated by the same
`resolveActiveContext`/`assertOrgAccess` gateway as every other resource —
editing a dashboard requires the `owner`/`admin` role in the active
organization, `member` is read-only. There is no separate admin
login/token — the companion project's single-admin-token session
(`ARCHIMATE_API_TOKEN`) isn't used here.

Frontend components live under `apps/server/components/dashboards/`,
restyled to ArchiSpark's shadcn/Tailwind tokens. Every ReactFlow uses the
same rounded node treatment: a generic layer icon inside the node, a floating
text badge for the ArchiMate component type, and labels clamped to two lines.
The dashboard and relation graphs use fixed-size nodes with dagre auto-layout;
`view-canvas-node.tsx` keeps the dimensions stored in the model and remains
resizable so editing an imported ArchiMate view does not alter its geometry.
Each graph retains its existing component color calculation.
All three ReactFlow surfaces share the fullscreen overlay control implemented in
`components/react-flow-fullscreen.tsx`; it locks page scrolling while active and
supports Escape to exit.
The React Flow canvas itself is instantiated only by
`components/archispark-react-flow.tsx`, which owns the shared stylesheet,
background, controls and attribution settings. Dashboard, relationship and view
features supply only their domain-specific nodes, panels and handlers.
ArchiMate relationship notation is defined once in
`components/archimate-edge-style.ts`; shared marker definitions and the
read-only edge renderer ensure that relationship types such as `Realization`
use the same line pattern and endpoint symbols on every graph.

Not carried over from the companion project: the XML-import worker
(`apps/worker`) and its Postgres demo datasource (superseded by the live
Neo4j export above), the single-admin-token auth, the third-party panel
plugin system (`plugins/`), and the "Reports" pages (legacy redirects to
specific provisioned dashboards the companion project seeded from its own
demo data — there's no equivalent seed here). Panel `transformations`
(client-side result reshaping, e.g. `extractFields`) are accepted by the
schema for forward-compatibility but not yet applied by the renderer.
