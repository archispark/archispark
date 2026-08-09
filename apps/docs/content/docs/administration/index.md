---
title: Administration
description: Organizations, invitations, roles, platform administration, and user provisioning.
---

ArchiSpark separates organization administration from platform administration.
An organization contains its members, API tokens, workspaces, models, and
dashboards. The `platform_admin` realm role manages organization metadata only
and grants no access to that content.

## Organization roles

| Capability                     | owner | admin | member |
| ------------------------------ | ----- | ----- | ------ |
| Read organization workspaces   | yes   | yes   | yes    |
| Modify models and dashboards   | yes   | yes   | no     |
| Rename the organization        | yes   | yes   | no     |
| Invite or resend an invitation | yes   | yes   | no     |
| Change roles or remove members | yes   | no    | no     |
| Delete the organization        | yes   | no    | no     |

The last owner cannot be demoted or removed. Suspending an organization blocks
its normal use without changing memberships or deleting data.

## Manage organizations

Open **Organizations** from the user menu. Any authenticated user can create a
team organization and becomes its owner. Select **Activate** to switch context;
the workspace list then follows the active organization.

Owners and admins can rename an organization. Only owners can delete it. That
deletion cascades to its workspaces, memberships, invitations, dashboards, and
organization-scoped tokens, so export required models first.

## Invite members

From an organization's members dialog, an owner or admin enters an e-mail and
chooses `owner`, `admin`, or `member`. ArchiSpark stores only a SHA-256 hash of
the random invitation token. Pending invitations can be resent or revoked and
expire after the configured validity period.

The recipient must authenticate with a Keycloak account whose e-mail matches
the invitation, then open `/invitations/<token>` and accept it. Acceptance adds
the membership and cannot be repeated. SMTP settings and delivery behavior are
described in [Deployment](../development/deployment.md#e-mail-invitations-smtp).

## Platform administration

Assign the Keycloak realm role `platform_admin` directly, or use the helpers in
`packages/auth/src/admin-users.ts`. These users are redirected away from the
workspace UI to `/platform/organizations`, where they can:

- list all organizations;
- suspend or reactivate one;
- delete one;
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
