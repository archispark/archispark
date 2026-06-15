# Claude Code configuration

This repo ships a project-scoped Claude Code configuration (`.mcp.json` and
`.claude/`) so that opening it in Claude Code — CLI or [Claude Code
Web](https://claude.ai/code) — gives access to the same MCP tools and skills
used during development, without relying on any per-machine setup.

## Sandbox setup (Claude Code Web)

When connecting this repo on [Claude Code Web](https://claude.ai/code), the
project setup screen asks for a **bash setup script** and **environment
variables**.

### Setup script

```bash
set -euo pipefail
corepack enable
corepack prepare pnpm@11.5.1 --activate
pnpm install --frozen-lockfile
```

- `package.json` requires Node `>=22.13` and pins `pnpm@11.5.1` via
  `packageManager` — `corepack` activates the matching pnpm version without a
  global install.
- `pnpm install --frozen-lockfile` is enough to run `pnpm lint`, `pnpm
  typecheck`, `pnpm test`, and `pnpm build`: the test suites run against
  PGlite (in-memory Postgres) and fake Keycloak responses
  (`apps/*/src/test-setup.ts`), so **no `.env`, database, or Docker is needed**
  for the normal dev loop.
- If the sandbox's default Node is older than 22, install/select Node 22
  first (e.g. `nvm install 22 && nvm use 22`) before the `corepack enable`
  line.

### Environment variables

| Variable | Required for | Notes |
|---|---|---|
| `ARCHISPARK_MCP_TOKEN` | `archimate-vercel` MCP server (`.mcp.json`) | Personal API token — generate from **Mon profil → Tokens API → Nouveau token** on `archispark.cloud` (see [MCP server](mcp-server.md)) |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `github` plugin MCP server | See [Plugins & skills](#plugins--skills-claudesettingsjson) below |

Mark both as secrets. Nothing else is required: the `vercel` plugin
authenticates via OAuth through the Claude Code Web UI, and `playwright`
launches its own headless browser.

> Running the full app (`pnpm dev` with real Postgres + Keycloak, e.g. to
> drive the UI with Playwright via the `run` skill) needs Docker inside the
> sandbox plus `make dev-infra` and `make dev-keycloak-setup` — heavier, and
> not covered by the setup script above.

## MCP servers (`.mcp.json`)

| Server | Provides |
|---|---|
| `archimate-vercel` | This project's own [MCP server](mcp-server.md), against the production deployment at `mcp.archispark.cloud`. |

The secret is referenced as a `${VAR}` placeholder — Claude Code expands
environment variables when loading `.mcp.json`, so no token is committed:

- `ARCHISPARK_MCP_TOKEN` — a personal API token for the ArchiSpark MCP
  server, generated from **Mon profil → Tokens API → Nouveau token** on
  `archispark.cloud` (same kind of token as `MCP_AUTH_TOKEN` in
  `.env.example`, see [MCP server](mcp-server.md)).

On Claude Code Web, configure this as a project secret/environment variable.
Locally, export it in your shell before running `claude`.

`vercel`, `github`, and `playwright` MCP servers are **not** defined here —
they come from marketplace plugins (see below).

## Plugins & skills (`.claude/settings.json`)

`enabledPlugins` turns on three plugins from the `claude-plugins-official`
marketplace, each bundling its own MCP server:

| Plugin | MCP server it provides | Notes |
|---|---|---|
| `vercel` | `vercel` (`mcp.vercel.com`) | Also provides the `vercel:*` skills (deploy, env management, AI SDK guidance, etc.). OAuth — connect once via `/mcp` (CLI) or the Claude Code Web UI. |
| `github` | `github` (`api.githubcopilot.com/mcp`) | Needs `GITHUB_PERSONAL_ACCESS_TOKEN` set as a secret/env var. |
| `playwright` | `playwright` | Launches its own headless browser — no local Chrome dependency. |

`extraKnownMarketplaces` registers the marketplace these ship from
(`anthropics/claude-plugins-official`) so they resolve even in a fresh
sandbox.

## Agents (`.claude/agents/`)

- `vitest-coverage-enforcer` — release validation sub-agent, see
  [CLAUDE.md](../CLAUDE.md#release-process).

## What's intentionally left out

- `archimate-local` (MCP server against `localhost:3001`) and `sonarqube`
  (runs via `docker run`) are personal/local-dev tools that don't fit a
  cloud sandbox — keep those in your own `~/.claude.json` if needed.
