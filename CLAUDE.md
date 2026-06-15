# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup

```bash
pnpm install
make env            # copy .env.example → .env (edit DB_PASSWORD, TENANT_JWT_SECRET, TENANT_DB_PASSWORD, TENANT_DB_ENCRYPTION_KEY)
make dev-infra      # start Postgres + Keycloak (Docker)
make dev-keycloak-setup   # provision the Keycloak realm
```

### Develop

```bash
pnpm dev                       # turbo dev — API :3000 · Web :8000 · Admin :8001 · MCP :3001
pnpm --filter control-api dev  # run a single app (control-api, tenant-api, mcp-server, web, admin-web)
```

### Build / lint / typecheck / format

```bash
pnpm build      # turbo build (all apps/packages)
pnpm lint       # turbo lint (eslint)
pnpm typecheck  # turbo typecheck (tsc --noEmit)
pnpm format     # turbo format (prettier)
```

### Tests

```bash
pnpm run -w test                        # full coverage suite (control-api, tenant-api, mcp-server, web, admin-web, @workspace/db)
pnpm --filter control-api test          # one package, vitest run
pnpm --filter control-api test:watch    # watch mode
pnpm --filter control-api test:coverage # with coverage
```

Run a single test file or test name with vitest directly from the app directory:

```bash
cd apps/control-api
pnpm vitest run src/organizations.test.ts
pnpm vitest run -t "returns 403 for member"
```

Tests run against [PGlite](https://pglite.dev) (in-memory Postgres) — no Docker required.

### Database migrations

```bash
cd packages/db
DB_DRIVER=postgres npx drizzle-kit generate                                   # control-plane → drizzle-pg/
DB_DRIVER=postgres npx drizzle-kit generate --config drizzle.config.tenant.ts # tenant → drizzle-pg/tenant/
```

For Docker/Helm/Vercel workflows, see [docs/installation.md](docs/installation.md) and [docs/deployment.md](docs/deployment.md).

## Architecture

ArchiSpark is a Turborepo/pnpm monorepo (Node >=22.13):

- `apps/control-api` — public entry point: auth, sessions, API tokens, organizations/teams, platform admin routes. Proxies everything else to tenant-api.
- `apps/tenant-api` — internal data-plane service: workspaces, ArchiMate elements/relationships/views, property definitions, model import/export, OpenAPI/docs.
- `apps/mcp-server` — MCP server exposing the ArchiMate model as tools for AI agents, authenticated via the same personal API tokens as the REST API.
- `apps/web` — Next.js workspace UI (port 8000).
- `apps/admin-web` — Next.js platform admin console (port 8001), `platform_admin` only.
- `packages/db` — Drizzle ORM schemas/migrations (`schema.control.ts` control-plane, `schema.tenant.ts` tenant) and seed/migration scripts.
- `packages/auth` — shared Keycloak/Phasetwo auth helpers (`@workspace/auth`).
- `packages/ui`, `packages/types` — shared React components and types.

Detailed design docs live in [`docs/`](docs/) — in particular [docs/architecture.md](docs/architecture.md) (multi-tenant database model, control-api/tenant-api request flow, credential separation) and [docs/authentication.md](docs/authentication.md) (Keycloak login, roles, tokens). Read these before making cross-cutting changes to auth, organizations, or the tenant database layer — they cover invariants that span many files.

## After every code change

1. **Update the documentation**: keep the relevant file(s) under `docs/` (and `README.md` if the change affects the quick start or table of contents) in sync with any API, MCP tool, or behaviour change.

## Release Process

### Pre-release validation (ONLY before creating a tag)

Before creating a release tag, run the `vitest-coverage-enforcer` sub-agent.

The sub-agent is responsible for all release validation checks and must complete successfully before a release can be created.

**Important:**

* Do **not** run the `vitest-coverage-enforcer` during normal incremental development.
* Run it **only** immediately before creating a release tag.

### Creating a release

After the validation step succeeds:

1. Update `package.json` `"version"` so it exactly matches the release tag.
2. Commit the version bump.
3. Create the git tag using the same version.
4. Push commits and tags:

```bash
git push origin main --tags
```

The git tag and the `package.json` version must always remain identical.

## Project conventions

- **Code style**: enforced by Prettier (no semicolons, double quotes, 2-space indent, 80-column) and the shared `@workspace/eslint-config`. TypeScript runs in `strict` mode with `noUncheckedIndexedAccess`.
- **File size**: ESLint enforces a 250-line max per file (`max-lines`, error, blank lines/comments excluded) — split large modules rather than disabling the rule.
- **Type validation**: element and relationship types must belong to the ArchiMate 3.1 sets defined in `models/xsd`.
- **Reference PNG components**: all components (PNG) go to `models/img/archimate`. Never write generated images to `models/img/archimate/` or any other directory.
- **Reference SVG views**: `models/img/views/` contains SVGs exported directly by the Archi tool — these are the ground truth. When improving the renderer (`apps/tenant-api/src/renderer.ts`), compare generated output against the matching file in `models/img/views/` and minimize visual differences (shapes, colors, layout, connectors, labels, fonts).
