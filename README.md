# ArchiSpark

ArchiMate 3.1 modeling tool — a single Next.js app serving the web UI, REST API, and MCP server.

## Quick start

```bash
pnpm install
pnpm env # edit DB_PASSWORD and KEYCLOAK_ADMIN_CLIENT_SECRET in .env.dev
pnpm infra:up
pnpm dev
```

`pnpm infra:up` starts the local Docker infrastructure (PostgreSQL, Keycloak,
and Neo4j) — it is a separate step, never run implicitly by `dev` or `start`.
`pnpm dev` then starts the main application in hot-reload mode on port 8000.
Stop the local infrastructure with `pnpm stop`.

Only PostgreSQL is required; Mailpit, Keycloak, and Neo4j start on demand via
Docker Compose profiles (`pnpm infra:up:db`, `infra:up:mail`, `infra:up:auth`,
`infra:up:neo4j` — see
[Installation & Local Development](apps/docs/content/docs/getting-started/index.md#docker--pnpm-scripts)).

To run the built main application (infrastructure must already be running):

```bash
pnpm build
pnpm start
```

## Documentation

La documentation Fumadocs vit dans [`apps/docs`](apps/docs) et se lance
indépendamment de l'application principale, avec `pnpm dev:docs` (ou
`pnpm start:docs` pour la version buildée).

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
