# Authentication

All routes except `GET /openapi.json`, `GET /docs`, and `GET /settings/messages` require a Keycloak access token — either as an `access_token` cookie (see [Keycloak login](#keycloak-login-stage-3)) or an `Authorization: Bearer <token>` header — or a personal API token.

Every authenticated request resolves an **active organization** — from the API token's organization, the `X-Org-Id` header (validated against the user's `organizations` claim, see [Keycloak login](#keycloak-login-stage-3)), the session's active organization, or (failing that) the user's first organization membership — and attaches the user's role (`owner`/`admin`/`member`) and team memberships in that organization to the request.

Write operations (`POST`, `PUT`, `DELETE`) on workspace content require the `owner` or `admin` role in the active organization (or the platform super admin role, see below); plain `member`s are read-only. `/users*` and `/settings/api-tokens*` are exempt from this check. Deleting a workspace entirely (`DELETE /workspaces/:id`) is further restricted to `owner`. The entire `/organizations/*` section (members, invitations, teams — organization administration) is owner-only and invisible to both `admin` and plain `member`, regardless of method (see [Organizations & teams](administration.md#organizations--teams)).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/me` | user | Returns current user |

Organization membership, roles, invitations, and teams are managed via the
[`/organizations/*`](administration.md#organization-scoped-api-control-api) routes — see
[Organizations & teams](administration.md#organizations--teams).

Default credentials: `admin` / `admin` (`platform_admin`, org `owner`), `user` / `user` (org `member`, read-only), `contrib` / `contrib` (org `admin`), `archi` / `archi` (org `owner`).

## Keycloak login (Stage 3)

`docker compose -f .docker/docker-compose.dev.yml up -d --wait` also starts a local Keycloak (Phasetwo distribution,
`http://localhost:8080`, admin console login from `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD`
in `.env.dev`), pre-loaded via `--import-realm` from
`.docker/keycloak/realm-export.json` with realm `archispark`, clients
`archispark-web` / `archispark-admin-web` / `archispark-control-api`, the
`platform_admin` realm role, and the control-api service account
(`manage-users`/`view-users`/`manage-organizations`, etc.).

The 4 demo accounts (`admin`/`user`/`contrib`/`archi`, passwords match
usernames) are **not** part of `realm-export.json` — they live in
`.docker/keycloak/demo-users.json` and are created/updated via the Keycloak
Admin API by `pnpm seed:demo-users` (`make seed-demo-users`, see
[Demo seed](demo-data.md#demo-seed)). Unlike `--import-realm`, this works against any
Keycloak instance, including a hosted Phasetwo realm.

`make keycloak-setup` (`pnpm setup:realm`) creates or updates the realm
itself (roles, clients, service account) from the same
`realm-export.json` via the Admin REST API — an alternative to
`--import-realm` for environments where the Keycloak container isn't
recreated from scratch (e.g. a hosted Phasetwo Cloud realm).

**Bearer token:** `apps/control-api` (via `@workspace/auth`,
`packages/auth`) accepts a Keycloak-issued access token as a Bearer token,
verified against the realm's JWKS (`KEYCLOAK_URL`/`KEYCLOAK_REALM`). `req.user`
is built directly from the verified claims — `id: claims.sub`,
`username: claims.preferred_username`, and `role: "platform_admin"` if
`realm_access.roles` includes `platform_admin` (`"user"` otherwise).
Organization role and team resolution then proceed from `req.user.id` (the
Keycloak `sub`) exactly as for any other authenticated user — see
[Organizations & teams](administration.md#organizations--teams). `initOrganizations()` seeds
the demo users into the `Default` organization (with their respective
`owner`/`admin`/`member` roles) at control-api startup, resolved by username
via the Keycloak Admin API.

**Browser login for `apps/web` / `apps/admin-web`:** both apps sign in via the
OIDC authorization-code + PKCE flow against Keycloak. `/login` is a single "Se
connecter" link to `/api/auth/login`. Each app has its own client
(`KEYCLOAK_CLIENT_ID_WEB` /
`KEYCLOAK_CLIENT_ID_ADMIN_WEB` → `archispark-web` / `archispark-admin-web`).

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

`apps/control-api`'s `requireAuth` also accepts the `access_token` cookie —
verified and bridged the same way as the Bearer path above. A
cookie-authenticated request to a proxied route (e.g. `apps/web`'s `/api/*` →
control-api) therefore resolves to the same `req.user` as a Bearer token for
the same person.
