# Persistence & Multi-Tenant Architecture

All data lives in PostgreSQL, shared between the API and MCP server.  
Schema follows ArchiMate 3 Open Exchange XSDs (`models/xsd/`).

The test suite runs against [PGlite](https://pglite.dev) (Postgres compiled to
WASM, in-memory) — full Postgres fidelity, no Docker required.

## Multi-tenant database architecture

The schema is split into two logical parts: **control-plane** (`schema.control.ts`
— identity, organizations/teams/members, API tokens, OAuth providers, site
settings, and the tenant database registry) and **tenant** (`schema.tenant.ts`
— workspaces and all ArchiMate content). An organization is moved to its own
dedicated Postgres database — Neon in preview/production, or a sibling
database on the local dev Postgres instance (see
[Provisioning tenant databases](#provisioning-tenant-databases)) — by adding a
`tenant_databases` row with `status: "active"`; until then its content stays
in the shared (control-plane) database.

`TENANT_DB_ENCRYPTION_KEY` — required once any `tenant_databases` row is
`active`, including locally-provisioned ones. Encrypts/decrypts the per-tenant
connection string at rest (AES-256-GCM, key derived from this value via
scrypt).

To generate a migration after a schema change:

```bash
cd packages/db
DB_DRIVER=postgres npx drizzle-kit generate                                # control-plane: writes to drizzle-pg/
DB_DRIVER=postgres npx drizzle-kit generate --config drizzle.config.tenant.ts  # tenant: writes to drizzle-pg/tenant/
```

### Provisioning tenant databases

`provisionTenantDatabase(organizationId)` is the entry point — it dispatches
to one of two backends depending on environment, both producing the same
`tenant_databases` row shape (`status`, `neonProjectId`, `neonDatabaseName`,
`neonRoleName`, encrypted connection string):

- **Neon (preview/production)** — set `NEON_API_KEY` and `NEON_PROJECT_ID`
  (apps/control-api only, never exposed to the frontend). `NEON_BRANCH_ID` is
  optional — defaults to the project's default branch. Creates a dedicated
  Neon role + database (named `tenant_<sanitized org id>`).
- **Local Postgres (dev)** — when Neon isn't configured and `DATABASE_URL`
  points at the docker-compose dev Postgres (`canProvisionLocally()`), creates
  a sibling database `tenant_<sanitized org id>` on that same instance,
  reusing the `archispark` role from `DATABASE_URL`. `neonProjectId` is stored
  as `null`. See `packages/db/src/local-provisioning.ts`.
- If neither is available, `provisionTenantDatabase` is a no-op and the
  organization keeps sharing the control-plane database; `getTenantDb`/`db`
  fall back to it and `tenant_status` is reported as `null` ("Partagée" in
  admin-web).

Either way, provisioning runs the tenant-only migrations (`drizzle-pg/tenant/`,
generated from `schema.tenant.ts` — no control-plane FKs), seeds an empty
"Default" workspace, encrypts and stores the connection string in
`tenant_databases`, and marks it `"active"`. Failures mark the row `"error"`
(retryable).

- **New organizations**: super-admins create them via
  `POST /admin/organizations` in admin-web ("Nouvelle organisation"), which
  provisions the dedicated database immediately. There is no self-service
  organization creation — every organization is created this way.
- **Existing/errored organizations**: `POST /admin/organizations/:id/reprovision`
  (admin-web) or `pnpm --filter control-api migrate-tenant <organizationId>`
  retries provisioning. The CLI also copies all of the organization's
  workspaces (full ArchiMate content, `workspace_teams`, and
  `user_active_workspace`) into the new database, then marks
  `tenant_databases` `"active"`. The shared database rows are left untouched.
  Use `--all` to migrate every organization not yet active/provisioning. Once
  the new database is verified, re-run with `--cleanup --yes` (or
  `--all --cleanup --yes`) to irreversibly delete the now-redundant rows from
  the shared database — refuses unless the tenant database is `"active"` and
  holds at least as many workspaces as the shared database.
- `GET /admin/neon/status` reports `{ configured, reachable, provider }`,
  where `provider` is `"neon"`, `"local"`, or `"none"` — admin-web only
  disables "Nouvelle organisation" when `provider === "none"`.

### Initial organization owner

Platform admins have no access to tenant data — creating an organization via
`POST /admin/organizations` never adds the calling admin as a member of it.
The new organization needs an initial `owner`:

- **Generated account (default)**: if `initial_owner_user_id` is omitted, a
  fresh `admin-<slug>` account with a random password is created as `owner`
  and returned once in the response as `initial_owner: { username, password }`
  for the calling admin to hand to the customer. It is never shown again.
- **Existing user**: pass `initial_owner_user_id` (an existing platform
  user's id) to make that user `owner` instead — no account is generated and
  `initial_owner` is absent from the response.

The owner — generated or existing — is added as a member of the new Keycloak
organization with the `owner` role using its Keycloak `sub` (a generated
account's `sub` is its Keycloak Admin API id, see
[User provisioning](administration.md#user-provisioning-keycloak-admin-api)).

If tenant database provisioning then fails, the organization (and any
generated owner account) is rolled back and the request returns `503`.

`createTenantDb(connectionString)` picks the driver based on the connection
string (`isLocalConnectionString`): local Postgres connections (docker-compose
dev) use `drizzle-orm/node-postgres` (`pg.Pool`); everything else (Neon) uses
`drizzle-orm/neon-serverless` (websocket `Pool`), which supports real
interactive transactions — required by `seedWorkspace`/`modelToDb`. The
control-plane database always uses `drizzle-orm/node-postgres` (`pg.Pool`, or
PGlite in tests).

## Control-api / tenant-api split

`apps/control-api` is the single public entry point — it owns authentication,
sessions, API tokens, organizations/teams, settings, and the platform admin
routes (`/me`, `/users*`, `/admin/organizations*`, `/settings/*`).
Everything else (workspaces, elements, relationships, views,
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
| `NEON_API_KEY` / `NEON_PROJECT_ID` / `NEON_BRANCH_ID` | ✅ | — | — |
| `TENANT_API_URL` | ✅ (where to proxy) | — | — |
| `TENANT_JWT_SECRET` | ✅ (sign) | ✅ (verify) | — |
| `TENANT_DB_ENCRYPTION_KEY` | — | ✅ (decrypt `tenant_db`) | ✅ |
| `TENANT_DB_PASSWORD` | ✅ (creates/maintains `archispark_tenant` role) | — | — |

## Tenant Postgres role

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
[Vercel](deployment.md#vercel).
