# Authentication

All routes except `GET /openapi.json`, `GET /docs`, and `GET /settings/messages` require a Keycloak access token — either as an `access_token` cookie (see [Keycloak login](#keycloak-login)) or an `Authorization: Bearer <token>` header — or a personal API token.

## Organizations and roles

Workspaces belong to **Organizations**, not directly to users. An
organization has members with one of three roles:

| Role | Read | Write (elements/relationships/views/…) | Manage members | Delete organization |
|------|------|------------------------------------------|-----------------|----------------------|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ❌ | ❌ |
| `member` | ✅ | ❌ | ❌ | ❌ |

Every organization/workspace route resolves the caller's role through the
single authorization gateway,
[`apps/api/src/access.ts`](../apps/api/src/access.ts) — never a per-route
check. Two-level error convention: `404 Not Found` if the caller has no
membership in the target organization (deliberately masks "not a member"
as "not found"), `403 Forbidden` if the caller **is** a recognized member
but their role is insufficient for the action, or the organization has been
suspended by a `platform_admin`.

A fourth role, **`platform_admin`**, is a Keycloak *realm* role (set on the
Keycloak user, not an `organization_members` row) — it administers
organizations from `/platform/organizations*` (metadata only: list,
suspend/reactivate, delete) but is **structurally denied** any access to
organization content (workspaces, elements, …), even if a stray
`organization_members` row happened to exist for that user — `access.ts`
rejects `platform_admin` unconditionally, before ever checking membership.

Every user gets a personal organization (`is_personal = true`)
auto-created the first time they create a workspace with no organization
selected — this preserves frictionless solo use. Creating a "team"
organization (`POST /organizations`) shared with other members is a
separate, explicit action. There is no email-invitation flow in v1 —
adding a member (`POST /organizations/:id/members`) requires an existing
Keycloak username.

`/settings/messages` (`PUT`) is restricted to users holding the global `platform_admin` realm role (`requireSuperAdmin`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/me` | user | Returns current user |

Default credentials: `admin` / `admin` (`platform_admin`, no organization membership by design), `user` / `user`, `contrib` / `contrib`, `archi` / `archi`, `open` / `open`. The demo seed creates two organizations, deliberately isolated from each other: `Archi` (`archi` as `owner`, `contrib`/`user` as `admin`/`member`) and `Open` (`open` as sole `owner`) — see [Demo seed](demo-data.md#demo-seed).

## Keycloak login

`docker compose -f .docker/docker-compose.dev.yml up -d --wait` also starts a local Keycloak (classic
`quay.io/keycloak/keycloak` distribution,
`http://localhost:8080`, admin console login from `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD`
in `.env.dev`), pre-loaded via `--import-realm` from
`.docker/keycloak/realm-export.json` with realm `archispark`, the client
`archispark-web`, the `platform_admin` realm role, and the api service
account (`archispark-api`, `manage-users`/`view-users`/`query-users`/`view-realm`).

The 4 demo accounts (`admin`/`user`/`contrib`/`archi`, passwords match
usernames) are **not** part of `realm-export.json` — they live in
`.docker/keycloak/demo-users.json` and are created/updated via the Keycloak
Admin API by `pnpm seed:demo-users` (`make seed-demo-users`, see
[Demo seed](demo-data.md#demo-seed)). Unlike `--import-realm`, this works against any
Keycloak instance, including a client's dedicated realm on a remote server.

`make keycloak-setup` (`pnpm setup:realm`) creates or updates the realm
itself (roles, clients, service account) from the same
`realm-export.json` via the Admin REST API — an alternative to
`--import-realm` for environments where the Keycloak container isn't
recreated from scratch (e.g. onboarding a new client's realm on a shared
remote Keycloak — see [Deployment](deployment.md#onboarding-dun-nouveau-client-un-realm-keycloak-dédié)).

## One Keycloak realm per client

Each ArchiSpark client gets its own Keycloak realm (`archispark-<tenant>`)
on a shared, self-hosted **classic Keycloak** instance (the same
`quay.io/keycloak/keycloak` distribution as local dev — see
[Deployment](deployment.md#kubernetes-helm)). A realm is a fully separate
identity namespace — its own users, roles, Identity Providers, sessions,
and JWKS/issuer — so this gives complete tenant isolation with **no
application code involved**:
[`verifyAccessToken`](../packages/auth/src/verify.ts) already validates the
token's `issuer` (`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`), which
includes the realm name. A token issued for `archispark-acme` is therefore
automatically rejected by a deployment configured with
`KEYCLOAK_REALM=archispark-other`.

Each client's `apps/api`/`apps/web` deployment simply points at its own
realm via env vars — `KEYCLOAK_URL` (the shared Keycloak instance),
`KEYCLOAK_REALM=archispark-<tenant>`, `KEYCLOAK_CLIENT_ID_WEB=archispark-web`,
`KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET` (the service
account created in that realm). SSO (Google/Microsoft/other OIDC or SAML)
is configured per realm via the admin console's *Identity providers* menu
— a client's SSO configuration is never visible to another client. See
[Deployment](deployment.md#onboarding-dun-nouveau-client-un-realm-keycloak-dédié)
for the full onboarding runbook.

**Bearer token:** `apps/api` (via `@workspace/auth`, `packages/auth`)
accepts a Keycloak-issued access token as a Bearer token, verified against
the realm's JWKS (`KEYCLOAK_URL`/`KEYCLOAK_REALM`). `req.user` is built
directly from the verified claims — `id: claims.sub`,
`username: claims.preferred_username`, and `role: "platform_admin"` if
`realm_access.roles` includes `platform_admin` (`"user"` otherwise).
A request may alternatively present a personal API token
(`apiTokens` table) as the Bearer value — `lookupApiToken` resolves it to
the same `req.user` shape via the Keycloak Admin API. A token is created
scoped to one organization (`organization_id`, required) and optionally
pinned to one workspace of that organization (`workspace_id`); this scope
is carried as `req.tokenContext` and takes priority over interactive
active-organization/workspace selection in `resolveActiveContext`. The
token's `owner`/`admin`/`member` role is **never** frozen on the token
itself — it's re-resolved live from `organization_members` on every
request, so a revoked or demoted membership takes effect immediately even
for an existing token.

**Browser login for `apps/web`:** the app signs in via the OIDC
authorization-code + PKCE flow against Keycloak. `/login` is a single "Se
connecter" link to `/api/auth/login`, using the `KEYCLOAK_CLIENT_ID_WEB`
client (`archispark-web`).

| Route | Purpose |
|-------|---------|
| `GET /api/auth/login?from=<path>` | Generates a PKCE pair + `state`, stores them in short-lived (5 min) httpOnly cookies (`pkce_verifier`, `oidc_state`, `auth_redirect`), redirects to Keycloak's `/protocol/openid-connect/auth` |
| `GET /api/auth/callback` | Validates `state`, exchanges the code for tokens, sets httpOnly `access_token` / `refresh_token` / `id_token` cookies (`SameSite=lax`, max-age from the token response), redirects to `auth_redirect` |
| `GET /api/auth/logout` | Clears the three token cookies and redirects through Keycloak's RP-initiated end-session back to `/login` |
| `POST /api/auth/refresh` | Exchanges `refresh_token` for a new token set — `204` + new cookies on success, `401` + cleared cookies on failure |
| `GET /api/auth/me` | Verifies `access_token` and returns `{id, username, name, email, role}` (`role` is `platform_admin` when `realm_access.roles` contains it, else `user`) |

`proxy.ts` (Next middleware) decodes the `access_token`'s `exp` locally on
every navigation; if it's expired (or missing) it calls `/api/auth/refresh`
using the `refresh_token` cookie and forwards the resulting `Set-Cookie`s
before continuing, and only redirects to `/api/auth/login?from=<path>` if the
refresh also fails.

`apps/api`'s `requireAuth` also accepts the `access_token` cookie —
verified and bridged the same way as the Bearer path above. A
cookie-authenticated request forwarded by `apps/web`'s `/api/*` rewrite
therefore resolves to the same `req.user` as a Bearer token for the same
person.
