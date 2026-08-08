# Persistence & Architecture

All data lives in a single shared PostgreSQL database, used by `apps/server`.
Schema follows ArchiMate 3 Open Exchange XSDs (`models/xsd/`).

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
(`/api/platform/organizations*`, metadata only) but is structurally denied
any access to organization content, enforced once in
[`apps/server/lib/archimate/access.ts`](../apps/server/lib/archimate/access.ts)
rather than left to be remembered at every call site. See
[Authentication](authentication.md) for the full role matrix.

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

## `apps/server`

`apps/server` is the single application — a Next.js app combining the
workspace UI, the REST API, and the MCP server in one process and one
deployment. It owns authentication (`requireAuth`, verifying a Keycloak
access token via JWKS or a personal API token), personal settings (`/api/me`,
`/api/settings/api-tokens`, `/api/settings/messages`), organization/member
management (`/api/organizations*`, `/api/platform/organizations*`), every
ArchiMate modeling route (`/api/workspaces`, `/api/elements`,
`/api/relationships`, `/api/views`, `/api/property-definitions`,
`/api/export`, `/api/import`, `/api/openapi.json`, `/api/docs`), and the MCP
transport (`/mcp/`, ~38 tools). REST routes are Next.js App Router Route
Handlers (`app/api/**/route.ts`); the MCP transport is a Pages Router route
(`pages/api/mcp.ts`) — the only exception, required because the MCP SDK's
`StreamableHTTPServerTransport` needs a raw Node `http.IncomingMessage`/
`ServerResponse`, which only the Pages Router exposes. Every
workspace/organization route resolves access through the single
authorization gateway,
[`apps/server/lib/archimate/access.ts`](../apps/server/lib/archimate/access.ts)
(`resolveActiveContext`/`assertOrgAccess`/`assertWorkspaceAccess`) — a user
sees and acts on every workspace of every organization they belong to,
subject to their role (`owner`/`admin`: read+write, `member`: read-only).

The MCP tools (`apps/server/lib/mcp/`) import `lib/archimate/store.ts`/
`registry.ts` directly — same process, same module graph, no HTTP hop and no
package boundary to cross — authenticated via the same personal API tokens
as the REST API.

Self-hosted Docker: `apps/server` is the only application Compose service,
reached through Traefik. Vercel: `apps/server` is its own project (root
directory `apps/server`) — see [Vercel](deployment.md#vercel).
