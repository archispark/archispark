# Administration

ArchiSpark groups workspaces into Organizations (`owner`/`admin`/`member`
roles — see [Authentication](authentication.md#organizations-and-roles)),
plus a single global platform administration role with no admin console
beyond organization metadata.

## Platform super admin

A user with the global `role: "platform_admin"` Keycloak realm role can
update the site-wide login message and banner (`PUT /settings/messages`,
`requireSuperAdmin`) and administer organizations from
`/platform/organizations*` — list, suspend/reactivate, delete — **metadata
only**, never organization content (workspaces, elements, …); this
isolation is structural (`apps/api/src/access.ts` rejects `platform_admin`
unconditionally before ever checking a membership row). `apps/web` blocks
`platform_admin` sessions from the normal workspace UI (they have no
organization membership by design): instead of the nav/sidebar/content, it
shows a notice screen (`PlatformAdminBlock`) with a link to
`/platform/organizations` and a sign-out button.

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
Keycloak `sub` is used directly wherever an identity is expected
(`organization_members.user_id`, `api_tokens.user_id`,
`workspaces.created_by_id` — the latter is traceability only, never used
for access control).
