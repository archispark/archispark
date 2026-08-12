---
title: Administration
description: Organizations, invitations, roles, platform administration, and user provisioning.
---

ArchiSpark separates organization administration from platform administration.
An organization contains its members, API tokens, workspaces, models, and
dashboards. The Admin role (Keycloak identifier `platform_admin`) manages
organization metadata only and grants no access to that content.

## Organization roles

| Capability                     | Owner | Editor | Viewer |
| ------------------------------ | ----- | ------ | ------ |
| Read organization workspaces   | yes   | yes    | yes    |
| Modify models and dashboards   | yes   | yes    | no     |
| Rename the organization        | yes   | yes    | no     |
| Invite or resend an invitation | yes   | yes    | no     |
| Change roles or remove members | yes   | no     | no     |

The last Owner cannot be demoted or removed. Suspending an organization blocks
its normal use without changing memberships or deleting data.

## Manage organizations

Open **Organizations** from the user menu. Select **Activate** to switch
context; the workspace list then follows the active organization.

Owners and Editors can rename an organization. Organization members cannot
create or delete organizations.

## Invite members

From an organization's members dialog, an Owner or Editor enters an e-mail
and chooses Owner, Editor, or Viewer. The API and database retain the
stable role identifiers `owner`, `admin`, and `member`; the application
presents them as Owner, Editor, and Viewer.

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
  `PUT /api/settings/messages`.

They cannot read any workspace, element, relationship, view, dashboard, or API
token. This denial is enforced centrally by
`apps/server/lib/archimate/access.ts`, before membership lookup.

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
