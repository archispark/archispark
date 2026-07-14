# Persistence & Architecture

All data lives in a single shared PostgreSQL database, used by `apps/api` and
`apps/mcp-server`. Schema follows ArchiMate 3 Open Exchange XSDs
(`models/xsd/`).

The test suite runs against [PGlite](https://pglite.dev) (Postgres compiled to
WASM, in-memory) — full Postgres fidelity, no Docker required.

## Database schema

`packages/db/src/schema.ts` defines every table in one place, following an
**Organisation → Workspace** hierarchy: `organizations` (`slug`, `name`,
`isPersonal`, `enabled` — a suspension flag settable only by a
`platform_admin`), `organizationMembers` (`organizationId`, `userId` — a
Keycloak `sub` — and `role`: `"owner" | "admin" | "member"`),
`organizationInvitations` (email-based invitations — `email`, `role`,
`tokenHash` (SHA-256 of a random token, the clear-text token itself is
never persisted), `expiresAt`/`sentAt`/`acceptedAt`/`revokedAt`; a partial
unique index on `(organizationId, email)` restricted to rows where
`acceptedAt IS NULL AND revokedAt IS NULL` enforces at most one active
invitation per organization/e-mail pair — see
[Organization invitations by e-mail](authentication.md#organization-invitations-by-e-mail)),
`userActiveOrganization` (per-user pointer to the organization currently in
use), `siteSettings` (login/banner messages), `apiTokens` (personal API
tokens, each scoped to one `organizationId` and optionally pinned to one
`workspaceId`), `workspaces` (each belonging to exactly one organization —
`organizationId`; `createdById`, a Keycloak `sub`, is traceability only and
never used for access control), `userActiveWorkspace` (per-user,
per-organization pointer to the workspace currently in use), and the
ArchiMate content tables (`elements`, `relationships`,
`propertyDefinitions`, `elementProperties`, `relationshipProperties`,
`views`, `nodes`, `connections`, `bendpoints`), all keyed by `workspace_id`
with cascading foreign keys.

A fourth role, `platform_admin`, is a Keycloak **realm** role (not an
`organization_members` row) — it administers organizations
(`/platform/organizations*`, metadata only) but is structurally denied any
access to organization content, enforced once in
[`apps/api/src/access.ts`](../apps/api/src/access.ts) rather than left to be
remembered at every call site. See [Authentication](authentication.md) for
the full role matrix.

There is no local `users` table — identities live entirely in Keycloak.
`apiTokens.userId`/`organizationMembers.userId`/`workspaces.createdById` are
plain Keycloak `sub` values.

`apiTokens.organizationId`/`workspaces.organizationId` are nullable at the
DB level only during the expand→backfill→contract
migration window (see
[`packages/db/src/backfill-organizations.ts`](../packages/db/src/backfill-organizations.ts));
the backfill runs automatically right after migrations, before the app
serves any traffic, so every row the application ever reads has one.

To generate a migration after a schema change:

```bash
cd packages/db
npx drizzle-kit generate   # writes to drizzle-pg/
```

## `apps/api`

`apps/api` is the single backend service — it owns authentication
(`requireAuth`, verifying a Keycloak access token via JWKS or a personal API
token), personal settings (`/me`, `/settings/api-tokens`,
`/settings/messages`), organization/member management (`/organizations*`,
`/platform/organizations*`), and every ArchiMate modeling route
(`/workspaces`, `/elements`, `/relationships`, `/views`,
`/property-definitions`, `/export`, `/import`, `/openapi.json`, `/docs`).
Every workspace/organization route resolves access through the single
authorization gateway,
[`apps/api/src/access.ts`](../apps/api/src/access.ts)
(`resolveActiveContext`/`assertOrgAccess`/`assertWorkspaceAccess`) — a user
sees and acts on every workspace of every organization they belong to,
subject to their role (`owner`/`admin`: read+write, `member`: read-only).

`apps/mcp-server` reads/writes the same database directly (in-process import
of `apps/api`'s `store`/`registry` modules, not an HTTP call), authenticated
via the same personal API tokens as the REST API.

Self-hosted Docker: `apps/api` runs as the only backend Compose service,
reached by `web` and `mcp-server` over the `archispark` network. Vercel:
`apps/api` is its own project (`archispark-api`, root directory `apps/api`)
— see [Vercel](deployment.md#vercel).
