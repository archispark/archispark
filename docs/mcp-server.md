# MCP Server

Endpoint: `http://localhost:3001/mcp/`  
Transport: Streamable HTTP (MCP 2025-03-26), stateless (no session id — each request gets a fresh server instance, safe for serverless).

**Authentication:** every request requires `Authorization: Bearer <token>`, where `<token>` is a personal API token (`api_tokens` table, same tokens used for the REST API). Generate one from **Mon profil → Tokens API → Nouveau token** in the web UI, then configure your client:

```bash
claude mcp add archimate \
  http://localhost:3001/mcp/ \
  --transport http \
  --header "Authorization: Bearer <token>"
```

The token resolves the calling user's identity — all tools operate on that user's own active workspace.

**Available tools (38), 2 prompts, 2 resources:**

| Group | Tools |
|---|---|
| Model | `get_model_info` |
| Elements | `list_element_types`, `list_elements`, `get_element`, `create_element`, `update_element`, `delete_element`, `get_element_relationships`, `list_elements_in_views` |
| Relationships | `list_relationship_types`, `list_relationships`, `get_relationship`, `create_relationship`, `update_relationship`, `delete_relationship` |
| Views | `list_views`, `get_view`, `create_view`, `update_view`, `delete_view`, `render_view` |
| Nodes | `create_node`, `update_node`, `delete_node` |
| Connections | `create_connection`, `update_connection`, `delete_connection` |
| Property definitions | `list_property_definitions`, `get_property_definition`, `create_property_definition`, `update_property_definition`, `delete_property_definition` |
| Workspaces | `list_workspaces`, `activate_workspace` |
| Viewpoints | `list_viewpoints` |
| Import / Export | `export_model`, `import_model` |
| Persistence | `save_model` (no-op, kept for compatibility) |

**Prompts:** `archimate-modeling-guide` (load ArchiMate 3.1 rules — call first), `create-viewpoint-view` (step-by-step view creation for a given viewpoint).  
**Resources:** `archimate://layers`, `archimate://relationships`.

Interactive docs: `GET /docs` — OpenAPI spec: `GET /openapi.json`.
