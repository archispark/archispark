---
title: Workspaces
description: The overview dashboard and workspace (ArchiMate model) management.
---

## Overview (`/`)

![Overview dashboard with stat cards and donut charts](/screenshots/overview.png)

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

> Renaming, exporting, or deleting the active workspace is done from
> [Settings](settings-and-profile#settings-settings), with Owner or Editor
> access.
