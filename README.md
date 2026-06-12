# ArchiSpark

ArchiMate 3.1 modeling tool — REST API, MCP server, and web UI.

## Stack

| Layer | Tech |
|-------|------|
| API | Express + TypeScript ESM, PostgreSQL (Drizzle ORM), Better Auth (sessions) |
| MCP | `@modelcontextprotocol/sdk` — Streamable HTTP transport, Bearer token auth |
| Web | Next.js 16, React, shadcn/ui, Vercel Analytics + Speed Insights |
| Admin web | Next.js 16 — platform admin console (`apps/admin-web`), `platform_admin` only |
| Cache | Redis (required) — session store + distributed rate-limiting |

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

Redis is **required** — set `REDIS_URL` (e.g. `redis://localhost:6379`). It is used
for session storage and distributed rate-limiting. The API will fail to start without it.

## Docker & Makefile

Two Docker Compose files cover every deployment mode:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Production** — pulls published images from Docker Hub (Traefik, control-api, tenant-api, mcp-server, web, PostgreSQL, Redis) |
| `docker-compose.dev.yml` | **Development infra** — PostgreSQL + Redis only, used by `make dev-infra` while apps run via `pnpm dev` |

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

Each model is seeded into its own demo organization (`ArchiMetal` / `ArchiSurance`). Every existing user is added as a member of both (`owner` if their platform role is `admin`, `member` otherwise) with that organization's workspace set as their active workspace.

The seed is **idempotent** — re-running it upserts the demo organizations/memberships and replaces the matching workspace's content.

```bash
# Requires DATABASE_URL (control DB) and TENANT_DATABASE_URL (tenant DB).
pnpm seed:demo

# Equivalent alternatives:
pnpm --filter @workspace/db seed:demo
psql $DATABASE_URL -f packages/db/seeds/demo.sql
```

### Restore demo data on Vercel (GitHub Actions)

The workflow **Actions → Restore demo data** can be triggered manually from GitHub to reset the Vercel Postgres database to the demo state.

**Required GitHub secrets** — add `DATABASE_URL_UNPOOLED` (Neon control DB direct URL) and `TENANT_DATABASE_URL_UNPOOLED` (Neon tenant fallback DB direct URL) to the repository secrets (Settings → Secrets and variables → Actions). Copy the values from the Vercel project environment variables.

The workflow offers a **reset** checkbox (on by default): when checked it deletes the existing ArchiMetal and ArchiSurance workspaces (all child data is removed via CASCADE) before re-seeding. Uncheck it to seed only if those workspaces do not yet exist.

## Persistence

All data lives in PostgreSQL, shared between the API and MCP server.  
Schema follows ArchiMate 3 Open Exchange XSDs (`models/xsd/`).

The test suite runs against [PGlite](https://pglite.dev) (Postgres compiled to
WASM, in-memory) — full Postgres fidelity, no Docker required.

### Multi-tenant database architecture

The schema is split into two logical parts: **control-plane** (`schema.control.ts`
— identity, organizations/teams/members, API tokens, OAuth providers, site
settings, and the tenant database registry) and **tenant** (`schema.tenant.ts`
— workspaces and all ArchiMate content). An organization is moved to its own
dedicated Postgres database (Neon) by adding a `tenant_databases` row with
`status: "active"` — until then its content stays in the shared (control-plane)
database.

`TENANT_DB_ENCRYPTION_KEY` — required once any `tenant_databases` row is
`active`. Encrypts/decrypts the per-tenant connection string at rest
(AES-256-GCM, key derived from this value via scrypt).

To generate a migration after a schema change:

```bash
cd packages/db
DB_DRIVER=postgres npx drizzle-kit generate                                # control-plane: writes to drizzle-pg/
DB_DRIVER=postgres npx drizzle-kit generate --config drizzle.config.tenant.ts  # tenant: writes to drizzle-pg/tenant/
```

#### Provisioning tenant databases (Neon)

Set `NEON_API_KEY` and `NEON_PROJECT_ID` (apps/control-api only, never exposed
to the frontend) to enable per-tenant Neon databases. `NEON_BRANCH_ID` is optional —
defaults to the project's default branch. While these are unset, every
organization keeps sharing the control-plane database (transitional mode);
`getTenantDb`/`db` fall back to it.

- **New organizations**: `provisionTenantDatabase(organizationId)` runs
  automatically via the Better Auth `afterCreateOrganization` hook. It creates
  a dedicated Neon role + database (named `tenant_<sanitized org id>`), runs
  the tenant-only migrations (`drizzle-pg/tenant/`, generated from
  `schema.tenant.ts` — no control-plane FKs), seeds an empty "Default"
  workspace, encrypts and stores the connection string in `tenant_databases`,
  and marks it `"active"`. Failures mark the row `"error"` (retryable).
- **Existing organizations**: `pnpm --filter control-api migrate-tenant <organizationId>`
  provisions the dedicated database and copies all of the organization's
  workspaces (full ArchiMate content, `workspace_teams`, and
  `user_active_workspace`) into it, then marks `tenant_databases` `"active"`.
  The shared database rows are left untouched. Use `--all` to migrate every
  organization not yet active/provisioning. Once the new database is verified,
  re-run with `--cleanup --yes` (or `--all --cleanup --yes`) to irreversibly
  delete the now-redundant rows from the shared database — refuses unless the
  tenant database is `"active"` and holds at least as many workspaces as the
  shared database.

Tenant databases use `drizzle-orm/neon-serverless` (websocket `Pool`), which
supports real interactive transactions — required by `seedWorkspace`/`modelToDb`.
The control-plane database always uses `drizzle-orm/node-postgres`
(`pg.Pool`, or PGlite in tests).

### Control-api / tenant-api split

`apps/control-api` is the single public entry point — it owns Better Auth,
sessions, API tokens, organizations/teams, settings, and the platform admin
routes (`/me`, `/users*`, `/admin/organizations*`, `/settings/*`,
`/auth/*`). Everything else (workspaces, elements, relationships, views,
property definitions, model import/export, `/openapi.json`, `/docs`) is
implemented by `apps/tenant-api`, an internal data-plane service that
control-api reverse-proxies to.

For every proxied request, control-api runs its usual
`requireAuth` → `resolveWorkspaceContext` → `requireWorkspaceWrite` checks
(so 401/403 happen without ever reaching tenant-api), then signs a
short-lived (60s) inter-service JWT and forwards the request to
`TENANT_API_URL` with `Authorization: Bearer <token>`. tenant-api verifies
the token with the shared `TENANT_JWT_SECRET` and reconstructs
`req.user`/`req.workspace` from its claims:

```ts
{ sub, username, platform_role, organization_id, org_role, team_ids, tenant_db }
```

`tenant_db` is the organization's **encrypted** Neon connection string (or
`null` for organizations still on the shared database) — control-api passes
it through without decrypting it; only tenant-api (and mcp-server) hold
`TENANT_DB_ENCRYPTION_KEY`.

Credential separation:

| Env var | control-api | tenant-api | mcp-server |
|---|---|---|---|
| `DATABASE_URL` | ✅ (control DB — `archispark`) | — | ✅ (control DB) |
| `TENANT_DATABASE_URL` | — | ✅ (fallback DB — `archispark_tenant`) | ✅ (fallback DB) |
| `JWT_SECRET` | ✅ (Better Auth) | — | — |
| `NEON_API_KEY` / `NEON_PROJECT_ID` / `NEON_BRANCH_ID` | ✅ | — | — |
| `TENANT_API_URL` | ✅ (where to proxy) | — | — |
| `TENANT_JWT_SECRET` | ✅ (sign) | ✅ (verify) | — |
| `TENANT_DB_ENCRYPTION_KEY` | — | ✅ (decrypt `tenant_db`) | ✅ |
| `TENANT_DB_PASSWORD` | ✅ (creates/maintains `archispark_tenant` role) | — | — |
| `REDIS_URL` | ✅ | ✅ | ✅ |

### Tenant Postgres role

Phase 7 adds physical database separation and a restricted `archispark_tenant` Postgres role:

- **`archispark`** (control DB, `DATABASE_URL`) — control-plane only: users, sessions,
  organizations, tenant registry. Never accessed by tenant-api.
- **`archispark_tenant`** (tenant fallback DB, `TENANT_DATABASE_URL`) — shared fallback for
  organizations not yet provisioned with a dedicated Neon DB. Tenant-api and mcp-server
  connect here in fallback mode using the restricted `archispark_tenant` role.

The `archispark_tenant` role has `SELECT/INSERT/UPDATE/DELETE` on the 12 tables in
`schema.tenant.ts` and `USAGE` on all sequences. It cannot read any control-plane table.

`control-api` calls `ensureTenantRole(TENANT_DB_PASSWORD)` at startup (after migrations),
creating the role if absent and keeping its grants in sync.

**Maintenance:** when adding a new table to `schema.tenant.ts`, also add its SQL name
to `TENANT_TABLES` in `packages/db/src/tenant-role.ts` — grants reapply on next restart.

Self-hosted Docker: `tenant-api` runs as an internal-only Compose service
(no Traefik labels), reached by `control-api` over the `archispark` network
at `http://tenant-api:3002`. Vercel: `tenant-api` is its own project
(`archispark-tenant-api`, root directory `apps/tenant-api`), reached at its
default `*.vercel.app` deployment URL (no custom domain needed) — see
[Vercel](#vercel).

## Authentication

All routes except `/auth/*`, `GET /openapi.json`, `GET /docs`, and `GET /settings/messages` require a valid session (cookie set by Better Auth sign-in) or an `Authorization: Bearer <token>` API token.

Every authenticated request resolves an **active organization** — from the API token, the session's active organization, or (failing that) the user's first organization membership — and attaches the user's role and team memberships in that organization to the request.

Write operations (`POST`, `PUT`, `DELETE`) on workspace content require the `owner` or `admin` role in the active organization (or the platform super admin role, see below); plain `member`s are read-only. `/auth/*`, `/users*`, and `/settings/api-tokens*` are exempt from this check.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/sign-in/username` | public | Sign in (`{ username, password }`) — sets session cookie |
| `POST` | `/auth/sign-out` | user | Sign out |
| `GET` | `/me` | user | Returns current user |
| `/auth/organization/*` | — | user | Better Auth organization plugin: list/create organizations, invite/remove members, manage teams, switch active organization, etc. |

Default credentials: `admin` / `admin` (`platform_admin`, org `owner`), `user` / `user` (org `member`, read-only), `contrib` / `contrib` (org `admin`), `archi` / `archi` (org `owner`).

### Cross-subdomain sessions (SaaS topology)

By default the session cookie is scoped to whichever origin served the
request (works for self-hosted single-domain deployments). When `apps/web`
and `apps/admin-web` are deployed on subdomains of the same root domain (e.g.
`app.example.com` / `admin.example.com`), set `COOKIE_DOMAIN=.example.com` on
`apps/control-api` — Better Auth then issues the session cookie for that root domain,
so signing in on either subdomain authenticates both. Also list every
subdomain origin in `TRUSTED_ORIGINS` (comma-separated).

## Organizations & teams

ArchiSpark is multi-tenant: each **organization** ("entreprise") has its own members, teams, and workspaces.

- **Roles** (Better Auth organization plugin): `owner`, `admin`, `member` — scoped per organization. `owner`/`admin` can manage members, invitations, teams, and workspace content; `member` has read-only access.
- **Platform super admin**: a user with the global `role: "platform_admin"` (set via the [admin web](#admin-web) `/users` page, or `POST`/`PUT /users`) bypasses organization role checks everywhere and can create new organizations (`allowUserToCreateOrganization`).
- **Teams** group members within an organization. A workspace with one or more `team_ids` is only visible to members of those teams (plus org owners/admins); a workspace with no teams is visible to the whole organization.
- Each user has one **active workspace per organization**, switched via `POST /workspaces/:id/activate`.
- A platform super admin can **suspend** an organization (`organizations.enabled = false`). Members of a suspended organization (other than platform super admins) get `403 Forbidden` on every request while it's resolved as their active organization; their data is left intact and access resumes once the organization is reactivated.

Org owners/admins (and platform super admins) see an **Organization** entry in the sidebar, opening a dedicated section (`/organization`) with its own sidebar and two tabs: **Workspace** (list every workspace in the organization — create, activate, rename, assign teams, or delete each one) and **Membres** (manage members, invitations, and teams). The platform-wide list of organizations across every tenant is managed separately from the [admin web](#admin-web) console (`/organizations`, platform super admins only).

**Settings** (`/settings`, visible to all users) is for importing/exporting the active workspace's model.

## Admin web

`apps/admin-web` is a separate Next.js app (port **8001**) providing a platform-wide admin console, restricted to users with `role: "platform_admin"` — anyone else is redirected to `/login`.

| Route | Purpose |
|-------|---------|
| `/login` | Sign in (shares the Better Auth session with the main API) |
| `/organizations` | List, create, rename, and delete organizations across every tenant (default landing page); also shows a read-only **tenant monitoring** table (tenant database status + enabled/suspended state per organization) with suspend/reactivate actions |
| `/users` | Manage platform users — create/update/delete, assign the `platform_admin` role |
| `/authentication` | Manage OAuth/SSO providers |
| `/redis` | Redis connection status |
| `/postgres` | PostgreSQL connection status |
| `/messages` | Configure the login-page message and the site-wide banner |

### User management API (platform admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List all users |
| `POST` | `/users` | Create user — body: `{ username, password, role? }`. The new user is added as a member of the requester's active organization (`owner` if `role === "platform_admin"`, otherwise `member`) |
| `PUT` | `/users/:id` | Update password and/or role |
| `DELETE` | `/users/:id` | Delete user (last user protected) |

### Organization monitoring API (platform admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/organizations` | List every organization with `enabled` flag and `tenant_status` (`tenant_databases.status`, or `null` if it shares the control-plane database) |
| `PUT` | `/admin/organizations/:id` | Suspend or reactivate an organization — body: `{ enabled: boolean }` |

## Workspace management

*tenant-api route — see [Control-api / tenant-api split](#control-api--tenant-api-split).*

Workspaces belong to an organization (`organization_id`) and are listed only if the current user is a member of that organization (and, when `team_ids` is non-empty, a member of one of those teams or an org owner/admin).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces` | List workspaces visible to the current user in the active organization |
| `POST` | `/workspaces` | Create workspace — body: `{ name, path?, description?, team_ids? }` (`path` = XML file to import; org owner/admin only) |
| `PUT` | `/workspaces/:id` | Rename workspace and/or update `team_ids` (org owner/admin only) |
| `DELETE` | `/workspaces/:id` | Delete workspace (org owner/admin only; deleting the active one switches to another in the organization; deleting the last one is allowed and leaves zero — the web UI then redirects to its `/workspaces` page to create a new one) |
| `POST` | `/workspaces/:id/activate` | Switch the current user's active workspace within the active organization |

## Model routes

*tenant-api route — see [Control-api / tenant-api split](#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Active workspace info + model metadata |
| `POST` | `/save` | No-op (writes are persisted immediately); kept for compatibility |
| `GET` | `/export` | Download model as Open Exchange XML |
| `POST` | `/import` | Replace the active workspace model from an XML body |

## Elements

*tenant-api route — see [Control-api / tenant-api split](#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/elements/types` | Sorted list of element types present in model |
| `GET` | `/elements` | List elements (`?type=`, `?name=`) |
| `GET` | `/elements/:id` | Get element |
| `POST` | `/elements` | Create element — `{ name, type, documentation?, properties? }` |
| `PUT` | `/elements/:id` | Update element (partial) |
| `DELETE` | `/elements/:id` | Delete element (cascades to relationships and view nodes) |

## Relationships

*tenant-api route — see [Control-api / tenant-api split](#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/relationships/types` | Sorted list of relationship types present |
| `GET` | `/relationships` | List (`?type=`, `?source_id=`, `?target_id=`) |
| `GET` | `/relationships/:id` | Get relationship |
| `POST` | `/relationships` | Create — `{ type, source, target, name?, documentation?, is_directed?, access_type?, influence_strength? }` |
| `PUT` | `/relationships/:id` | Update (partial) |
| `DELETE` | `/relationships/:id` | Delete |

## Views

*tenant-api route — see [Control-api / tenant-api split](#control-api--tenant-api-split).*

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

*tenant-api route — see [Control-api / tenant-api split](#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/property-definitions` | List |
| `GET` | `/property-definitions/:id` | Get |
| `POST` | `/property-definitions` | Create — `{ name, type? }` (types: `string`, `boolean`, `date`, `number`, `enumeration`) |
| `PUT` | `/property-definitions/:id` | Update |
| `DELETE` | `/property-definitions/:id` | Delete |

## MCP

Endpoint: `http://localhost:3001/mcp/`  
Transport: Streamable HTTP (MCP 2025-03-26), stateless (no session id — each request gets a fresh server instance, safe for serverless).

**Authentication:** every request requires `Authorization: Bearer <token>`, where `<token>` is a personal API token (`api_tokens` table, same tokens used for the REST API). Generate one from **Mon profil → Tokens API → Nouveau token** in the web UI, then configure your client:

```bash
claude mcp add archimate \
  http://localhost:3001/mcp/ \
  --transport http \
  --header "Authorization: Bearer <token>"
```

The token resolves the calling user's organization membership: write tools (`create_*`, `update_*`, `delete_*`, `activate_workspace`, `import_model`) require `owner`/`admin`/`platform_admin`; org `member`s get a read-only error. All tools operate on that organization's active workspace.

**Available tools (38), 2 prompts, 2 resources:**

| Group | Tools |
|---|---|
| Model | `get_model_info` |
| Elements | `list_element_types`, `list_elements`, `get_element`, `create_element`, `update_element`, `delete_element`, `get_element_relationships`, `list_elements_in_views` |
| Relationships | `list_relationship_types`, `list_relationships`, `get_relationship`, `create_relationship`, `update_relationship`, `delete_relationship` |
| Views | `list_views`, `get_view`, `create_view`, `update_view`, `delete_view`, `render_view` |
| Nodes | `create_node`, `update_node`, `delete_node` |
| Connections | `create_connection`, `update_connection`, `delete_connection` |
| Property definitions | `list_property_definitions`, `get_property_definition`, `create_property_definition`, `update_property_definition`, `delete_property_definition` |
| Workspaces | `list_workspaces`, `activate_workspace` |
| Viewpoints | `list_viewpoints` |
| Import / Export | `export_model`, `import_model` |
| Persistence | `save_model` (no-op, kept for compatibility) |

**Prompts:** `archimate-modeling-guide` (load ArchiMate 3.1 rules — call first), `create-viewpoint-view` (step-by-step view creation for a given viewpoint).  
**Resources:** `archimate://layers`, `archimate://relationships`.

Interactive docs: `GET /docs` — OpenAPI spec: `GET /openapi.json`.

## Tests

```bash
pnpm run -w test            # 669 tests across all packages
pnpm run -w test:coverage   # ≥80% coverage required
```

## Vercel

1. **Create the `archispark-tenant-api` project** (Phase 5, one-time) — import
   the repo as a second Vercel project with root directory `apps/tenant-api`.
   It's internal-only (no custom domain needed, the default `*.vercel.app`
   URL is fine — see [Control-api / tenant-api split](#control-api--tenant-api-split)).

2. **Add Neon** — In Vercel → Storage, add two Neon Postgres databases:
   - `archispark-control` → attached to `archispark-control-api` and `archispark-mcp-server`. Neon auto-injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
   - `archispark-tenant-fallback` → attached to `archispark-tenant-api`, `archispark-control-api`, and `archispark-mcp-server`. Rename the injected `DATABASE_URL` → `TENANT_DATABASE_URL` and `DATABASE_URL_UNPOOLED` → `TENANT_DATABASE_URL_UNPOOLED`.

3. **Apply database migrations** — run the control DB migrations manually, then deploy tenant-api so it auto-applies the tenant schema on first cold start:

```bash
# Control DB (migrations 0000 → 0012, runs against DATABASE_URL)
DATABASE_URL="<neon-control-pooled>" pnpm --filter @workspace/db migrate:prod

# Tenant DB — two options:
# Option A (recommended): deploy tenant-api with TENANT_DATABASE_URL set;
#   runTenantFallbackMigrations() applies drizzle-pg/tenant/ automatically on cold start.
# Option B (manual, if tenant-api not yet deployed):
DATABASE_URL="<neon-tenant-pooled>" pnpm --filter @workspace/db exec drizzle-kit migrate --config drizzle.config.tenant.ts
```

> **Important:** the tenant DB schema (`workspaces`, `elements`, `views`, etc.) is separate from the control DB schema and must be migrated independently. Forgetting this step results in "relation does not exist" errors on workspace creation.

4. **Set environment variables** — grab a Vercel token from Account Settings → Tokens, then:

```bash
VERCEL_TOKEN=xxx \
SEED_ADMIN_PASSWORD=<strong-password> \
SEED_USER_PASSWORD=<another-password> \
bash apps/control-api/scripts/setup-vercel-env.sh
```

The script configures:

| Variable | Project | Value |
|---|---|---|
| `BETTER_AUTH_SECRET` | api | (auto-generated) |
| `WEB_URL` | api | your public URL |
| `TRUSTED_ORIGINS` | api | your public URL |
| `SEED_ADMIN_PASSWORD` | api | your choice |
| `SEED_USER_PASSWORD` | api | your choice |
| `TENANT_API_URL` | api | `archispark-tenant-api`'s deployment URL |
| `TENANT_JWT_SECRET` | api, tenant-api | shared (auto-generated) |
| `TENANT_DB_ENCRYPTION_KEY` | tenant-api | auto-generated |
| `ARCHIMATE_API_URL` | web | API Vercel deployment URL |

5. **Redeploy** `archispark-control-api` and `archispark-tenant-api`.

### Subdomain topology (`app.<domain>` / `admin.<domain>`)

`apps/admin-web` deploys as its own Vercel project (root directory
`apps/admin-web`, same build/output settings as `archispark-web`). To run it
on a subdomain of the same root domain as the main app, with a single shared
login:

1. Create the `archispark-admin-web` Vercel project (root directory
   `apps/admin-web`, same team).
2. Attach `app.<domain>` to `archispark-web` and `admin.<domain>` to
   `archispark-admin-web`.
3. Re-run the script with the extra variables set:

```bash
VERCEL_TOKEN=xxx \
ADMIN_URL="https://admin.<domain>" \
COOKIE_DOMAIN=".<domain>" \
SEED_ADMIN_PASSWORD=<strong-password> \
SEED_USER_PASSWORD=<another-password> \
bash apps/control-api/scripts/setup-vercel-env.sh
```

This sets `archispark-admin-web`'s `ARCHIMATE_API_URL`, adds `ADMIN_URL` to
the api's `TRUSTED_ORIGINS`, and sets `COOKIE_DOMAIN` on the api so Better
Auth issues one session cookie shared by both subdomains (see
[Cross-subdomain sessions](#cross-subdomain-sessions-saas-topology)).
Redeploy all three projects afterwards.
