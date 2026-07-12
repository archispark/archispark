# API Reference

## Organizations

Workspaces belong to an organization — see [Authentication](authentication.md#organizations-and-roles) for the full role matrix (`owner`/`admin`/`member`) and the `platform_admin` isolation guarantee.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/organizations` | member+ | List organizations the caller belongs to, with their role and which one is active (empty for `platform_admin`) |
| `POST` | `/organizations` | any user | Create a "team" organization — body: `{ name }`; caller becomes `owner` |
| `PUT` | `/organizations/:id` | owner/admin | Rename — body: `{ name }` |
| `DELETE` | `/organizations/:id` | owner | Delete (cascades to workspaces/members/tokens) |
| `POST` | `/organizations/:id/activate` | member+ | Switch the caller's active organization |
| `GET` | `/organizations/:id/members` | member+ | List members with role and username |
| `POST` | `/organizations/:id/members` | owner | Add an existing Keycloak user — body: `{ username, role }` (no email invitation) |
| `PUT` | `/organizations/:id/members/:userId` | owner | Change a member's role — body: `{ role }`; refuses to demote the last `owner` |
| `DELETE` | `/organizations/:id/members/:userId` | owner | Remove a member, including self-removal; refuses to remove the last `owner` |

## Platform administration

`platform_admin`-only, metadata only — never organization content.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/platform/organizations` | List every organization (id, slug, name, `is_personal`, `enabled`, `created_at`) |
| `PUT` | `/platform/organizations/:id` | Suspend/reactivate — body: `{ enabled }` |
| `DELETE` | `/platform/organizations/:id` | Delete an organization |

## Workspace management

Every workspace belongs to exactly one organization (`organization_id`) — a caller sees and acts on every workspace of every organization they belong to, subject to their role in that organization.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces` | List the caller's active organization's workspaces |
| `POST` | `/workspaces` | Create workspace — body: `{ name, path?, description?, organization_id? }` (`path` = XML file to import; `organization_id` defaults to the caller's active organization, auto-creating a personal one on a user's very first workspace) |
| `PUT` | `/workspaces/:id` | Rename workspace and/or update `description` (owner/admin) |
| `DELETE` | `/workspaces/:id` | Delete workspace (owner/admin; deleting the active one switches to another in the same organization; deleting the last one is allowed and leaves zero — the web UI then redirects to its `/workspaces` page to create a new one) |
| `POST` | `/workspaces/:id/activate` | Switch the caller's active workspace (and active organization, if different) |

## Model routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Active workspace info + model metadata |
| `POST` | `/save` | No-op (writes are persisted immediately); kept for compatibility |
| `GET` | `/export` | Download model as Open Exchange XML |
| `POST` | `/import` | Replace the active workspace model from an XML body |

## Elements

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/elements/types` | Sorted list of element types present in model |
| `GET` | `/elements` | List elements (`?type=`, `?name=`) |
| `GET` | `/elements/:id` | Get element |
| `POST` | `/elements` | Create element — `{ name, type, documentation?, properties? }` |
| `PUT` | `/elements/:id` | Update element (partial) |
| `DELETE` | `/elements/:id` | Delete element (cascades to relationships and view nodes) |

## Relationships

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/relationships/types` | Sorted list of relationship types present |
| `GET` | `/relationships` | List (`?type=`, `?source_id=`, `?target_id=`) |
| `GET` | `/relationships/:id` | Get relationship |
| `POST` | `/relationships` | Create — `{ type, source, target, name?, documentation?, is_directed?, access_type?, influence_strength? }` |
| `PUT` | `/relationships/:id` | Update (partial) |
| `DELETE` | `/relationships/:id` | Delete |

## Views

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/views` | List views |
| `GET` | `/views/:id` | View detail (nodes + connections) |
| `POST` | `/views` | Create — `{ name, viewpoint?, documentation? }` |
| `PUT` | `/views/:id` | Update (partial) |
| `DELETE` | `/views/:id` | Delete |
| `POST` | `/views/:id/nodes` | Add node — `{ element_id, x?, y?, w?, h? }` |
| `GET` | `/views/:id/image` | Render view as SVG (`?format=svg`; PNG export is client-side) |

## Property definitions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/property-definitions` | List |
| `GET` | `/property-definitions/:id` | Get |
| `POST` | `/property-definitions` | Create — `{ name, type? }` (types: `string`, `boolean`, `date`, `number`, `enumeration`) |
| `PUT` | `/property-definitions/:id` | Update |
| `DELETE` | `/property-definitions/:id` | Delete |
