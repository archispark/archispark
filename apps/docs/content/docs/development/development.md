---
title: Development
description: Repository layout, local workflow, tests, and extension points.
---

ArchiSpark is a pnpm/Turborepo monorepo. Node.js 22.13 or later is required;
`.nvmrc` selects Node 24 and the root package pins pnpm 11.5.1.

## Repository map

```text
apps/server/       Next.js UI, REST Route Handlers, and MCP transport
apps/docs/         Public site and this Fumadocs documentation
packages/auth/     Shared Keycloak helpers
packages/db/       Drizzle schema, PostgreSQL migrations, and seeds
packages/db-neo4j/ Neo4j driver, Cypher migrations, and model export
packages/types/    Shared TypeScript types
packages/ui/       Shared React components
models/            ArchiMate references, XSD, images, and example models
.docker/           Local and production Compose definitions
.k8s/              Kubernetes chart and manifests
```

The business layer is deliberately local to `apps/server`: modeling code is in
`lib/archimate`, dashboard code in `lib/dashboards`, and MCP registrations in
`lib/mcp`. REST and MCP call these modules directly.

## Local workflow

```bash
nvm use
pnpm install
pnpm env
# Set DB_PASSWORD and KEYCLOAK_ADMIN_CLIENT_SECRET in .env.dev
pnpm dev
```

`pnpm dev` starts PostgreSQL, Keycloak, and Neo4j through Docker Compose,
then launches Turbo development tasks. The main application listens on port
8000 and the documentation on port 3000.

To run a single application after infrastructure is already ready, load
`.env.dev` in your shell first, then use its workspace script:

```bash
pnpm dev
pnpm --filter server dev
pnpm --filter @archispark/docs dev
```

`pnpm start` has the standard production role: it runs the already-built main
application on port 8000. Run `pnpm build` first; it neither builds the
application nor starts Docker services.

Database migrations are applied by `apps/server/instrumentation.ts` before the
server accepts traffic. Keycloak setup and demo content remain explicit:

```bash
pnpm keycloak-setup
pnpm setup-demo
```

## Verification

Run the smallest relevant test first, then checks matching the change's scope.
Tests use PGlite and fake Keycloak integrations, so Docker is not required.

```bash
pnpm --filter server vitest run lib/archimate/store.test.ts
pnpm --filter server test
pnpm run -w test
pnpm lint
pnpm typecheck
pnpm build
```

Vitest has `server` (Node) and `web` (jsdom) projects. Never place a
`*.test.ts` file under `apps/server/pages/api`: Next.js would expose it as a
page route.

## Add or change a REST route

Create a Route Handler below `apps/server/app/api`. Keep validation in Zod
schemas, return the shared error shape, and resolve authorization through
`apps/server/lib/archimate/access.ts`. Do not reimplement membership or
`platform_admin` checks in the route.

Update these together:

- the route and focused tests;
- `apps/server/lib/archimate/openapi.ts`;
- [API reference](../reference/api-reference.md);
- client functions in `lib/api.ts` and query hooks when the UI consumes it.

## Add or change an MCP tool

Register the tool in the relevant `apps/server/lib/mcp/tools/*-tools.ts`
module. Reuse the ArchiMate store and access gateway rather than calling the
REST API. Add a focused registration/behavior test and update
[MCP server](../reference/mcp-tools.md).

The external endpoint remains `/mcp/`. Its implementation must remain at
`apps/server/pages/api/mcp.ts`, because Streamable HTTP needs the raw Node
request and response objects unavailable to App Router handlers.

## Database changes

Edit `packages/db/src/schema.ts`, generate a Drizzle migration, inspect the SQL,
and test both a fresh database and an upgrade path.

```bash
cd packages/db
npx drizzle-kit generate
```

For a transitional nullable column, use expand, backfill, then contract.
Identities remain Keycloak `sub` strings; there is no local users table.

Neo4j schema changes are numbered `.cypher` files in
`packages/db-neo4j/src/schema/migrations`. They are append-only and tracked by
`SchemaMigration` nodes.

## ArchiMate renderer changes

Validate element and relationship types against the ArchiMate 3.1 XSDs in
`models/xsd`. When changing `lib/archimate/renderer.ts`, compare output with
the reference SVGs in `models/img/views` and minimize differences in geometry,
colors, connectors, labels, and fonts. Never add generated images to the
repository.

## Code conventions

- TypeScript stays strict, including `noUncheckedIndexedAccess`.
- Prettier uses double quotes, no semicolons, two spaces, and 80 columns.
- Keep source files below 250 code lines; split modules instead of suppressing
  `max-lines`.
- Preserve unrelated work in a dirty worktree.
- Update product and technical documentation in the same change as behavior.

See [Architecture](architecture.md) for system boundaries and
[Contributing](contributing.md) for the contribution checklist.
