---
title: Installation & Local Development
description: Set up and run ArchiSpark locally with pnpm, Docker, PostgreSQL, Keycloak and Neo4j.
---

## Stack

A single Next.js app (`apps/server`) serves the UI, the REST API and the MCP
transport, all in one process:

| Layer     | Tech                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web + API | Next.js 16 App Router (Route Handlers under `app/api/**`), React, shadcn/ui, Vercel Analytics + Speed Insights                                                      |
| MCP       | `pages/api/mcp.ts` (Pages Router — the MCP SDK's transport needs raw Node `http` objects), `@modelcontextprotocol/sdk` Streamable HTTP transport, Bearer token auth |
| Data      | PostgreSQL (Drizzle ORM), Keycloak (auth), Mailpit (local e-mail), Neo4j (optional graph export, see [Neo4j export](../development/architecture.md#neo4j-export))   |

## Quick start

```bash
pnpm install      # Node >=22.13 required (.nvmrc pins 24 — `nvm use` if you use nvm)
pnpm dev          # Docker development infrastructure, then hot-reload — server on :8000 (web + API + MCP), docs on :3000
```

Mailpit captures local invitation, verification, and password-reset e-mails
at [http://localhost:8025](http://localhost:8025); it never delivers them to
the public Internet.

First run:

- `apps/server`'s `instrumentation.ts` (Next.js's `register()` hook)
  applies pending PostgreSQL migrations (`packages/db/drizzle-pg/`).
- Demo users and workspaces are **not** seeded automatically — run
  `pnpm setup-demo` (or the individual `pnpm keycloak-setup` /
  `seed-demo-users` / `seed-demo` scripts, see
  [Demo seed](demo-data.md#demo-seed)).
- `DATABASE_URL` is **required**, no hardcoded default. `pnpm dev` sources
  `.env.dev`, which sets it to
  `postgresql://archispark:${DB_PASSWORD}@localhost:5432/archispark` to
  match the Postgres container started by the same command.

## Docker & pnpm scripts

Two Docker Compose files cover every deployment mode:

| File                     | Purpose                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `docker-compose.yml`     | **Production** — pulls published images from Docker Hub (Traefik, server, PostgreSQL, Neo4j) |
| `docker-compose.dev.yml` | **Development infra** — PostgreSQL + Keycloak + Neo4j, started by `pnpm dev`                 |

Root `package.json` scripts load `.env.dev` for local development. Run
`pnpm run` (no script name) to list every script.

```bash
# First-time setup
pnpm install         # pnpm install (Node >=22.13 — see .nvmrc)
pnpm env             # copy .env.example → .env.dev (edit DB_PASSWORD, KEYCLOAK_ADMIN_CLIENT_SECRET)

# Development
pnpm dev              # starts Docker infrastructure, then hot-reload: server on :8000 and docs on :3000
pnpm down
docker compose -f .docker/docker-compose.dev.yml --env-file .env.dev logs -f
# Note: on a Postgres volume that pre-dates Keycloak, .docker/initdb/02-create-keycloak-db.sql
# won't run (it only fires on first init). Create the DB once manually:
#   docker exec <postgres-container> psql -U archispark -d postgres -c "CREATE DATABASE archispark_keycloak;"
#   docker exec <postgres-container> psql -U archispark -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE archispark_keycloak TO archispark;"

pnpm keycloak-setup  # create/update the Keycloak realm (roles, clients, service account) via the Admin API — works on any Keycloak instance
pnpm seed:demo-users # create/update the 5 Keycloak demo accounts (admin/user/contrib/archi/open)
pnpm seed:demo       # seed demo ArchiMate data (ArchiMetal/ArchiSurance/Open Day, see Demo seed)
pnpm setup-demo      # all three above, in order
pnpm reset           # delete all ArchiSpark PostgreSQL and Neo4j data (no seed)
pnpm reset-demo      # migrate, replace demo data, and export all workspaces to Neo4j

# Run the built main application (infrastructure must already be available)
pnpm build
pnpm start

# Production (Hub images)
cp .env.example .env.prod # edit the production values before continuing
docker compose -f .docker/docker-compose.yml --env-file .env.prod up -d
docker compose -f .docker/docker-compose.yml --env-file .env.prod logs -f
docker compose -f .docker/docker-compose.yml --env-file .env.prod down
```
