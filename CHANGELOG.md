# Changelog

All notable changes to this project will be documented in this file.

---

## [0.4.2]

- Replaced Archi native format parser/serializer (`archi-parser.ts`, `serializer.ts`) with Open Exchange Format equivalents (`oxf-parser.ts`, `oxf-serializer.ts`).
- Generated IDs now prefixed with `id-` to satisfy the `xs:ID` / NCName constraint required by OEF XSDs.
- `deleteElement` now cascades to view nodes that reference the deleted element.
- Bendpoint model simplified: `startX/startY/endX/endY` replaced by `x/y`.

---

## [0.4.0]

- SVG renderer: removed title bar; view name now in `<title>` element only.
- SVG renderer: derived line color from fill color when no explicit line color set (Archi formula: fill × 0.7).
- SVG renderer: `archi_type` field on nodes selects box vs. icon display mode.
- SVG renderer: icons rendered for `Grouping` elements and `data-object` shapes.
- SVG renderer: arrow/connector marker colors corrected to `#000`.
- SVG renderer: fixed text centering in Process shapes.
- `ArchiNode` model and parser now carry `archi_type` for display-mode selection.

---

## [0.3.1]

- Added write MCP tools: `create_element`, `update_element`, `delete_element`, `create_relationship`, `update_relationship`, `delete_relationship`, `save_model`.
- Minor OpenAPI spec update.

## [0.3.0]

- Read-only MCP tools: `get_model_info`, `list_element_types`, `list_elements`, `get_element`, `list_relationship_types`, `list_relationships`, `get_relationship`, `list_views`, `get_view`.
- Multi-source REST API with `/:source_id` prefix.
- Support for Archi native format (`.archimate`) and Open Exchange Format (OEF).
