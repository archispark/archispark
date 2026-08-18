---
title: MCP Server
description: Connect AI clients to ArchiSpark's Streamable HTTP MCP server.
---

| Aspect    | Detail                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint  | `http://localhost:8000/mcp/` (same origin, same process as the web UI and REST API — see [Architecture](../development/architecture.mdx#apps-server); the transport lives at `apps/server/pages/api/mcp.ts`, reached through a `/mcp/:path*` → `/api/mcp` rewrite that preserves the pre-fusion external URL) |
| Transport | Streamable HTTP (MCP 2025-03-26), stateless (no session id — each request gets a fresh server instance, safe for serverless)                                                                                                                                                                                  |
| Auth      | `Authorization: Bearer <token>` on every request, where `<token>` is a personal API token (`api_tokens` table, same tokens used for the REST API)                                                                                                                                                             |

Generate a token from **Mon profil → Tokens API → Nouveau token** in the web
UI, then configure your client:

```bash
claude mcp add archimate \
  http://localhost:8000/mcp/ \
  --transport http \
  --header "Authorization: Bearer <token>"
```

- The token resolves the calling user's identity and its pinned
  organization/workspace scope (set at token creation, see
  [Authentication](authentication.mdx#organizations-and-roles)).
- Every tool resolves access through the same
  `apps/server/lib/archimate/access.ts` gateway used by the REST API,
  honouring the caller's `owner`/`editor`/`viewer` role: read-only tools
  work for any role, mutating tools like `create_element` or
  `import_model` require `owner`/`editor`.

**Available tools (38), 2 prompts, 2 resources:**

| Group                | Tools                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model                | `get_model_info`                                                                                                                                                  |
| Elements             | `list_element_types`, `list_elements`, `get_element`, `create_element`, `update_element`, `delete_element`, `get_element_relationships`, `list_elements_in_views` |
| Relationships        | `list_relationship_types`, `list_relationships`, `get_relationship`, `create_relationship`, `update_relationship`, `delete_relationship`                          |
| Views                | `list_views`, `get_view`, `create_view`, `update_view`, `delete_view`, `render_view`                                                                              |
| Nodes                | `create_node`, `update_node`, `delete_node`                                                                                                                       |
| Connections          | `create_connection`, `update_connection`, `delete_connection`                                                                                                     |
| Property definitions | `list_property_definitions`, `get_property_definition`, `create_property_definition`, `update_property_definition`, `delete_property_definition`                  |
| Workspaces           | `list_workspaces`, `activate_workspace`                                                                                                                           |
| Viewpoints           | `list_viewpoints`                                                                                                                                                 |
| Import / Export      | `export_model`, `import_model`                                                                                                                                    |
| Persistence          | `save_model` (no-op, kept for compatibility)                                                                                                                      |

Property-definition results include `is_system`. System definitions such as
`Archispark Plugin IconPack` cannot be updated or deleted; their values
remain editable on elements and relationships and must be a plugin icon's
slug (see [Plugins](/docs/developer-guide/reference/plugins)) or a legacy
HTTP(S) URL / relative path.

**Prompts:** `archimate-modeling-guide` (load ArchiMate 3.1 rules — call first), `create-viewpoint-view` (step-by-step view creation for a given viewpoint).  
**Resources:** `archimate://layers`, `archimate://relationships`.

Interactive docs: `GET /api/docs` — OpenAPI spec: `GET /api/openapi.json`.
