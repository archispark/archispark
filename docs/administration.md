# Administration

ArchiSpark has no organization/team concept and no admin console: every
workspace belongs to exactly one user, and platform administration is
limited to a single global role.

## Platform super admin

A user with the global `role: "platform_admin"` Keycloak realm role can
update the site-wide login message and banner (`PUT /settings/messages`,
`requireSuperAdmin`) — nothing else is gated by this role. `apps/web`
blocks `platform_admin` sessions from the normal workspace UI (they have no
workspaces of their own): instead of the nav/sidebar/content, it shows a
notice screen with a sign-out button (`PlatformAdminBlock`).

Assign the role directly in Keycloak (realm roles → `platform_admin` →
assign to a user), or via `assignRealmRole`/`unassignRealmRole`
(`packages/auth/src/admin-users.ts`) if scripting user provisioning.

## User provisioning

Users are provisioned directly in Keycloak — there is no local `users`
table and no in-app user management UI. `packages/auth/src/admin-users.ts`
wraps the Keycloak Admin REST API (`listRealmUsers`, `createKeycloakUser`,
`updateKeycloakUser`, `deleteKeycloakUser`, `setUserPassword`,
`getUserRealmRoles`, `assignRealmRole`/`unassignRealmRole`), using the
`KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET` service-account
credentials (`client_credentials` grant, see `.env.example`). A user's
Keycloak `sub` is used directly wherever an identity is expected (workspace
ownership, API token ownership).
