# API Reference

## Workspace management

*tenant-api route — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split).*

Workspaces belong to an organization (`organization_id`) and are listed only if the current user is a member of that organization (and, when `team_ids` is non-empty, a member of one of those teams or an org owner/admin).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces` | List workspaces visible to the current user in the active organization |
| `POST` | `/workspaces` | Create workspace — body: `{ name, path?, description?, team_ids? }` (`path` = XML file to import; org owner/admin only) |
| `PUT` | `/workspaces/:id` | Rename workspace and/or update `description`/`team_ids` (org owner/admin only) |
| `DELETE` | `/workspaces/:id` | Delete workspace (org **owner** only — `manage-organization`; deleting the active one switches to another in the organization; deleting the last one is allowed and leaves zero — the web UI then redirects to its `/workspaces` page to create a new one) |
| `POST` | `/workspaces/:id/activate` | Switch the current user's active workspace within the active organization |

## Model routes

*tenant-api route — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Active workspace info + model metadata |
| `POST` | `/save` | No-op (writes are persisted immediately); kept for compatibility |
| `GET` | `/export` | Download model as Open Exchange XML |
| `POST` | `/import` | Replace the active workspace model from an XML body |

## Elements

*tenant-api route — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/elements/types` | Sorted list of element types present in model |
| `GET` | `/elements` | List elements (`?type=`, `?name=`) |
| `GET` | `/elements/:id` | Get element |
| `POST` | `/elements` | Create element — `{ name, type, documentation?, properties? }` |
| `PUT` | `/elements/:id` | Update element (partial) |
| `DELETE` | `/elements/:id` | Delete element (cascades to relationships and view nodes) |

## Relationships

*tenant-api route — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/relationships/types` | Sorted list of relationship types present |
| `GET` | `/relationships` | List (`?type=`, `?source_id=`, `?target_id=`) |
| `GET` | `/relationships/:id` | Get relationship |
| `POST` | `/relationships` | Create — `{ type, source, target, name?, documentation?, is_directed?, access_type?, influence_strength? }` |
| `PUT` | `/relationships/:id` | Update (partial) |
| `DELETE` | `/relationships/:id` | Delete |

## Views

*tenant-api route — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split).*

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

*tenant-api route — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split).*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/property-definitions` | List |
| `GET` | `/property-definitions/:id` | Get |
| `POST` | `/property-definitions` | Create — `{ name, type? }` (types: `string`, `boolean`, `date`, `number`, `enumeration`) |
| `PUT` | `/property-definitions/:id` | Update |
| `DELETE` | `/property-definitions/:id` | Delete |
