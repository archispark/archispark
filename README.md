# ArchiSpark

ArchiMate 3.1 modeling tool — REST API, MCP server, and web UI.

## Stack

| Layer | Tech |
|-------|------|
| API | Express + TypeScript ESM, PostgreSQL (Drizzle ORM), Better Auth (sessions) |
| MCP | `@modelcontextprotocol/sdk` — Streamable HTTP transport, Bearer token auth |
| Web | Next.js 16, React, shadcn/ui, Vercel Analytics + Speed Insights |
| Cache | Redis (required) — session store + distributed rate-limiting |

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

Redis is **required** — set `REDIS_URL` (e.g. `redis://localhost:6379`). It is used
for session storage and distributed rate-limiting. The API will fail to start without it.

## Docker & Makefile

Three Docker Compose files cover every deployment mode:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Production** — pulls published images from Docker Hub |
| `docker-compose.build.yml` | **Build** — builds images from source (same services) |
| `docker-compose.dev.yml` | **Development** — hot-reload, sources mounted from host |

The `Makefile` wraps the most common operations. Run `make` or `make help` for the full list.

```bash
# First-time setup
make env            # copy .env.example → .env (edit DB_PASSWORD, BETTER_AUTH_SECRET)

# Production (Hub images)
make up             # docker compose up -d
make down
make logs

# Development
make dev            # full hot-reload stack
make dev-infra      # postgres + redis only, then run pnpm dev on the host

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

## Kubernetes (Helm)

A Helm chart is available in `.k8s/helm/archispark/`. It deploys the full stack (api, web, mcp-server, postgres, redis) with an NGINX Ingress — the same topology as the Docker Compose setup.

### Prerequisites

| Tool | Install |
|------|---------|
| `helm` ≥ 3.x | `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \| bash` |
| `kubectl` | `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` |
| Kubernetes cluster | Any cluster with an **NGINX Ingress Controller** (minikube, k3s, GKE, EKS…) |

**Local cluster with minikube (Docker driver) :**

```bash
minikube start --driver=docker --cpus=4 --memory=6g --addons=ingress
```

### Install

```bash
# Minimal install (replace values with your own)
helm install archispark .k8s/helm/archispark \
  --namespace archispark --create-namespace \
  --set config.webUrl=http://archispark.local \
  --set ingress.host=archispark.local \
  --set secrets.dbPassword=<motdepasse> \
  --set secrets.betterAuthSecret=$(openssl rand -hex 32) \
  --set secrets.seedAdminPassword=admin
```

With TLS (cert-manager or manual secret):

```bash
helm install archispark .k8s/helm/archispark \
  --namespace archispark --create-namespace \
  --set config.webUrl=https://archispark.example.com \
  --set ingress.host=archispark.example.com \
  --set ingress.tls.enabled=true \
  --set ingress.tls.secretName=archispark-tls \
  --set secrets.dbPassword=<motdepasse> \
  --set secrets.betterAuthSecret=$(openssl rand -hex 32)
```

**minikube local DNS** (add Ingress IP to `/etc/hosts`):

```bash
echo "$(minikube ip) archispark.local" | sudo tee -a /etc/hosts
```

### Key values

| Value | Default | Description |
|-------|---------|-------------|
| `image.os` | `alpine` | Image variant: `alpine` or `trixie-slim` |
| `image.tag` | `latest` | Image tag (use a pinned version in production, e.g. `0.4.0`) |
| `ingress.host` | `archispark.example.com` | Hostname served by the Ingress |
| `ingress.className` | `nginx` | Ingress class |
| `ingress.tls.enabled` | `false` | Enable TLS |
| `secrets.dbPassword` | — | **Required** — PostgreSQL password |
| `secrets.betterAuthSecret` | — | **Required** — HMAC secret ≥ 32 chars for Better Auth |
| `secrets.seedAdminPassword` | `admin` | Initial admin password |
| `secrets.existingSecret` | `""` | Name of a pre-existing K8s Secret (Sealed Secrets, ESO…) |
| `postgres.storage` | `5Gi` | PostgreSQL PVC size |
| `redis.storage` | `1Gi` | Redis PVC size |

See [`.k8s/helm/archispark/values.yaml`](.k8s/helm/archispark/values.yaml) for the full list.

### Upgrade / uninstall

```bash
# Upgrade (keep existing values)
helm upgrade archispark .k8s/helm/archispark --namespace archispark --reuse-values

# Uninstall (keeps PVCs — data is preserved)
helm uninstall archispark --namespace archispark

# Full wipe including data
helm uninstall archispark --namespace archispark
kubectl delete pvc -n archispark --all
```

### Routing

| Path | Backend | Notes |
|------|---------|-------|
| `/api/*` | `archispark-api:3000` | `/api` prefix stripped before forwarding |
| `/auth/*` | `archispark-api:3000` | Better Auth handles the full path |
| `/mcp/*` | `archispark-mcp:3001` | MCP Streamable HTTP (Bearer token required) |
| `/` | `archispark-web:8000` | Next.js catch-all |

### MCP Server on Kubernetes

Once deployed, generate a personal API token in the web UI (**Mon profil → Tokens API → Nouveau token**) and configure Claude Code:

```bash
claude mcp add archimate \
  http://archispark.local/mcp/ \
  --transport http \
  --header "Authorization: Bearer <your-token>"
```

## Demo seed

Two sample ArchiMate models are available for demo or local testing: **ArchiMetal** (294 elements, 476 relationships, 33 views) and **ArchiSurance** (257 elements, 402 relationships, 40 views).

The seed is **idempotent** — each workspace is skipped if one with the same name already exists.

```bash
# Requires DATABASE_URL (or POSTGRES_URL) pointing to a running Postgres instance.
pnpm seed:demo

# Equivalent alternatives:
pnpm --filter @workspace/db seed:demo
psql $DATABASE_URL -f packages/db/seeds/demo.sql
```

### Restore demo data on Vercel (GitHub Actions)

The workflow **Actions → Restore demo data** can be triggered manually from GitHub to reset the Vercel Postgres database to the demo state.

**Required GitHub secret** — add `POSTGRES_URL_NON_POOLING` to the repository secrets (Settings → Secrets and variables → Actions). Copy the value from the Vercel project environment variables.

The workflow offers a **reset** checkbox (on by default): when checked it deletes the existing ArchiMetal and ArchiSurance workspaces (all child data is removed via CASCADE) before re-seeding. Uncheck it to seed only if those workspaces do not yet exist.

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

All routes except `/auth/*`, `GET /openapi.json`, and `GET /docs` require a valid session (cookie set by Better Auth sign-in).  
Write operations (`POST`, `PUT`, `DELETE`) outside `/auth/*` require the `admin` role.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/sign-in/email` | public | Sign in — sets session cookie |
| `POST` | `/auth/sign-out` | user | Sign out |
| `GET` | `/me` | user | Returns current user |

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
| `DELETE` | `/workspaces/:id` | Delete workspace (deleting the active one switches to another; deleting the last one is allowed and leaves zero — the web UI then redirects to its `/workspaces` page to create a new one) |
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

**Authentication:** when `MCP_AUTH_TOKEN` is set on the server, all requests must include `Authorization: Bearer <token>`. Generate and copy the token from **Settings → MCP** in the web UI, then configure your client:

```bash
claude mcp add archimate \
  http://localhost:3001/mcp/ \
  --transport http \
  --header "Authorization: Bearer <token>"
```

**Available tools (27):**  
`get_model_info`, `list_element_types`, `list_elements`, `get_element`,  
`list_relationship_types`, `list_relationships`, `get_relationship`,  
`list_views`, `get_view`, `create_view`, `create_node`,  
`create_element`, `update_element`, `delete_element`,  
`create_relationship`, `update_relationship`, `delete_relationship`,  
`list_property_definitions`, `get_property_definition`, `create_property_definition`, `update_property_definition`, `delete_property_definition`,  
`render_view`, `save_model`.

Interactive docs: `GET /docs` — OpenAPI spec: `GET /openapi.json`.

## Tests

```bash
pnpm run -w test            # 637 tests across all packages
pnpm run -w test:coverage   # ≥80% coverage required
```

## Vercel

1. **Link Supabase** — In Vercel → Storage, attach your Supabase project to both `archispark-api` and `archispark-web`. This auto-injects `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, etc.

2. **Set environment variables** — grab a Vercel token from Account Settings → Tokens, then:

```bash
VERCEL_TOKEN=xxx \
SEED_ADMIN_PASSWORD=<strong-password> \
SEED_USER_PASSWORD=<another-password> \
bash apps/api/scripts/setup-vercel-env.sh
```

The script configures:

| Variable | Project | Value |
|---|---|---|
| `BETTER_AUTH_SECRET` | api | (auto-generated) |
| `WEB_URL` | api | your public URL |
| `TRUSTED_ORIGINS` | api | your public URL |
| `SEED_ADMIN_PASSWORD` | api | your choice |
| `SEED_USER_PASSWORD` | api | your choice |
| `ARCHIMATE_API_URL` | web | API Vercel deployment URL |
