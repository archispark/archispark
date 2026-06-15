# Installation & Local Development

## Stack

| Layer | Tech |
|-------|------|
| API | Express + TypeScript ESM, PostgreSQL (Drizzle ORM), Keycloak (auth) |
| MCP | `@modelcontextprotocol/sdk` — Streamable HTTP transport, Bearer token auth |
| Web | Next.js 16, React, shadcn/ui, Vercel Analytics + Speed Insights |
| Admin web | Next.js 16 — platform admin console (`apps/admin-web`), `platform_admin` only |

## Quick start

```bash
pnpm install
pnpm dev          # API :3000 · Web :8000 · Admin :8001 · MCP :3001 · all bound to 0.0.0.0
```

On first run the API:
1. Applies pending PostgreSQL migrations (`packages/db/drizzle-pg/`)
2. Seeds default users (`admin/admin`, `user/user`, `contrib/contrib`, `archi/archi`) if the `users` table is empty
3. Seeds workspaces from `workspaces.json` or `config.json` + XML files if present

`DATABASE_URL` is **required** — there is no hardcoded
default. For local development, `make dev` sources `.env`, which sets
`DATABASE_URL=postgresql://archispark:${DB_PASSWORD}@localhost:5432/archispark`
to match the Postgres container started by `make dev-infra`.

## Docker & Makefile

Two Docker Compose files cover every deployment mode:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Production** — pulls published images from Docker Hub (Traefik, control-api, tenant-api, mcp-server, web, PostgreSQL) |
| `docker-compose.dev.yml` | **Development infra** — PostgreSQL + Keycloak only, used by `make dev-infra` while apps run via `pnpm dev` |

The `Makefile` wraps the most common operations. Run `make` or `make help` for the full list.

```bash
# First-time setup
make env            # copy .env.example → .env (edit DB_PASSWORD, TENANT_JWT_SECRET, TENANT_DB_PASSWORD, TENANT_DB_ENCRYPTION_KEY)

# Production (Hub images)
make up             # docker compose up -d
make down
make logs

# Development
make dev            # full hot-reload stack
make dev-infra      # postgres + keycloak only, then run pnpm dev on the host
# Note: on a Postgres volume that pre-dates Keycloak, .docker/initdb/02-create-keycloak-db.sql
# won't run (it only fires on first init). Create the DB once manually:
#   docker exec <postgres-container> psql -U archispark -d postgres -c "CREATE DATABASE archispark_keycloak;"
#   docker exec <postgres-container> psql -U archispark -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE archispark_keycloak TO archispark;"

make dev-keycloak-setup # create/update the Keycloak realm (roles, clients, service account) via the Admin API — works on hosted Phasetwo too
make dev-seed-demo      # create the Keycloak demo accounts + seed demo ArchiMate data (see Demo seed)

# Build images from source (OS=alpine|trixie-slim, VERSION auto-read from package.json)
make build          # build all images for current OS variant
make build-all      # build both alpine and trixie-slim
make build-api      # build a single service
make build OS=trixie-slim VERSION=1.2.3

# Push to Docker Hub
make push
make release VERSION=x.y.z   # build-all + push-all in one command

# Utilities
make clean          # remove local ArchiSpark images
make version        # print version from package.json
```
