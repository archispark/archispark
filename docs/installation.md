# Installation & Local Development

## Stack

| Layer | Tech |
|-------|------|
| API | Express + TypeScript ESM, PostgreSQL (Drizzle ORM), Keycloak (auth) |
| MCP | `@modelcontextprotocol/sdk` — Streamable HTTP transport, Bearer token auth |
| Web | Next.js 16, React, shadcn/ui, Vercel Analytics + Speed Insights |

## Quick start

```bash
make install      # pnpm install
make up           # postgres + keycloak (Docker), then pnpm dev — API :3000 · Web :8000 · MCP :3001 · all bound to 0.0.0.0
```

On first run, `apps/api` applies pending PostgreSQL migrations
(`packages/db/drizzle-pg/`). Demo users and workspaces are not seeded
automatically — run `make setup-demo` (or the individual `make
keycloak-setup` / `seed-demo-users` / `seed-demo` targets, see
[Demo seed](demo-data.md#demo-seed)).

`DATABASE_URL` is **required** — there is no hardcoded
default. For local development, `make up` sources `.env.dev`, which sets
`DATABASE_URL=postgresql://archispark:${DB_PASSWORD}@localhost:5432/archispark`
to match the Postgres container started by the same command.

## Docker & Makefile

Two Docker Compose files cover every deployment mode, selected via `ENV` (default `dev`, see `make help`):

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Production** (`ENV=prod`) — pulls published images from Docker Hub (Traefik, api, mcp-server, web, PostgreSQL) |
| `docker-compose.dev.yml` | **Development infra** (`ENV=dev`, default) — PostgreSQL + Keycloak, started by `make up`, which also runs `pnpm dev` for hot-reload |

The `Makefile` wraps the most common operations and loads `.env.$(ENV)` (`.env.dev` or `.env.prod`, via `-include`). Run `make` or `make help` for the full list.

```bash
# First-time setup
make install        # pnpm install
make env            # copy .env.example → .env.dev (edit DB_PASSWORD, KEYCLOAK_ADMIN_CLIENT_SECRET)
make env ENV=prod   # ... or → .env.prod, for a production deployment

# Development (ENV=dev, default)
make up             # postgres + keycloak (Docker), then pnpm dev (hot-reload)
make down
make logs
# Note: on a Postgres volume that pre-dates Keycloak, .docker/initdb/02-create-keycloak-db.sql
# won't run (it only fires on first init). Create the DB once manually:
#   docker exec <postgres-container> psql -U archispark -d postgres -c "CREATE DATABASE archispark_keycloak;"
#   docker exec <postgres-container> psql -U archispark -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE archispark_keycloak TO archispark;"

make keycloak-setup  # create/update the Keycloak realm (roles, clients, service account) via the Admin API — works on any Keycloak instance
make seed-demo-users # create/update the 4 Keycloak demo accounts (admin/user/contrib/archi)
make seed-demo       # seed demo ArchiMate data (ArchiMetal/ArchiSurance, see Demo seed)

# Production (Hub images)
make up ENV=prod    # docker compose up -d
make down ENV=prod
make logs ENV=prod
make pull ENV=prod  # update images

# Build images from source (OS=alpine|trixie-slim, VERSION auto-read from package.json)
make build          # build all images for current OS variant
make build-all      # build both alpine and trixie-slim
make build-api      # build a single service
make build OS=trixie-slim VERSION=1.2.3

# Utilities
make clean          # remove local ArchiSpark images
make version        # print version from package.json
```
