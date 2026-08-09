---
title: User Guide
description: Navigate the web interface and manage elements, relationships, views, and settings.
---

URL: `http://localhost:8000`

## Sign in

The interface displays a sign-in form on startup. Enter your username and
password, then submit the form.

**Demo accounts:**

| Account   | Password  |
| --------- | --------- |
| `admin`   | `admin`   |
| `user`    | `user`    |
| `contrib` | `contrib` |
| `archi`   | `archi`   |

> See [Authentication and authorization](/authentication#demo-accounts) for a
> complete breakdown of roles (platform role versus organization role) and the
> `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` / `SEED_CONTRIB_PASSWORD` /
> `SEED_ARCHI_PASSWORD` environment variables used to override these passwords
> in production.

---

## Navigation

### Top bar (Nav)

The top bar contains:

- **Menu button** — opens the sidebar on mobile
- **Breadcrumb** — Organization (if you are an `owner`, `admin`, or
  `platform_admin`) / Workspaces / Active workspace name / Current section
- **Organization switcher** — visible when your account belongs to more than
  one organization
- **Language selector** — switches the interface language (see below)
- **Theme button** — toggles between light and dark mode
- **User menu** — access your profile and sign out

### Sidebar

The left sidebar provides access to every section. At the top, it displays the
name of the **active** model and its global counters (elements · relationships ·
views).

| Section                 | Route               | Description                                                                                                                     |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Overview                | `/`                 | Summary dashboard                                                                                                               |
| Workspaces              | `/workspaces`       | List, create, and switch between ArchiMate models (workspaces)                                                                  |
| —                       | —                   | —                                                                                                                               |
| **Elements**            |                     |                                                                                                                                 |
| List                    | `/elements`         | All elements, with a badge for elements that do not appear in any view                                                          |
| _(one entry per layer)_ | `/elements?layer=X` | Quick filter by ArchiMate layer, with counts per layer                                                                          |
| —                       | —                   | —                                                                                                                               |
| **Relationships**       |                     |                                                                                                                                 |
| List                    | `/relationships`    | All relationships, with a conflict count badge                                                                                  |
| —                       | —                   | —                                                                                                                               |
| **Views**               |                     |                                                                                                                                 |
| List                    | `/views`            | All diagrams                                                                                                                    |
| —                       | —                   | —                                                                                                                               |
| **Properties**          |                     |                                                                                                                                 |
| List                    | `/properties`       | Property definitions                                                                                                            |
| —                       | —                   | —                                                                                                                               |
| Organization            | `/organization`     | Workspace, member, invitation, and team management — shown only to organization `owner`/`admin` users or `platform_admin` users |
| Settings                | `/settings`         | Import or export the active model                                                                                               |

> On desktop, the sidebar can be **collapsed to an icon-only rail** using the
> toggle at the bottom (panel icon). All sections remain accessible as icons
> with the same badges.

---

## Interface language

ArchiSpark provides a fully translated interface in **five languages**:

| Language | Code | Selector |
| -------- | ---- | -------- |
| Français | `fr` | FR       |
| English  | `en` | EN       |
| Español  | `es` | ES       |
| Deutsch  | `de` | DE       |
| Italiano | `it` | IT       |

The language selector is available from the top bar (flag icon and language
code).

The preference is **saved in the browser** (`localStorage`): it persists across
sessions and does not require a user account.

All interface elements are translated: navigation labels, section titles,
action buttons, error messages, create/edit/delete forms, and ArchiMate layer
names.

---

## Overview (`/`)

The dashboard displays:

- The active model's **name, documentation, and version**
- **Stat cards**: total elements, counts per layer (sorted by volume),
  relationships, and views — each with a small progress bar highlighting
  elements absent from every view or relationships with an ArchiMate conflict
- **Donut charts**: elements by type and relationships by type (top types, with
  an “Other” slice for the long tail)

Layer cards use the standard ArchiMate palette (yellow = Business, blue =
Application, green = Technology, and so on).

---

## Workspaces (`/workspaces`)

A **workspace** is an ArchiMate model (elements, relationships, views, and
properties). Your organization can contain several workspaces, for example one
per project or business unit.

The page lists all the workspaces you can access, with the **active** workspace
marked.

### Create a workspace

Click **+ New workspace**:

1. **Name** — required
2. **Description** — optional

The new workspace is created and activated automatically, and you are taken to
the Overview.

### Switch to / activate a workspace

Click anywhere on a workspace row to **activate** it (unless it is already
active) and open its Overview. The active workspace determines which elements,
relationships, views, and properties are displayed throughout the application.

> Renaming a workspace, assigning it to specific teams, or deleting it is done
> from [Organization → Workspace management](#workspace-management), available
> to organization `owner`/`admin` users.

---

## Elements (`/elements`)

### List and filters

The table displays all elements with the following columns: **Name**, **Type**
(badge), **Layer** (colored chip), and **Documentation**.

Two filters are available at the top:

- **Name search** — filters in real time with a 300 ms debounce
- **Type selector** — filters by a specific ArchiMate type

### Filter by layer

In the sidebar, click a layer (for example, “Application”) to filter the list
automatically and update the page title.

### Create an element

Click **+ New element**:

1. **Name** — required
2. **Type** — select from 60 ArchiMate element types grouped by layer
3. **Documentation** — free-form description (optional)
4. **Properties** — key/value pairs based on the model definitions (optional)

### Edit an element

Click the element name or the edit icon to open the **element detail** page
(`/elements/:id`). All fields can be edited inline by double-clicking them.

### Delete an element

On the element detail page, click **Delete** (top right). Confirmation is
required. Deletion cascades: **all relationships** referencing the element and
**all its nodes in views** are also deleted.

> Creating, editing, and deleting elements requires write access — see
> [Authentication and authorization](/authentication) for the role model.

---

## Element detail (`/elements/:id`)

The detail page displays complete information about the element and provides
three tabs.

### Header

Displays and allows inline editing (by double-clicking) of:

- **Type** — ArchiMate type badge (opens a selector on double-click)
- **Layer** — colored chip (Business, Application, Technology, and so on)
- **View status** — green ✓ if the element appears in at least one view, yellow
  warning if it is unused
- **Name** — editable by double-clicking
- **Identifier** — read-only UUID
- **Documentation** — editable multiline text
- **Specialization** — parent element through an ArchiMate specialization
  relationship

### Tab 1 — Properties

Lists all property key/value pairs attached to the element.

- **Add a property**: click **+ New** → select a property definition → enter a
  value → confirm
- **Edit a value**: double-click the value cell
- **Delete a property**: click the delete icon on the row

### Tab 2 — Relationships

Lists all relationships in which this element is the source or target.

| Column | Description                                             |
| ------ | ------------------------------------------------------- |
| Status | ✓ allowed / conflict under ArchiMate 3.1 rules          |
| Type   | Relationship type (Association, Realization, and so on) |
| Name   | Optional relationship name                              |
| Source | Source element (link to its detail page)                |
| Target | Target element (link to its detail page)                |

Click the expand icon to expand a row and see validation details or other
allowed types.

**Available actions:** + New relationship · Edit · Delete

### Tab 3 — Graph

An animated force-directed graph showing the element and all its direct
neighbors.

- **Central node** — current element, fixed in the center and highlighted with
  a colored ring matching its ArchiMate layer
- **Neighboring nodes** — each connected element, colored according to its own
  layer
- **Edges** — animated dashed lines labeled with the relationship name or type
- Nodes are positioned using a physics simulation (d3-force); the view fits the
  content automatically
- **Click a neighbor** to open its detail page
- **Pan / zoom** with the mouse — controls are available in the bottom-left
  corner

---

## Relationships (`/relationships`)

### List and filters

The table displays: **ArchiMate status** (✓ OK or conflict), **Type**, **Name**,
**Source**, and **Target**.

Available filters:

- **Name search** — 300 ms debounce
- **Type selector** — filters by relationship type
- **Status filters**: All / OK / Conflicts

### ArchiMate validation

Each relationship is validated against the ArchiMate 3.1 compatibility rules.
A green icon (✓) indicates an allowed relationship; conflicts are shown in red.

Click the expand icon at the start of a row to **expand the details**: the
relationship type between the two element types is explained, and allowed
alternatives are suggested when there is a conflict.

### Create a relationship

Click **+ New relationship**:

1. **Type** — required (11 ArchiMate relationship types)
2. **Source** — source element (choose from all elements)
3. **Target** — target element
4. **Name** — optional
5. **Documentation** — optional
6. **Properties** — optional
7. Special fields by type:
   - `Access` → **Access type**: Read / Write / ReadWrite / Access
   - `Association` → **Directed**: yes/no
   - `Influence` → **Strength**: `+`, `++`, `-`, `--`

### Edit / delete

Use the buttons on the right of each row.

---

## Views (`/views`)

### Diagram list

The table displays a **status** icon (✓ if all connections are valid, a warning
if at least one conflicts, or — if the view has no connections), **Name**
(clickable link), **Viewpoint**, **Nodes**, and **Connections**.

The filters at the top let you limit the list to **All / OK / Conflicts**.
Expand a row to see the breakdown of valid and conflicting relationships for
that view.

Click a view name to open its **detail page** with the interactive canvas.

### Create a view

Click **+ New view**:

1. **Name** — required
2. **Viewpoint** — select from 28 ArchiMate viewpoints (loaded from the API)
3. **Documentation** — optional

### Edit / delete

Use the buttons on each row.

---

## View detail (`/views/:id`)

### Interactive canvas

The canvas uses React Flow to display and edit the diagram.

**Available interactions:**

| Action              | Gesture                                        |
| ------------------- | ---------------------------------------------- |
| Pan the view        | Click and drag the background                  |
| Zoom                | Mouse wheel                                    |
| Select a node       | Click it                                       |
| Move a node         | Click and drag                                 |
| Resize a node       | Corner handles                                 |
| Add a node          | Drag an element from the side panel            |
| Create a connection | Click and drag from one node handle to another |
| Delete a node       | Select → Delete key                            |
| Delete a connection | Select → Delete key                            |
| Fit the view        | Control buttons (bottom left)                  |

**Nodes and styles:**

- Nodes are colored by ArchiMate layer
- Shapes follow ArchiMate notation (hexagon = Function, chevron = Event,
  pill = Service, and so on)
- Connections use orthogonal routing with standard relationship markers
  (diamond = Composition, open arrowhead = Realization, and so on)

**Export the canvas:** The **Download PNG** button (bottom right) exports the
canvas as displayed using `html-to-image`.

> Editing the canvas (moving/resizing nodes, adding elements, and creating or
> deleting connections), as well as renaming the view, editing its
> documentation/viewpoint, and deleting it, requires write access.

### Validator display

Below the canvas, a **Validator** panel lists every relationship rendered as a
connection in the view, with its ArchiMate compliance status (✓ / conflict),
source, and target. This is the same table as on the Relationships page,
filtered to the connections in this view — use it to check a diagram before
sharing it.

> The former `/validator` route still exists for backward compatibility and
> redirects to `/views` — the validator itself now lives on each view's detail
> page, as described above.

---

## Properties (`/properties`)

Manage **property definitions** that can be attached to model elements and
relationships.

### Create a definition

Click **+ New definition**:

- **Name** — readable identifier (for example, “annual cost” or “owner”)
- **Type** — `string` (default), `boolean`, `date`, `number`, or `enumeration`

### Usage

Once defined, the property appears in the element and relationship create/edit
forms (in the “Properties” section) as a key/value pair.

---

## Organization (`/organization`)

Shown in the sidebar only to organization `owner`/`admin` users or
`platform_admin` users (see
[Authentication and authorization](/authentication) for the role model).

### Workspace management

Lists all workspaces in the organization:

- **Create** a new workspace (name and optional description)
- **Activate** a workspace that is not currently active
- **Rename** a workspace and **assign it to one or more teams** — a workspace
  with assigned teams is visible only to members of those teams (plus owners
  and administrators); a workspace without a team is visible to the entire
  organization
- **Delete** a workspace (with confirmation)

### Members

Manage the organization's members, invitations, and teams:

- **Members** — list all organization members and their organization role
  (`owner` / `admin` / `member`).
- **Invitations** — invite a new member by email, choosing their initial role
  and, optionally, a team. Pending invitations are listed with their expiration
  date and can be canceled.
- **Teams** — create, rename, or delete a team, and add organization members to
  or remove them from it. Teams control which workspaces a member can see
  (through the workspace assignment described above).

---

## Settings (`/settings`)

The Settings page covers **importing and exporting** the active workspace model:

- **Import a model** — drag and drop or click to select an `.xml` file (Open
  Exchange Format / AOEF). This replaces the active workspace model.
- **Export the model** — downloads the active workspace model as Open Exchange
  XML.

> Workspace creation, renaming, activation, assignment, and deletion are
> managed from [Workspaces](#workspaces-workspaces) and
> [Organization → Workspace management](#workspace-management), not from
> Settings.

---

## Profile (`/profile`)

Click your name in the top bar's user menu to open your profile.

- **Personal information** — update your display name, view your username and
  email address, and change your password.
- **API tokens** — generate personal API tokens for the REST API and MCP server.
  Click **New token**, give it a name and an optional expiration date, then copy
  the token — it is shown only once. See
  [Authentication and authorization → API tokens](/authentication#api-tokens)
  to learn how these tokens are scoped and used.

---

## Shortcuts and tips

| Situation                  | Tip                                                                        |
| -------------------------- | -------------------------------------------------------------------------- |
| Switch workspaces          | Go to [Workspaces](/workspaces) and click another workspace to activate it |
| Find an element quickly    | Elements page → search by name or filter by type                           |
| Detect inconsistencies     | Relationships page → “Conflicts” filter                                    |
| See the complete model     | Overview → layer stat cards and donut charts                               |
| Check a diagram's validity | Open a view → Validator panel below the canvas                             |
| Manage members and teams   | [Organization](/organization) (organization `owner`/`admin` only)          |
| Export for Archi           | Settings → Export model (`.xml`, AOEF format compatible with Archi)        |
| Generate an API/MCP token  | Profile → API Tokens → “New token”                                         |
