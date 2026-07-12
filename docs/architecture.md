# Persistence & Architecture

All data lives in a single shared PostgreSQL database, used by `apps/api` and
`apps/mcp-server`. Schema follows ArchiMate 3 Open Exchange XSDs
(`models/xsd/`).

The test suite runs against [PGlite](https://pglite.dev) (Postgres compiled to
WASM, in-memory) — full Postgres fidelity, no Docker required.

## Database schema

`packages/db/src/schema.ts` defines every table in one place: `siteSettings`
(login/banner messages), `apiTokens` (personal API tokens), `workspaces`
(each owned by a single user — `ownerId`, a Keycloak `sub`),
`userActiveWorkspace` (per-user pointer to the workspace currently in use),
and the ArchiMate content tables (`elements`, `relationships`,
`propertyDefinitions`, `elementProperties`, `relationshipProperties`,
`views`, `nodes`, `connections`, `bendpoints`), all keyed by `workspace_id`
with cascading foreign keys.

There is no local `users` table — identities live entirely in Keycloak.
`apiTokens.userId`/`workspaces.ownerId` are plain Keycloak `sub` values.

To generate a migration after a schema change:

```bash
cd packages/db
npx drizzle-kit generate   # writes to drizzle-pg/
```

## `apps/api`

`apps/api` is the single backend service — it owns authentication
(`requireAuth`, verifying a Keycloak access token via JWKS or a personal API
token), personal settings (`/me`, `/settings/api-tokens`,
`/settings/messages`), and every ArchiMate modeling route (`/workspaces`,
`/elements`, `/relationships`, `/views`, `/property-definitions`,
`/export`, `/import`, `/openapi.json`, `/docs`). Every workspace route
implicitly scopes to `req.user!.id` — a user only ever sees and modifies
their own workspaces.

`apps/mcp-server` reads/writes the same database directly (in-process import
of `apps/api`'s `store`/`registry` modules, not an HTTP call), authenticated
via the same personal API tokens as the REST API.

Self-hosted Docker: `apps/api` runs as the only backend Compose service,
reached by `web` and `mcp-server` over the `archispark` network. Vercel:
`apps/api` is its own project (`archispark-api`, root directory `apps/api`)
— see [Vercel](deployment.md#vercel).
