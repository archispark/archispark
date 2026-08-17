---
title: API Reference
description: REST API endpoints for organizations, ArchiMate models and dashboards.
---

## Organizations

Workspaces belong to an organization — see [Authentication](authentication.md#organizations-and-roles) for the full role matrix (`owner`/`editor`/`viewer`), which applies to Admin exactly as it does to any other user.

| Method   | Path                                     | Auth    | Description                                                                                            |
| -------- | ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/organizations`                     | viewer+ | List organizations the caller belongs to, with their role and which one is active (empty for an Admin) |
| `PUT`    | `/api/organizations/:id`                 | owner   | Rename — body: `{ name }`                                                                              |
| `POST`   | `/api/organizations/:id/activate`        | viewer+ | Switch the caller's active organization                                                                |
| `GET`    | `/api/organizations/:id/members`         | viewer+ | List members with role and username                                                                    |
| `POST`   | `/api/organizations/:id/members`         | owner   | Add an existing Keycloak user — body: `{ username, role }` (no email invitation)                       |
| `PUT`    | `/api/organizations/:id/members/:userId` | owner   | Change a member's role — body: `{ role }`; refuses to demote the last `owner`                          |
| `DELETE` | `/api/organizations/:id/members/:userId` | owner   | Remove a member, including self-removal; refuses to remove the last `owner`                            |

Invitation routes complement direct member management: `POST` and `GET`
`/api/organizations/:id/invitations`, `DELETE`
`/api/organizations/:id/invitations/:invitationId`, `POST` on its `/resend`
suffix, plus public token inspection and authenticated acceptance through
`GET /api/invitations/:token` and `POST /api/invitations/:token/accept`.
Create/resend responses may include the one-time `accept_url` and a
`delivery_kind` of `manual`, `invitation`, or `onboarding`. With e-mail
delivery enabled, `onboarding` means a missing Keycloak identity was created
without credentials and received the finish-registration actions.

## Platform administration

Admin-only (Keycloak identifier `platform_admin`). These metadata routes
never grant access to organization content — an Admin needs a real
`organization_members` row on an organization (addable to itself through
the member-management routes below) to see or act on its workspaces,
exactly like any other user — see
[Authentication](authentication.md#organizations-and-roles).

| Method   | Path                                    | Description                                                                      |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `GET`    | `/api/platform/organizations`           | List every organization (id, slug, name, `is_personal`, `enabled`, `created_at`) |
| `PUT`    | `/api/platform/organizations/:id`       | Suspend/reactivate — body: `{ enabled }`                                         |
| `DELETE` | `/api/platform/organizations/:id`       | Delete an organization (cascades to workspaces, members, and tokens)             |
| `GET`    | `/api/platform/plugins`                 | List every plugin discovered in `plugins/` (name, version, `icon_count`, `enabled`) |
| `GET`    | `/api/platform/plugins/:slug`           | One plugin's detail — `type` plus its full icon list, for the `/platform/plugins/:slug` content view |
| `PUT`    | `/api/platform/plugins/:slug`           | Enable/disable a plugin — body: `{ enabled }`                                    |
| `GET`    | `/api/platform/plugins/:slug/icons/:iconSlug` | Admin preview of one icon's SVG — unlike the public route below, works even when the plugin is disabled |

## Workspace management

Every workspace belongs to exactly one organization (`organization_id`) — a caller sees and acts on every workspace of every organization they belong to, subject to their role in that organization.

| Method   | Path                           | Description                                                                                                                                                                                                                             |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/workspaces`              | List the caller's active organization's workspaces                                                                                                                                                                                      |
| `POST`   | `/api/workspaces`              | Create workspace — body: `{ name, path?, description?, organization_id? }` (`path` = XML file to import; `organization_id` defaults to the caller's active organization — `403` if the caller has no organization membership at all) |
| `PUT`    | `/api/workspaces/:id`          | Rename workspace and/or update `description` (owner/editor)                                                                                                                                                                             |
| `DELETE` | `/api/workspaces/:id`          | Delete workspace (owner/editor; deleting the active one switches to another in the same organization; deleting the last one is allowed and leaves zero — the web UI then redirects to its `/workspaces` page to create a new one)       |
| `POST`   | `/api/workspaces/:id/activate` | Switch the caller's active workspace (and active organization, if different)                                                                                                                                                            |

## Model routes

| Method | Path                | Description                                                      |
| ------ | ------------------- | ---------------------------------------------------------------- |
| `GET`  | `/api`              | Active workspace info + model metadata                           |
| `POST` | `/api/save`         | No-op (writes are persisted immediately); kept for compatibility |
| `GET`  | `/api/export`       | Download model as Open Exchange XML                              |
| `GET`  | `/api/export/zip`   | Download model XML + all view SVGs as a ZIP archive              |
| `POST` | `/api/import`       | Replace the active workspace model from an XML body              |
| `POST` | `/api/export/neo4j` | Rebuild the active workspace's Neo4j read model                  |

## Elements

| Method   | Path                              | Description                                                    |
| -------- | --------------------------------- | -------------------------------------------------------------- |
| `GET`    | `/api/elements/types`             | Sorted list of element types present in model                  |
| `GET`    | `/api/elements`                   | List elements (`?type=`, `?name=`)                             |
| `GET`    | `/api/elements/:id`               | Get element                                                    |
| `POST`   | `/api/elements`                   | Create element — `{ name, type, documentation?, properties? }` |
| `PUT`    | `/api/elements/:id`               | Update element (partial)                                       |
| `DELETE` | `/api/elements/:id`               | Delete element (cascades to relationships and view nodes)      |
| `GET`    | `/api/elements/:id/relationships` | Relationships touching one element                             |
| `GET`    | `/api/elements/:id/views`         | Views containing one element                                   |
| `GET`    | `/api/elements/in-views`          | Identifiers of elements used by at least one view              |

## Relationships

| Method   | Path                           | Description                                                                                                 |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/relationships/types`     | Sorted list of relationship types present                                                                   |
| `GET`    | `/api/relationships`           | List (`?type=`, `?source_id=`, `?target_id=`)                                                               |
| `GET`    | `/api/relationships/:id`       | Get relationship                                                                                            |
| `POST`   | `/api/relationships`           | Create — `{ type, source, target, name?, documentation?, is_directed?, access_type?, influence_strength? }` |
| `PUT`    | `/api/relationships/:id`       | Update (partial)                                                                                            |
| `DELETE` | `/api/relationships/:id`       | Delete                                                                                                      |
| `GET`    | `/api/relationships/:id/views` | Views containing the relationship as a connection                                                           |

## Views

| Method           | Path                                       | Description                                                   |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `GET`            | `/api/views`                               | List views                                                    |
| `GET`            | `/api/views/:id`                           | View detail (nodes + connections)                             |
| `POST`           | `/api/views`                               | Create — `{ name, viewpoint?, documentation? }`               |
| `PUT`            | `/api/views/:id`                           | Update (partial)                                              |
| `DELETE`         | `/api/views/:id`                           | Delete                                                        |
| `POST`           | `/api/views/:id/nodes`                     | Add node — `{ element_id, x?, y?, w?, h? }`                   |
| `GET`            | `/api/views/:id/image`                     | Render view as SVG (`?format=svg`; PNG export is client-side) |
| `PUT` / `DELETE` | `/api/views/:id/nodes/:nodeId`             | Update or delete a node                                       |
| `POST`           | `/api/views/:id/connections`               | Add a connection between view nodes                           |
| `PUT` / `DELETE` | `/api/views/:id/connections/:connectionId` | Update or delete a connection                                 |

`GET /api/viewpoints` returns the ArchiMate viewpoint catalogue.

## Property definitions

| Method   | Path                            | Description                                                                              |
| -------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET`    | `/api/property-definitions`     | List                                                                                     |
| `GET`    | `/api/property-definitions/:id` | Get                                                                                      |
| `POST`   | `/api/property-definitions`     | Create — `{ name, type? }` (types: `string`, `boolean`, `date`, `number`, `enumeration`) |
| `PUT`    | `/api/property-definitions/:id` | Update                                                                                   |
| `DELETE` | `/api/property-definitions/:id` | Delete                                                                                   |

Each returned definition includes `is_system`. System definitions, including
`archispark_image`, are read-only at the definition level: update and delete
requests are rejected. Its value on an element or relationship must be a
plugin icon's slug (see [Plugins](#plugins)), resolved against the enabled
plugin that declares it, or a legacy HTTP(S) URL / relative path for values
written before the plugin system existed.

## Plugins

See [Plugins](/docs/developer-guide/reference/plugins) for the
`plugins/<slug>/` folder format, the discovery/activation split, and the
`archispark_image` property. Plugins are instance-wide, not
organization-scoped — every organization sees the same list. Reading is
open to any authenticated user; enabling or disabling a plugin requires the
`platform_admin` realm role (see the `/api/platform/plugins` routes above).

| Method | Path                                       | Description                                                                          |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET`  | `/api/plugins`                              | List enabled plugins with their icons (slug, name, url)                                |
| `GET`  | `/api/plugins/:pluginSlug/icons/:iconSlug`  | Public — inline SVG of one icon, no auth required, 404 if the plugin is disabled       |

## Dashboards

Workspace-scoped — see [docs/../development/architecture.md#dashboards](../development/architecture.md#dashboards). Editing requires the `owner`/`editor` role in the active organization; `viewer` is read-only.

| Method   | Path                                                   | Description                                                                          |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `GET`    | `/api/dashboards`                                      | List the active organization's latest dashboard revisions                            |
| `POST`   | `/api/dashboards`                                      | Create a dashboard (revision 1) — body: a `DashboardDefinition`                      |
| `GET`    | `/api/dashboards/:dashboardId`                         | Latest revision                                                                      |
| `PUT`    | `/api/dashboards/:dashboardId`                         | New revision of an existing dashboard                                                |
| `DELETE` | `/api/dashboards/:dashboardId`                         | Soft delete                                                                          |
| `GET`    | `/api/dashboards/admin`                                | Administration listing (includes soft-deleted, `isProvisioned`)                      |
| `GET`    | `/api/dashboards/:dashboardId/panels/:panelInstanceId` | Execute one panel instance — query-string values are the panel's parameters          |
| `GET`    | `/api/panel-visualizations`                            | Static catalogue of panel visualizations (`core/graph`, `core/table`, `core/metric`) |
| `POST`   | `/api/explore`                                         | Ad hoc read-only Cypher query — body: `{ query, parameters }`                        |

## Session, profile, and service routes

| Method         | Path                                                        | Description                              |
| -------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `GET`          | `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout` | Browser OIDC flow                        |
| `POST`         | `/api/auth/refresh`                                         | Refresh browser token cookies            |
| `GET`          | `/api/auth/me`                                              | Current verified Keycloak identity       |
| `GET`          | `/api/me`                                                   | Read the current profile and memberships |
| `GET` / `POST` | `/api/settings/api-tokens`                                  | List or create personal tokens           |
| `DELETE`       | `/api/settings/api-tokens/:id`                              | Revoke a personal token                  |
| `GET` / `PUT`  | `/api/settings/messages`                                    | Read messages; update as an Admin        |
| `GET`          | `/api/health`                                               | Service health                           |
| `GET`          | `/api/openapi.json`                                         | OpenAPI document                         |
| `GET`          | `/api/docs`                                                 | Interactive API reference                |
