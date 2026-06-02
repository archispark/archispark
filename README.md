# ArchiSpark

ArchiMate 3.1 modeling tool — REST API, MCP server, and web UI.

## Stack

| Layer | Tech |
|-------|------|
| API | Express + TypeScript ESM, PostgreSQL (Drizzle ORM), JWT auth |
| MCP | `@modelcontextprotocol/sdk` — Streamable HTTP transport |
| Web | Next.js 16, React, shadcn/ui |

## Quick start

```bash
pnpm install
pnpm dev          # API :3000 · Web :8000 · MCP :3001 · all bound to 0.0.0.0
```

On first run the API:
1. Applies pending PostgreSQL migrations (`packages/db/drizzle-pg/`)
2. Seeds default users (`admin/admin` and `user/user`) if the `users` table is empty
3. Seeds workspaces from `workspaces.json` or `config.json` + XML files if present

Set the database connection with `DATABASE_URL` (the Supabase/Vercel
`POSTGRES_URL_NON_POOLING` / `POSTGRES_URL` vars are also picked up as
fallbacks). It defaults to `postgresql://archispark:archispark@localhost:5432/archispark`.

## Persistence

All data lives in PostgreSQL, shared between the API and MCP server.  
Schema follows ArchiMate 3 Open Exchange XSDs (`apps/api/models/xsd/`).

The test suite runs against [PGlite](https://pglite.dev) (Postgres compiled to
WASM, in-memory) — full Postgres fidelity, no Docker required.

To generate a migration after a schema change:

```bash
cd packages/db
DB_DRIVER=postgres npx drizzle-kit generate   # writes to drizzle-pg/
```

## Authentication

All routes except `POST /auth/login`, `GET /openapi.json`, `GET /docs`, and `POST|GET|DELETE /mcp/*` require a Bearer token.  
Write operations (`POST`, `PUT`, `DELETE`) outside `/auth/*` and `/mcp/*` require the `admin` role.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | public | Returns JWT (`{ token }`) |
| `GET` | `/auth/me` | user | Returns current user |

Default credentials: `admin` / `admin` (admin), `user` / `user` (read-only).

## User management (admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List all users |
| `POST` | `/users` | Create user — body: `{ username, password, role? }` |
| `PUT` | `/users/:id` | Update password and/or role |
| `DELETE` | `/users/:id` | Delete user (last user protected) |

## Workspace management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces` | List workspaces |
| `POST` | `/workspaces` | Create workspace — body: `{ name, path? }` (`path` = XML file to import) |
| `PUT` | `/workspaces/:id` | Rename workspace |
| `DELETE` | `/workspaces/:id` | Delete workspace (deleting the active one switches to another; the last workspace is protected) |
| `POST` | `/workspaces/:id/activate` | Switch active workspace |

## Model routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Active workspace info + model metadata |
| `POST` | `/save` | No-op (writes are persisted immediately); kept for compatibility |
| `GET` | `/export` | Download model as Open Exchange XML |
| `POST` | `/import` | Replace the active workspace model from an XML body |

## Elements

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/elements/types` | Sorted list of element types present in model |
| `GET` | `/elements` | List elements (`?type=`, `?name=`) |
| `GET` | `/elements/:id` | Get element |
| `POST` | `/elements` | Create element — `{ name, type, documentation?, properties? }` |
| `PUT` | `/elements/:id` | Update element (partial) |
| `DELETE` | `/elements/:id` | Delete element (cascades to relationships and view nodes) |

## Relationships

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/relationships/types` | Sorted list of relationship types present |
| `GET` | `/relationships` | List (`?type=`, `?source_id=`, `?target_id=`) |
| `GET` | `/relationships/:id` | Get relationship |
| `POST` | `/relationships` | Create — `{ type, source, target, name?, documentation?, is_directed?, access_type?, influence_strength? }` |
| `PUT` | `/relationships/:id` | Update (partial) |
| `DELETE` | `/relationships/:id` | Delete |

## Views

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/views` | List views |
| `GET` | `/views/:id` | View detail (nodes + connections) |
| `POST` | `/views` | Create — `{ name, viewpoint?, documentation? }` |
| `PUT` | `/views/:id` | Update (partial) |
| `DELETE` | `/views/:id` | Delete |
| `POST` | `/views/:id/nodes` | Add node — `{ element_id, x?, y?, w?, h? }` |
| `GET` | `/views/:id/image` | Render view as SVG (`?format=svg`; PNG export is client-side) |

## Property definitions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/property-definitions` | List |
| `GET` | `/property-definitions/:id` | Get |
| `POST` | `/property-definitions` | Create — `{ name, type? }` (types: `string`, `boolean`, `date`, `number`, `enumeration`) |
| `PUT` | `/property-definitions/:id` | Update |
| `DELETE` | `/property-definitions/:id` | Delete |

## MCP

Endpoint: `http://localhost:3001/mcp/`  
Transport: Streamable HTTP (MCP 2025-03-26).

Available tools: `get_model_info`, `list_element_types`, `list_elements`, `get_element`, `list_relationship_types`, `list_relationships`, `get_relationship`, `list_views`, `get_view`, `create_view`, `create_node`, `create_element`, `update_element`, `delete_element`, `create_relationship`, `update_relationship`, `delete_relationship`, `save_model`.

Interactive docs: `GET /docs` — OpenAPI spec: `GET /openapi.json`.

## Tests

```bash
pnpm run -w test            # 425 tests across all packages
pnpm run -w test:coverage   # ≥80% coverage required
```

## Vercel

1. Lier Supabase aux projets (dashboard Vercel)
Dans Vercel → Storage : lier supabase-celeste-compass à archispark-api et archispark-web. Cela injecte automatiquement POSTGRES_URL, POSTGRES_URL_NON_POOLING, etc.

2. Configurer les variables d'environnement
Récupère ton token Vercel dans Account Settings → Tokens, puis :

VERCEL_TOKEN=xxx \
SEED_ADMIN_PASSWORD=un-mot-de-passe-fort \
SEED_USER_PASSWORD=un-autre-mdp \
bash apps/api/scripts/setup-vercel-env.sh
Le script configure :

Variable	Projet	Valeur
JWT_SECRET	api	(générée)
WEB_URL	api	https://demo.archispark.cloud
API_URL	api	https://demo.archispark.cloud
TRUSTED_ORIGINS	api	https://demo.archispark.cloud
SEED_ADMIN_PASSWORD	api	(ton choix)
ARCHIMATE_API_URL	web	https://archispark-api-lacrifs-projects.vercel.app
