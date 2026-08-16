---
title: Administration
description: Organizations, invitations, roles, platform administration, and user provisioning.
---

ArchiSpark separates organization administration from platform administration.
An organization contains its members, API tokens, workspaces, models, and
dashboards. The Admin role (Keycloak identifier `platform_admin`) manages
organization metadata, and — by explicitly entering an organization (admin
mode) — gets full Owner-equivalent access to that organization's content,
including a suspended one.

## Organization roles

| Capability                     | Owner | Editor | Viewer |
| ------------------------------ | ----- | ------ | ------ |
| Read organization workspaces   | yes   | yes    | yes    |
| Modify models and dashboards   | yes   | yes    | no     |
| Rename the organization        | yes   | no     | no     |
| Invite or resend an invitation | yes   | no     | no     |
| Change roles or remove members | yes   | no     | no     |

The last Owner cannot be demoted or removed. Suspending an organization blocks
its normal use without changing memberships or deleting data.

## Manage organizations

Open **Organizations** from the user menu. Select **Activate** to switch
context; the workspace list then follows the active organization.

Only an Owner can rename an organization. Organization members cannot create
or delete organizations.

## Invite members

From an organization's members dialog, an Owner enters an e-mail and chooses
Owner, Editor, or Viewer. The API and database use the same identifiers as
the display labels: `owner`, `editor`, and `viewer`.

See [Organization invitations by e-mail](../reference/authentication.mdx#organization-invitations-by-e-mail)
for the full invitation lifecycle (diagram, token hashing, resend/revoke,
missing-identity provisioning, delivery modes). SMTP settings and delivery
behavior are described in
[Deployment](../development/deployment.md#e-mail-invitations-smtp).

## Admin administration

Assign the Admin Keycloak realm role (`platform_admin`) directly, or use the helpers in
`packages/auth/src/admin-users.ts`. These users are redirected away from the
workspace UI to `/platform/organizations`, where they can:

- list all organizations;
- suspend or reactivate one;
- delete one, cascading to its workspaces, memberships, invitations,
  dashboards, and organization-scoped tokens;
- update the site login message and banner through
  `PUT /api/settings/messages`;
- select **Administer** on an organization to enter **admin mode**
  (`POST /api/platform/organizations/:id/enter`) — from that point on, the
  regular workspace UI and API resolve the Admin as Owner for that
  organization: read/write elements, relationships, views, dashboards,
  members, and API tokens, even if the organization is suspended. A banner
  stays visible while in admin mode, with an **Exit** action
  (`DELETE /api/platform/organizations/active`) that returns to
  `/platform/organizations`.

This bypass is centralized in `apps/server/lib/archimate/access.ts`, the
single authorization gateway every route uses — no per-route special
casing. Because access this broad shouldn't be pinned indefinitely, Admin
cannot create a personal API token; its access always goes through a live
admin-mode session instead.

## Provision Keycloak users

There is no local users table or user-management screen. Provision identities
in Keycloak. `packages/auth/src/admin-users.ts` wraps listing, creation,
updates, deletion, password reset, and realm-role assignment through the
Keycloak Admin API using `KEYCLOAK_ADMIN_CLIENT_ID` and
`KEYCLOAK_ADMIN_CLIENT_SECRET`.

The Keycloak `sub` is stored as `organization_members.user_id`,
`api_tokens.user_id`, and `workspaces.created_by_id`. The latter is audit
metadata, never an authorization rule.

See [Authentication](../reference/authentication.md) for token scopes and the
complete authorization model.
