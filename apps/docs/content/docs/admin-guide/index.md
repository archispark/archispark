---
title: Administration
description: Organizations, invitations, roles, platform administration, and user provisioning.
---

ArchiSpark separates organization administration from platform administration.
An organization contains its members, API tokens, workspaces, models, and
dashboards. The Admin role (Keycloak identifier `platform_admin`) manages
organization, user, plugin, and image-library metadata from `/platform/**`,
independently of any organization membership. For an organization's actual
content (workspaces, models, dashboards), Admin has no special access: like
any other user, it needs to be a real Owner, Editor, or Viewer of that
organization — which it can grant itself from an organization's member
management in `/platform/organizations` — and is then bound by the same
rules as any member, including being refused on a suspended organization.

![Platform administration page listing organizations](/screenshots/admin-mode.png)

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

See [Organization invitations by e-mail](developer-guide/reference/authentication.mdx#organization-invitations-by-e-mail)
for the full invitation lifecycle (diagram, token hashing, resend/revoke,
missing-identity provisioning, delivery modes). SMTP settings and delivery
behavior are described in
[Deployment](developer-guide/development/deployment.md#e-mail-invitations-smtp).

## Admin administration

Assign the Admin Keycloak realm role (`platform_admin`) directly, or use the helpers in
`packages/auth/src/admin-users.ts`. These users always reach
`/platform/organizations`, where they can:

- list all organizations;
- suspend or reactivate one;
- delete one, cascading to its workspaces, memberships, invitations,
  dashboards, and organization-scoped tokens;
- edit the site login message and in-app banner from
  `/platform/settings` (e.g. to list demo account credentials on the login
  page), backed by `PUT /api/settings/messages`;
- from an organization's detail page, add itself (or any other user) as
  Owner, Editor, or Viewer through the member-management panel — the same
  route regular Owners use to manage members.

An Admin has no workspace access until it does that: like any other user, it
needs a real `organization_members` row to read/write an organization's
elements, relationships, views, dashboards, members, or API tokens, and is
refused on a suspended organization even as a real Owner. This is enforced
in `apps/server/lib/archimate/access.ts`, the single authorization gateway
every route uses — no per-route special casing, and no special casing for
Admin either. Because it has no cross-organization access to pin, Admin
cannot create a personal API token.

## Image library & plugin packs

Admin manages the instance-wide icon packs behind the `archispark_image`
system property from two `/platform/**` pages:

- `/platform/image-library` — browse every pack, upload images to a custom
  pack one at a time, or delete a pack/item.
- `/platform/plugins` — install a whole new pack in one action from a
  bundle of `.svg` files (plus an optional `manifest.json`), without a
  deployment.

See [Image Library](developer-guide/reference/image-library.mdx) for the
packs/items model, storage details, and the plugin bundle format.

## Provision Keycloak users

There is no local users table or user-management screen. Provision identities
in Keycloak. `packages/auth/src/admin-users.ts` wraps listing, creation,
updates, deletion, password reset, and realm-role assignment through the
Keycloak Admin API using `KEYCLOAK_ADMIN_CLIENT_ID` and
`KEYCLOAK_ADMIN_CLIENT_SECRET`.

The Keycloak `sub` is stored as `organization_members.user_id`,
`api_tokens.user_id`, and `workspaces.created_by_id`. The latter is audit
metadata, never an authorization rule.

See [Authentication](developer-guide/reference/authentication.md) for token
scopes and the complete authorization model.
