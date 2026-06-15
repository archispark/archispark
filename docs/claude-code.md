# Claude Code configuration

This repo ships a project-scoped Claude Code configuration (`.mcp.json` and
`.claude/`) so that opening it in Claude Code — CLI or [Claude Code
Web](https://claude.ai/code) — gives access to the same MCP tools and skills
used during development, without relying on any per-machine setup.

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
