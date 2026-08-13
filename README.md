# ArchiSpark

ArchiMate 3.1 modeling tool — a single Next.js app serving the web UI, REST API, and MCP server.

## Quick start

```bash
pnpm install
pnpm env # edit DB_PASSWORD and KEYCLOAK_ADMIN_CLIENT_SECRET in .env.dev
pnpm dev
```

`pnpm dev` starts the local Docker infrastructure (PostgreSQL, Keycloak, and
Neo4j), then starts Turbo in hot-reload mode. The main application is available
on port 8000 and the documentation on port 3000. Stop the local infrastructure
with `pnpm down`.

To run the built main application without starting Docker, run:

```bash
pnpm build
pnpm start
```

## Documentation

La documentation Fumadocs vit dans [`apps/docs`](apps/docs) et se lance avec
`pnpm --filter @archispark/docs dev`.

| Topic                                                                          | Description                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [Installation & local development](apps/docs/content/docs/getting-started/index.md) | Stack, quick start, Docker & pnpm scripts                    |
| [Deployment](apps/docs/content/docs/development/deployment.md)                 | Docker Compose, Vercel                                             |
| [Architecture](apps/docs/content/docs/development/architecture.md)             | Persistence, database schema, `apps/server`, dashboards            |
| [Authentication](apps/docs/content/docs/reference/authentication.md)           | Local accounts, Keycloak login, tokens, access control              |
| [Administration](apps/docs/content/docs/administration/index.md)               | Admin, user provisioning                                           |
| [API reference](apps/docs/content/docs/reference/api-reference.md)             | Workspaces, elements, relationships, views, property definitions   |
| [MCP server](apps/docs/content/docs/reference/mcp-tools.md)                    | Model Context Protocol tools for AI agents                         |
| [Demo data](apps/docs/content/docs/getting-started/demo-data.md)               | Seeding demo accounts and workspaces                               |
| [Contributing](apps/docs/content/docs/development/contributing.md)             | Running tests, code of conduct                                     |
| [Claude Code configuration](apps/docs/content/docs/development/claude-code.md) | MCP servers, plugins, and agents for Claude Code / Claude Code Web |

## License

See [LICENSE](LICENSE).
