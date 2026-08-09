---
title: User Guide
description: Navigating the web interface, managing elements, relationships, views and settings.
---

URL: `http://localhost:8000`

## Sign In

The interface presents a login form at startup. Enter your username and password, then submit.

**Demo accounts:**

| Account   | Password  |
| --------- | --------- |
| `admin`   | `admin`   |
| `user`    | `user`    |
| `contrib` | `contrib` |
| `archi`   | `archi`   |

> See [Authentication & Authorization](/authentication#demo-accounts) for the full role breakdown (platform role vs. organization role) and the `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` / `SEED_CONTRIB_PASSWORD` / `SEED_ARCHI_PASSWORD` environment variables used to override these passwords in production.

---

## Navigation

### Top Bar (Nav)

The top bar contains:

- **Menu button** (≡) — opens the sidebar on mobile
- **Breadcrumb** — Organization (if you are `owner`/`admin`/`platform_admin`) / Workspaces / active workspace name / current section
- **Organization switcher** — visible when your account belongs to more than one organization
- **Language selector** — switches the interface language (see below)
- **Theme button** — toggles between light and dark mode
- **User menu** — access to your profile and sign out

### Sidebar

The left sidebar provides access to all sections. At the top it displays the **active model name** and its global counters (elements · relationships · views).

| Section                 | Route               | Description                                                                                               |
| ----------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| Overview                | `/`                 | Summary dashboard                                                                                         |
| Workspaces              | `/workspaces`       | List, create and switch ArchiMate models (workspaces)                                                     |
| —                       | —                   | —                                                                                                         |
| **Elements**            |                     |                                                                                                           |
| List                    | `/elements`         | All elements, with a badge for elements absent from any view                                              |
| _(one entry per layer)_ | `/elements?layer=X` | Quick filter by ArchiMate layer, with per-layer counts                                                    |
| —                       | —                   | —                                                                                                         |
| **Relationships**       |                     |                                                                                                           |
| List                    | `/relationships`    | All relationships, with a conflict-count badge                                                            |
| —                       | —                   | —                                                                                                         |
| **Views**               |                     |                                                                                                           |
| List                    | `/views`            | All diagrams                                                                                              |
| —                       | —                   | —                                                                                                         |
| **Properties**          |                     |                                                                                                           |
| List                    | `/properties`       | Property definitions                                                                                      |
| —                       | —                   | —                                                                                                         |
| Organization            | `/organization`     | Workspace, member, invitation and team management — only shown to org `owner`/`admin` or `platform_admin` |
| Settings                | `/settings`         | Import / export the active model                                                                          |

> The sidebar can be **collapsed to an icon-only rail** on desktop using the toggle at the bottom (panel icon). All sections remain reachable as icons with the same badges.

---

## Interface Language

ArchiSpark offers a fully translated interface in **5 languages**:

| Language | Code | Access |
| -------- | ---- | ------ |
| Français | `fr` | 🇫🇷 FR  |
| English  | `en` | 🇬🇧 EN  |
| Español  | `es` | 🇪🇸 ES  |
| Deutsch  | `de` | 🇩🇪 DE  |
| Italiano | `it` | 🇮🇹 IT  |

The language selector is accessible from the top bar (flag icon + language code). Hovering reveals a dropdown with 5 options.

The preference is **saved in the browser** (`localStorage`): it persists between sessions and does not require a user account.

All interface elements are translated: navigation labels, section titles, action buttons, error messages, create/edit/delete forms, and ArchiMate layer names.

---

## Overview (`/`)

The dashboard displays:

- **Name, documentation and version** of the active model
- **Stat cards**: total elements, counters by layer (sorted by volume), relationships, views — each with a small progress bar highlighting elements absent from any view or relationships with an ArchiMate conflict
- **Donut charts**: elements by type and relationships by type (top types, with an "other" slice for the long tail)

Layer cards are coloured according to the standard ArchiMate palette (yellow = Business, blue = Application, green = Technology…).

---

## Workspaces (`/workspaces`)

A **workspace** is one ArchiMate model (elements, relationships, views, properties). Your organization can hold several workspaces — for example one per project or business unit.

The page lists every workspace you have access to, with the **active** one marked.

### Create a Workspace

Click **+ New workspace**:

1. **Name** — required
2. **Description** — optional

The new workspace is created and activated automatically, and you're taken to the Overview.

### Switch / Activate a Workspace

Click anywhere on a workspace row to **activate** it (unless it's already active) and open its Overview. The active workspace determines which elements, relationships, views and properties are shown across the whole app.

> Renaming a workspace, assigning it to specific **teams**, or deleting it is done from [Organization → Workspaces](#workspace-management), available to org `owner`/`admin`.

---

## Elements (`/elements`)

### List and Filters

The table displays all elements with their columns: **Name**, **Type** (badge), **Layer** (coloured chip), **Documentation**.

Two filters available at the top:

- **Name search** — real-time filter with 300 ms debounce
- **Type selector** — filter on a specific ArchiMate type

### Filter by Layer

From the sidebar, clicking a layer (e.g. "Application") automatically filters the list and updates the page title.

### Create an Element

Click **+ New element**:

1. **Name** — required
2. **Type** — select from 60 ArchiMate element types grouped by layer
3. **Documentation** — free description (optional)
4. **Properties** — key/value pairs based on model definitions (optional)

### Edit an Element

Click the element name or the ✏️ icon to open the **element detail page** (`/elements/:id`). All fields are inline-editable with double-click.

### Delete an Element

On the element detail page, click **Delete** (top right). A confirmation is required. Deletion cascades: **all relationships** referencing this element and **all its nodes in views** are also deleted.

> Creating, editing and deleting elements requires write access — see [Authentication & Authorization](/authentication) for the role model.

---

## Element Detail (`/elements/:id`)

The detail page shows full element information and provides three tabs.

### Header

Displays and allows inline editing (double-click) of:

- **Type** — ArchiMate type badge (opens a selector on double-click)
- **Layer** — coloured chip (Business, Application, Technology…)
- **View status** — green ✓ if the element appears in at least one view, amber ⚠ if unused
- **Name** — editable with double-click
- **Identifier** — read-only UUID
- **Documentation** — editable multi-line text
- **Specialization** — parent element via an ArchiMate Specialization relationship

### Tab 1 — Properties

Lists all property key/value pairs attached to the element.

- **Add a property**: click **+ New** → select a property definition → enter a value → confirm
- **Edit a value**: double-click the value cell
- **Delete a property**: click the 🗑️ icon on the row

### Tab 2 — Relations

Lists all relationships in which this element is source or target.

| Column | Description                                    |
| ------ | ---------------------------------------------- |
| Status | ✓ allowed / ✕ conflict per ArchiMate 3.1 rules |
| Type   | Relationship type (Association, Realization…)  |
| Name   | Optional relationship name                     |
| Source | Source element (link to its detail page)       |
| Target | Target element (link to its detail page)       |

Click ▶ to expand a row and see the validation detail or alternative allowed types.

**Available actions:** + New relationship · ✏️ Edit · 🗑️ Delete

### Tab 3 — Graph

Animated force-directed graph showing the element and all its direct neighbours.

- **Central node** — current element, fixed at the centre, highlighted with a coloured ring matching its ArchiMate layer
- **Neighbour nodes** — each connected element, coloured by its own layer
- **Edges** — animated dashed lines labelled with the relationship name or type
- Nodes settle into position via a physics simulation (d3-force); the view auto-fits on load
- **Click a neighbour** to navigate to its detail page
- **Pan / zoom** with mouse — controls available at bottom-left

---

## Relationships (`/relationships`)

### List and Filters

The table displays: **ArchiMate Status** (✓ OK or ✕ Conflict), **Type**, **Name**, **Source**, **Target**.

Available filters:

- **Name search** — 300 ms debounce
- **Type selector** — filter on a relationship type
- **Status filters**: All / OK / Conflicts

### ArchiMate Validation

Each relationship is validated against ArchiMate 3.1 compatibility rules. A green icon (✓) indicates an allowed relationship, red (✕) a conflict.

Click ▶ at the start of a row to **expand the detail**: the relationship type between the two element types is explained, and alternative allowed relationships are suggested in case of conflict.

### Create a Relationship

Click **+ New relationship**:

1. **Type** — required (11 ArchiMate relationship types)
2. **Source** — source element (select from all elements)
3. **Target** — target element
4. **Name** — optional
5. **Documentation** — optional
6. **Properties** — optional
7. Special fields by type:
   - `Access` → **Access type**: Read / Write / ReadWrite / Access
   - `Association` → **Directed**: yes/no
   - `Influence` → **Strength**: `+`, `++`, `-`, `--`

### Edit / Delete

✏️ and 🗑️ buttons on the right of each row.

---

## Views (`/views`)

### Diagram List

The table displays a **status icon** (✓ all connections OK, ✕ at least one conflict, — if the view has no connections), **Name** (clickable link), **Viewpoint**, **Nodes**, **Connections**.

Filters at the top let you narrow the list to **All / OK / Conflicts**. Expand a row (▶) to see the breakdown of valid vs. conflicting relationships for that view.

Clicking on a view name opens its **detail** with the interactive canvas.

### Create a View

Click **+ New view**:

1. **Name** — required
2. **Viewpoint** — select from 28 ArchiMate viewpoints (loaded from the API)
3. **Documentation** — optional

### Edit / Delete

✏️ and 🗑️ buttons on each row.

---

## View Detail (`/views/:id`)

### Interactive Canvas

The canvas uses [React Flow](https://reactflow.dev) to display and edit the diagram.

**Available interactions:**

| Action              | Gesture                                       |
| ------------------- | --------------------------------------------- |
| Pan the view        | Click-drag on the background                  |
| Zoom                | Mouse wheel                                   |
| Select a node       | Click                                         |
| Move a node         | Click-drag                                    |
| Resize a node       | Corner handles                                |
| Add a node          | Drag an element from the side panel           |
| Create a connection | Click-drag from a node handle to another node |
| Delete a node       | Select → Delete key                           |
| Delete a connection | Select → Delete key                           |
| Fit the view        | Controls buttons (bottom left)                |

**Nodes and styles:**

- Nodes are coloured by ArchiMate layer
- Shape follows ArchiMate notation (hexagon = Function, chevron = Event, pill = Service…)
- Connections use orthogonal routing with standard relationship markers (diamond = Composition, open arrowhead = Realization…)

**Export the canvas:**
The **Download PNG** button (bottom-right panel) exports the canvas as displayed via `html-to-image`.

> Editing the canvas (moving/resizing nodes, adding elements, creating or deleting connections), as well as renaming the view, editing its documentation/viewpoint, and deleting it, requires write access.

### View Validator

Below the canvas, a **Validator** panel lists every relationship rendered as a connection in this view, with its ArchiMate compliance status (✓ / ✕), source and target. It is the same table as the Relationships page, filtered to this view's connections — use it to spot-check a diagram before sharing it.

> The old `/validator` route still exists for backwards compatibility and redirects to `/views` — the validator itself now lives on each view's detail page, as described above.

---

## Properties (`/properties`)

Management of **property definitions** that can be attached to model elements and relationships.

### Create a Definition

**+ New definition**:

- **Name** — readable identifier (e.g. "Annual cost", "Owner")
- **Type** — `string` (default), `boolean`, `date`, `number`, `enumeration`

### Usage

Once defined, the property appears in the element and relationship create/edit form (in the "Properties" section), as a key/value pair.

---

## Organization (`/organization`)

Shown in the sidebar only for org `owner`/`admin` or `platform_admin` (see [Authentication & Authorization](/authentication) for the role model).

### Workspace Management

Lists every workspace in the organization:

- **Create** a new workspace (name + optional description)
- **Activate** a workspace that isn't currently active
- **Rename** a workspace and **assign it to one or more teams** — a workspace with teams assigned is only visible to members of those teams (plus org owners/admins); a workspace with no teams is visible to the whole organization
- **Delete** a workspace (with confirmation)

### Members

Manage the organization's members, invitations and teams:

- **Members** — list of everyone in the organization with their org role (`owner` / `admin` / `member`). Change a member's role from the dropdown, or remove them (you cannot change or remove your own membership).
- **Invitations** — invite a new member by email, choosing their initial role and optionally a team. Pending invitations are listed with their expiry and can be cancelled.
- **Teams** — create a team, rename or delete it, and toggle organization members in/out of it. Teams control which workspaces a member can see (via workspace assignment above).

---

## Settings (`/settings`)

The Settings page covers **import and export** of the active workspace's model:

- **Import a model** — drag-and-drop area or click to select a `.xml` file (Open Exchange Format / AOEF). Replaces the active workspace's model.
- **Export the model** — downloads the active workspace's model as Open Exchange XML.

> Workspace creation, renaming, activation, team assignment and deletion are managed from [Workspaces](#workspaces-workspaces) and [Organization → Workspace Management](#workspace-management), not from Settings.

---

## Profile (`/profile`)

Click your name in the top-bar user menu to open your profile.

- **Informations personnelles** — update your display name, view your username and email, and change your password.
- **Tokens API** — generate personal API tokens for the REST API and the MCP server (Bearer authentication). Click **Nouveau token**, give it a name and optional expiry, then copy the token — it is shown only once. See [Authentication & Authorization → API Tokens](/authentication#api-tokens) for how these tokens are scoped and used.

---

## Shortcuts and Tips

| Situation                  | Tip                                                                        |
| -------------------------- | -------------------------------------------------------------------------- |
| Switch workspace           | Go to [Workspaces](/workspaces) and click another workspace to activate it |
| Find an element quickly    | Elements page → search by name, filter by type                             |
| Detect inconsistencies     | Relationships page → "Conflicts" filter                                    |
| See the full model         | Overview → layer stat cards and donut charts                               |
| Check a diagram's validity | Open a view → Validator panel below the canvas                             |
| Manage members and teams   | [Organization](/organization) (org `owner`/`admin` only)                   |
| Export for Archi           | Settings → Export model (.xml, AOEF format compatible with Archi)          |
| Generate an API/MCP token  | Profile → Tokens API → "Nouveau token"                                     |
