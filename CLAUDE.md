# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup

```bash
make install        # pnpm install
make env            # copy .env.example → .env.dev (edit DB_PASSWORD, KEYCLOAK_ADMIN_CLIENT_SECRET)
docker compose -f .docker/docker-compose.dev.yml up -d --wait  # start Postgres + Keycloak (Docker)
make keycloak-setup  # provision the Keycloak realm
```

### Develop

```bash
make up                  # Postgres + Keycloak (Docker), then turbo dev — server on :8000 (web + API + MCP)
pnpm dev                  # turbo dev only (infra already running)
pnpm --filter server dev  # run the app directly
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
pnpm run -w test                   # full coverage suite (server, @workspace/db)
pnpm --filter server test          # one package, vitest run
pnpm --filter server test:watch    # watch mode
pnpm --filter server test:coverage # with coverage
```

Run a single test file or test name with vitest directly from the app directory:

```bash
cd apps/server
pnpm vitest run lib/archimate/store.test.ts
pnpm vitest run -t "creates a workspace with empty model"
```

`vitest.config.ts` runs two `test.projects`: `web` (jsdom, React components/pages) and `server` (node, `lib/archimate/`+`lib/http/`+`lib/mcp/` business logic and Route Handler tests) — add `--project server` or `--project web` to target one only. **Never** put a `*.test.ts` inside `apps/server/pages/api/` — Next.js's Pages Router treats every file there as a live route (see `.claude/rules/testing.md`).

Tests run against [PGlite](https://pglite.dev) (in-memory Postgres) — no Docker required.

Database migrations: see [.claude/rules/db.md](.claude/rules/db.md).

For Docker/Helm/Vercel workflows, see [docs/installation.md](docs/installation.md) and [docs/deployment.md](docs/deployment.md).

## Architecture

ArchiSpark is a Turborepo/pnpm monorepo (Node >=22.13):

- `apps/server` — the single application: a Next.js app combining the workspace UI, the REST API (auth via Keycloak, sessions, API tokens, personal settings, organization/member management, and every ArchiMate route — workspaces, elements/relationships/views, property definitions, model import/export, OpenAPI/docs, all under `app/api/**` as App Router Route Handlers), and the MCP server (`pages/api/mcp.ts`, Pages Router — the MCP SDK's `StreamableHTTPServerTransport` needs a raw Node `http.IncomingMessage`/`ServerResponse`, which only the Pages Router exposes). Workspaces belong to an Organization (`owner`/`admin`/`member` roles, plus a `platform_admin` realm role with no access to organization content) — see `apps/server/lib/archimate/access.ts`, the single authorization gateway. Business logic lives under `lib/archimate/` (store, registry, auth, validation, rendering, OXF parse/serialize) and `lib/mcp/` (the ~38 MCP tools, split by resource, plus prompts/resources); both are imported directly by `app/api/**` and `pages/api/mcp.ts` — no separate package boundary between them.
- `packages/db` — Drizzle ORM schema (`schema.ts`, single shared database) and seed/migration scripts.
- `packages/auth` — shared Keycloak auth helpers (`@workspace/auth`).
- `packages/ui`, `packages/types` — shared React components and types.

Detailed design docs live in [`docs/`](docs/) — in particular [docs/architecture.md](docs/architecture.md) (database schema, `apps/server`) and [docs/authentication.md](docs/authentication.md) (Keycloak login, tokens). Read these before making cross-cutting changes to auth or the database layer — they cover invariants that span many files. Past architecture decisions: [docs/decisions.md](docs/decisions.md).

## After every code change

1. **Update the documentation**: keep the relevant file(s) under `docs/` (and `README.md` if the change affects the quick start or table of contents) in sync with any API, MCP tool, or behaviour change.

## Release process

Human-triggered only — see [.claude/skills/release/SKILL.md](.claude/skills/release/SKILL.md). Validation is delegated to the Codex plugin (`/codex:review`, `/codex:rescue`) only immediately before tagging, never during incremental development.

## Project conventions

- **Code style**: enforced by Prettier (no semicolons, double quotes, 2-space indent, 80-column) and the shared `@workspace/eslint-config`. TypeScript runs in `strict` mode with `noUncheckedIndexedAccess`.
- **File size**: `max-lines` (`@workspace/eslint-config`) flags files over 250 lines (blank lines/comments excluded) — it's configured as `"error"` but `eslint-plugin-only-warn` downgrades every rule repo-wide to a non-blocking warning, so it never fails `pnpm lint`/CI. Treat it as a strong convention, not a gate: split large modules rather than disabling the rule, and don't let a file grow past the limit on a change you're already making — but don't assume `pnpm lint` will catch it for you.
- **Type validation**: element and relationship types must belong to the ArchiMate 3.1 sets defined in `models/xsd`.
- **Reference PNG components**: all components (PNG) go to `models/img/archimate`. Never write generated images to `models/img/archimate/` or any other directory.
- **Reference SVG views**: `models/img/views/` contains SVGs exported directly by the Archi tool — these are the ground truth. When improving the renderer (`apps/server/lib/archimate/renderer.ts`), compare generated output against the matching file in `models/img/views/` and minimize visual differences (shapes, colors, layout, connectors, labels, fonts).

## Amélioration continue

- Si l'utilisateur te corrige deux fois sur le même sujet, propose-lui explicitement d'ajouter une règle dans CLAUDE.md ou `.claude/rules/` (avec le texte exact de la règle). N'ajoute jamais une règle sans son accord.
- Après toute décision d'architecture significative (choix de librairie, changement de pattern, refonte de module), propose une entrée dans [docs/decisions.md](docs/decisions.md).
- Si tu découvres qu'une règle existante est obsolète ou contredite par le code actuel, signale-le au lieu de l'appliquer silencieusement.
