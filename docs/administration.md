# Organizations & Administration

## Organizations & teams

ArchiSpark is multi-tenant: each **organization** ("entreprise") has its own
members, teams, and workspaces. Organizations, membership, and roles live in
**Keycloak** (Phasetwo's Organizations extension, see
[Keycloak login](authentication.md#keycloak-login-stage-3)); `teams`/`team_members` remain in
the control database, keyed by the member's Keycloak `sub`.

- **Roles**: `owner`, `admin`, `member` (`ORG_ROLES` in `@workspace/auth`) — scoped per organization and carried in the access token's `organizations` claim (`{ "<orgId>": { name, roles: [...] } }`). `owner` has full organization administration (members, invitations, teams) plus ArchiMate content read/write. `admin` has the same ArchiMate content read/write as `owner` but **no organization-administration access at all** — identical to `member` on that front. `member` is read-only on workspace content and likewise has no organization-administration access. Demo mapping in the "Default" organization: `archi`/`admin` → `owner`, `contrib` → `admin`, `user` → `member`.

  | Phasetwo permission | `owner` | `admin` | `member` | Enforced by |
  |---|---|---|---|---|
  | `view-organization` (access to `/organizations/*`) | ✅ | ❌ | ❌ | `requireOrgOwner` |
  | `view-members` / `manage-members` | ✅ | ❌ | ❌ | `requireOrgOwner` |
  | `view-roles` / `manage-roles` (change a member's role) | ✅ | ❌ | ❌ | `requireOrgOwner` |
  | `view-invitations` / `manage-invitations` (create/cancel) | ✅ | ❌ | ❌ | `requireOrgOwner` |
  | `manage-organization` (delete a workspace) | ✅ | ❌ | ❌ | `requireOrgOwner` (control-api) + owner-only check (tenant-api) |
  | ArchiMate elements/views — read | ✅ | ✅ | ✅ | — |
  | ArchiMate elements/views — write (create/update/delete) | ✅ | ✅ | ❌ | `requireWorkspaceWrite` |
- **Platform super admin**: a user with the global `role: "platform_admin"` (set via the [admin web](#admin-web) `/users` page, or `POST`/`PUT /users`) bypasses organization role checks everywhere. Creating new organizations is **admin-only** (`POST /admin/organizations` from [admin web](#admin-web)) — there is no self-service organization creation.
- `apps/web` (the workspace UI) blocks `platform_admin` sessions: instead of the normal nav/sidebar/workspace content, it shows a notice screen with a sign-out button. Platform admins manage organizations from [admin web](#admin-web) and have no need for tenant workspace access; `admin`/`admin` still holds an `owner` membership in a default organization (required by `control-api` so admin web itself stays functional), but that membership is now inert from `apps/web`'s perspective — `GET /organizations/members` (and team member lists) filter out any user holding the `platform_admin` realm role, so `admin`/`admin` never appears to tenant owners managing members.
- `apps/web` similarly blocks any non-admin session whose `/api/auth/me` returns no `organizations` (e.g. a Keycloak user created without being invited to an organization): instead of the normal nav/sidebar/workspace content — which would otherwise just show `403 Aucune organisation associée à cet utilisateur.` from every API call — it shows a "no organization" notice screen with a sign-out button.
- **Org switcher**: a user belonging to more than one organization sees a switcher in `apps/web`'s sidebar. The selected organization is stored in a non-httpOnly `active_org` cookie (`useActiveOrganization()` reads it, `useSetActiveOrganization()` writes it) and sent as an `X-Org-Id` header on every `/organizations/*` and `/workspaces*` request; `useAutoActivateOrganization()` sets the cookie to the user's first organization if it's missing or stale.
- **Teams** group members within an organization (`teams`/`team_members` tables; `team_members.user_id` is a Keycloak `sub`). A workspace with one or more `team_ids` is only visible to members of those teams (plus org owners/admins); a workspace with no teams is visible to the whole organization.
- Each user has one **active workspace per organization**, switched via `POST /workspaces/:id/activate`.
- A platform super admin can **suspend** an organization (`organization_settings.enabled = false`, control-db; defaults to `true` if no row exists). Members of a suspended organization (other than platform super admins) get `403 Forbidden` on every request while it's resolved as their active organization; their data is left intact and access resumes once the organization is reactivated.

Org owners (and platform super admins) see an **Organization** entry in the sidebar, opening a dedicated section (`/organization`) with its own sidebar and two tabs: **Workspace** (list every workspace in the organization — create, activate, rename, assign teams, or delete each one) and **Membres** (manage members, invitations, and teams, via the routes below). The platform-wide list of organizations across every tenant is managed separately from the [admin web](#admin-web) console (`/organizations`, platform super admins only).

The sidebar's **import/export model** controls (shown above the **Settings** link) and the "Nouveau workspace" button on `/workspaces` are visible to org owners/admins only — `member`s have read-only access to the model and cannot import (replace the active workspace's model), export it, or create a workspace.

**Settings** (`/settings`, visible to all users) shows the active workspace's name and description; owners/admins can edit them, and owners can additionally delete the workspace from this page (`DELETE /workspaces/:id`, owner-only).

### Organization-scoped API (control-api)

All routes below act on the request's **active organization** (see
[Authentication](authentication.md#authentication)) and are entirely owner-only
(`requireOrgOwner`, Phasetwo `view-organization` and beyond): both `admin` and
plain `member` get `403` on every method, whether it's a read or a write.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/organizations/members` | List members of the active organization with their role and team memberships — users holding the global `platform_admin` realm role are excluded |
| `PUT` | `/organizations/members/:userId` | Change a member's role — body: `{ role: "owner" \| "admin" \| "member" }` |
| `DELETE` | `/organizations/members/:userId` | Remove a member from the organization |
| `GET` | `/organizations/invitations` | List pending invitations |
| `POST` | `/organizations/invitations` | Invite a new member by email — body: `{ email, role }`, creates a Phasetwo invitation |
| `DELETE` | `/organizations/invitations/:invitationId` | Cancel a pending invitation |
| `GET` | `/organizations/teams` | List teams in the active organization |
| `POST` | `/organizations/teams` | Create a team — body: `{ name }` |
| `PUT` | `/organizations/teams/:teamId` | Rename a team — body: `{ name }` |
| `DELETE` | `/organizations/teams/:teamId` | Delete a team |
| `GET` | `/organizations/teams/:teamId/members` | List a team's members |
| `POST` | `/organizations/teams/:teamId/members` | Add a member to a team — body: `{ user_id }` |
| `DELETE` | `/organizations/teams/:teamId/members/:userId` | Remove a member from a team |

## Admin web

`apps/admin-web` is a separate Next.js app (port **8001**) providing a platform-wide admin console, restricted to users with `role: "platform_admin"` — anyone else is redirected to `/login`.

| Route | Purpose |
|-------|---------|
| `/login` | Sign in via Keycloak (see [Keycloak login (Stage 3)](authentication.md#keycloak-login-stage-3)) |
| `/organizations` | List, create, rename, and delete organizations across every tenant (default landing page); also shows a read-only **tenant monitoring** table (tenant database status + enabled/suspended state per organization) with suspend/reactivate actions |
| `/users` | Manage platform users — create/update/delete, assign the `platform_admin` role |
| `/authentication` | Manage OAuth/SSO providers |
| `/postgres` | PostgreSQL connection status |
| `/messages` | Configure the login-page message and the site-wide banner |

### User management API (platform admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List all platform users |
| `POST` | `/users` | Create user — body: `{ username, password, role? }`. The new user is **not** added to any organization — add it via [`/organizations/*`](#organization-scoped-api-control-api) or as an [initial organization owner](architecture.md#initial-organization-owner) |
| `PUT` | `/users/:id` | Update password and/or role |
| `DELETE` | `/users/:id` | Delete user |

### User provisioning (Keycloak Admin API)

Platform users (`/users*` above) are provisioned directly in Keycloak via its
Admin REST API (`packages/auth/src/admin-users.ts`), using the
`KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET` service-account
credentials (`client_credentials` grant, see `.env.example`) — there is no
local `users` table row for users created this way. `UserOut.id` is the
Keycloak `sub`, used directly wherever a Keycloak `sub` is expected (org
membership, team membership, API token ownership).

- `GET /users` lists every realm user except service accounts
  (`listRealmUsers`), flagging `role: "platform_admin"` for users holding that
  realm role (`listRealmRoleUsers`).
- `POST /users` creates the Keycloak user (`username`, `email:
  <username>@archispark.internal`, enabled + email-verified), sets its
  password, and assigns the `platform_admin` realm role when `role ===
  "platform_admin"`.
- `PUT /users/:id` updates the password and/or grants/revokes the
  `platform_admin` realm role.
- `DELETE /users/:id` deletes the Keycloak user.

### Organization monitoring API (platform admin only)

Organizations themselves live in Keycloak (Phasetwo). `slug` is read from the
organization's `attributes.slug` (falls back to its Keycloak id if absent),
and `enabled` comes from the control-db `organization_settings` table
(`true` if no row exists).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/organizations` | List every Keycloak organization with `enabled` flag and `tenant_status` (`tenant_databases.status`, or `null` if it shares the control-plane database) |
| `POST` | `/admin/organizations` | Create a Keycloak organization and provision its tenant database — body: `{ name, slug?, initial_owner_user_id? }`, see [Initial organization owner](architecture.md#initial-organization-owner) below |
| `PUT` | `/admin/organizations/:id` | Suspend or reactivate an organization — body: `{ enabled: boolean }` (upserts `organization_settings`) |
