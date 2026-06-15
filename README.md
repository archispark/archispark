# ArchiSpark

ArchiMate 3.1 modeling tool — REST API, MCP server, and web UI.

## Quick start

```bash
pnpm install
pnpm dev          # API :3000 · Web :8000 · Admin :8001 · MCP :3001 · all bound to 0.0.0.0
```

See [Installation & local development](docs/installation.md) for prerequisites, first-run behaviour, and Docker/Makefile workflows.

## Documentation

| Topic | Description |
|---|---|
| [Installation & local development](docs/installation.md) | Stack, quick start, Docker & Makefile |
| [Deployment](docs/deployment.md) | Kubernetes (Helm), Vercel |
| [Architecture](docs/architecture.md) | Persistence, multi-tenant database model, control-api / tenant-api split |
| [Authentication](docs/authentication.md) | Keycloak login, tokens, access control |
| [Organizations & administration](docs/administration.md) | Organizations, teams, roles, admin web console |
| [API reference](docs/api-reference.md) | Workspaces, elements, relationships, views, property definitions |
| [MCP server](docs/mcp-server.md) | Model Context Protocol tools for AI agents |
| [Demo data](docs/demo-data.md) | Seeding demo organizations and accounts |
| [Contributing](docs/contributing.md) | Running tests, code of conduct |

## License

See [LICENSE](LICENSE).
