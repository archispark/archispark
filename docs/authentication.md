# Authentication

All routes except `GET /openapi.json`, `GET /docs`, and `GET /settings/messages` require a Keycloak access token — either as an `access_token` cookie (see [Keycloak login](#keycloak-login)) or an `Authorization: Bearer <token>` header — or a personal API token.

Every workspace route implicitly scopes to the authenticated user's own workspaces (`ownerId`, a Keycloak `sub`) — there is no organization or team concept, and no separate write-permission check: a user can always create, read, update, and delete their own workspaces and their content.

`/settings/messages` (`PUT`) is restricted to users holding the global `platform_admin` realm role (`requireSuperAdmin`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/me` | user | Returns current user |

Default credentials: `admin` / `admin` (`platform_admin`), `user` / `user`, `contrib` / `contrib`, `archi` / `archi` (owns the demo workspaces, see [Demo seed](demo-data.md#demo-seed)).

## Keycloak login

`docker compose -f .docker/docker-compose.dev.yml up -d --wait` also starts a local Keycloak (Phasetwo distribution,
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
Keycloak instance, including a hosted Phasetwo realm.

`make keycloak-setup` (`pnpm setup:realm`) creates or updates the realm
itself (roles, clients, service account) from the same
`realm-export.json` via the Admin REST API — an alternative to
`--import-realm` for environments where the Keycloak container isn't
recreated from scratch (e.g. a hosted Phasetwo Cloud realm).

**Bearer token:** `apps/api` (via `@workspace/auth`, `packages/auth`)
accepts a Keycloak-issued access token as a Bearer token, verified against
the realm's JWKS (`KEYCLOAK_URL`/`KEYCLOAK_REALM`). `req.user` is built
directly from the verified claims — `id: claims.sub`,
`username: claims.preferred_username`, and `role: "platform_admin"` if
`realm_access.roles` includes `platform_admin` (`"user"` otherwise).
A request may alternatively present a personal API token
(`apiTokens` table) as the Bearer value — `lookupApiToken` resolves it to
the same `req.user` shape via the Keycloak Admin API.

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
