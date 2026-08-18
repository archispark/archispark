---
title: Properties
description: Manage property definitions attached to model elements and relationships.
---

## Properties (`/properties`)

![Property definitions list with name, type, and origin](/screenshots/properties.png)

Manage **property definitions** that can be attached to model elements and
relationships.

ArchiSpark supplies protected system definitions. The first is
`Archispark Plugin IconPack`, whose value is picked from the image
library (an icon from a vendor pack — AWS, Azure, GCP — or from a custom
pack) directly on the property, or a legacy HTTP(S) image URL / relative
path for values written before the image library existed. Its definition
cannot be renamed, retyped, or deleted, but its value remains editable on
elements and relationships. Definitions you create remain fully editable.

### Create a definition

Click **+ New definition**:

- **Name** — readable identifier (for example, “annual cost” or “owner”)
- **Type** — `string` (default), `boolean`, `date`, `number`, or `enumeration`

### Usage

Once defined, the property appears in the element and relationship create/edit
forms (in the “Properties” section) as a key/value pair.
