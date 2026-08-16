---
title: Relationships
description: List, validate, create, edit, and delete ArchiMate relationships.
---

## Relationships (`/relationships`)

![Relationships list with ArchiMate validation status](/screenshots/relationships.png)

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
