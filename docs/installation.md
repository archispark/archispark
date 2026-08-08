# Installation & Local Development

## Stack

A single Next.js app (`apps/server`) serves the UI, the REST API and the MCP
transport, all in one process:

| Layer | Tech |
|-------|------|
| Web + API | Next.js 16 App Router (Route Handlers under `app/api/**`), React, shadcn/ui, Vercel Analytics + Speed Insights |
| MCP | `pages/api/mcp.ts` (Pages Router — the MCP SDK's transport needs raw Node `http` objects), `@modelcontextprotocol/sdk` Streamable HTTP transport, Bearer token auth |
| Data | PostgreSQL (Drizzle ORM), Keycloak (auth), Neo4j (optional graph export for reporting, see [Neo4j export](architecture.md#neo4j-export)) |

## Quick start

```bash
pnpm install      # Node >=22.13 required (.nvmrc pins 24 — `nvm use` if you use nvm)
pnpm start        # postgres + keycloak + neo4j (Docker), then pnpm dev — server on :8000 (web + API + MCP), bound to 0.0.0.0
```

On first run, `apps/server`'s `instrumentation.ts` (Next.js's `register()`
hook) applies pending PostgreSQL migrations (`packages/db/drizzle-pg/`).
Demo users and workspaces are not seeded
automatically — run `pnpm setup-demo` (or the individual `pnpm
keycloak-setup` / `seed-demo-users` / `seed-demo` scripts, see
[Demo seed](demo-data.md#demo-seed)).

`DATABASE_URL` is **required** — there is no hardcoded
default. For local development, `pnpm start` sources `.env.dev`, which sets
`DATABASE_URL=postgresql://archispark:${DB_PASSWORD}@localhost:5432/archispark`
to match the Postgres container started by the same command.

## Docker & pnpm scripts

Two Docker Compose files cover every deployment mode:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Production** — pulls published images from Docker Hub (Traefik, server, PostgreSQL, Neo4j), driven by the `*:prod` scripts below |
| `docker-compose.dev.yml` | **Development infra** — PostgreSQL + Keycloak + Neo4j, started by `pnpm start`, which also runs `pnpm dev` for hot-reload |

Root `package.json` scripts wrap the most common operations and load
`.env.dev` (dev) / `.env.prod` (prod). Run `pnpm run` (no script name) to
list every script.

```bash
# First-time setup
pnpm install         # pnpm install (Node >=22.13 — see .nvmrc)
pnpm env             # copy .env.example → .env.dev (edit DB_PASSWORD, KEYCLOAK_ADMIN_CLIENT_SECRET)
pnpm env:prod        # ... or → .env.prod, for a production deployment

# Development
pnpm start           # postgres + keycloak + neo4j (Docker), then pnpm dev (hot-reload)
pnpm down
pnpm logs
# Note: on a Postgres volume that pre-dates Keycloak, .docker/initdb/02-create-keycloak-db.sql
# won't run (it only fires on first init). Create the DB once manually:
#   docker exec <postgres-container> psql -U archispark -d postgres -c "CREATE DATABASE archispark_keycloak;"
#   docker exec <postgres-container> psql -U archispark -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE archispark_keycloak TO archispark;"

pnpm keycloak-setup  # create/update the Keycloak realm (roles, clients, service account) via the Admin API — works on any Keycloak instance
pnpm seed-demo-users # create/update the 4 Keycloak demo accounts (admin/user/contrib/archi)
pnpm seed-demo       # seed demo ArchiMate data (ArchiMetal/ArchiSurance/Open Day, see Demo seed)
pnpm setup-demo      # all three above, in order

# Production (Hub images)
pnpm up:prod         # docker compose up -d
pnpm down:prod
pnpm logs:prod
pnpm pull:prod       # update images

# Build images from source (OS=alpine|trixie-slim via env var, VERSION auto-read from package.json)
pnpm docker:build             # build the server image for current OS variant (alpine by default)
pnpm docker:build:all         # build both alpine and trixie-slim
OS=trixie-slim REGISTRY=myorg pnpm docker:build

# Utilities
pnpm docker:clean    # remove local ArchiSpark images
pnpm pkg get version # print version from package.json
```
