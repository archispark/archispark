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

# The setup script's working directory is /home/user, not the repo
# checkout, so `pnpm install` there fails with ERR_PNPM_NO_PKG_MANIFEST.
# Locate the cloned ArchiSpark repo (its pnpm workspace root) and cd into it.
# The `|| true` keeps `find`'s exit status from tripping `set -e`/`pipefail`
# (e.g. if it can't descend into some subdirectory).
REPO_DIR=$(find /home/user -maxdepth 4 -name pnpm-workspace.yaml \
  -not -path "*/node_modules/*" 2>/dev/null | head -1 | xargs -r dirname || true)
cd "${REPO_DIR:?could not locate the ArchiSpark repo checkout under /home/user}"

corepack enable
corepack prepare pnpm@11.5.1 --activate
pnpm install --frozen-lockfile
```

- `package.json` requires Node `>=22.13` and pins `pnpm@11.5.1` via
  `packageManager` — `corepack` activates the matching pnpm version without a
  global install. Cloud sessions already provide Node 22 via `nvm`.
- `pnpm install --frozen-lockfile` is enough to run `pnpm lint`, `pnpm
  typecheck`, `pnpm test`, and `pnpm build`: the test suites run against
  PGlite (in-memory Postgres) and fake Keycloak responses
  (`apps/*/src/test-setup.ts`), so **no `.env`, database, or Docker is needed**
  for the normal dev loop.

### Environment variables

| Variable | Required for | Notes |
|---|---|---|
| `ARCHISPARK_MCP_TOKEN` | `archimate-vercel` MCP server (`.mcp.json`) | Personal API token — generate from **Mon profil → Tokens API → Nouveau token** on `archispark.cloud` (see [MCP server](mcp-server.md)) |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `github` plugin MCP server | See [Plugins & skills](#plugins--skills-claudesettingsjson) below |

Mark both as secrets. Nothing else is required: the `vercel` plugin
authenticates via OAuth through the Claude Code Web UI, and `playwright`
launches its own headless browser.

> Running the full app (`make up`, with real Postgres + Keycloak, e.g. to
> drive the UI with Playwright via the `run` skill) needs Docker inside the
> sandbox plus `make keycloak-setup` — heavier, and not covered by the setup
> script above.

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

`enabledPlugins` turns on four plugins:

| Plugin | Marketplace | Provides | Notes |
|---|---|---|---|
| `vercel` | `claude-plugins-official` | MCP server `vercel` (`mcp.vercel.com`) | Also provides the `vercel:*` skills (deploy, env management, AI SDK guidance, etc.). OAuth — connect once via `/mcp` (CLI) or the Claude Code Web UI. |
| `github` | `claude-plugins-official` | MCP server `github` (`api.githubcopilot.com/mcp`) | Needs `GITHUB_PERSONAL_ACCESS_TOKEN` set as a secret/env var. |
| `playwright` | `claude-plugins-official` | MCP server `playwright` | Launches its own headless browser — no local Chrome dependency. |
| `codex` | `openai-codex` | `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, `/codex:status`, `/codex:result`, `/codex:cancel`, `/codex:transfer`, `/codex:setup` | No MCP server — Bash-driven background Codex CLI runtime. Code review and test/coverage fix-up work is delegated here (see below) instead of local sub-agents. Run `/codex:setup` once per machine to verify Codex CLI install and auth. |

`extraKnownMarketplaces` registers the two marketplaces these ship from
(`anthropics/claude-plugins-official`, `openai/codex-plugin-cc`) so they
resolve even in a fresh sandbox.

## Code review & test triage — delegated to Codex, not local agents

This project has no `.claude/agents/` sub-agents. Review and test/coverage
work is delegated to the Codex plugin instead:

- `/codex:review --background` (add `--base main` for a whole-branch
  review) after a significant change — read-only.
- `/codex:adversarial-review --background <risk angle>` before a
  production-facing change (auth, data loss, concurrency).
- `/codex:rescue --background <precise task>` to investigate a bug, fix
  a failing test, or close a coverage gap — can modify code.
- Release validation (`.claude/skills/release/SKILL.md`) uses `/codex:review`
  + `/codex:rescue` in place of the old `vitest-coverage-enforcer` agent.

See [CLAUDE.md's "Amélioration continue"](../CLAUDE.md#amélioration-continue)
for when to promote a recurring Codex finding into a rule.

## Rules (`.claude/rules/`)

Path-scoped conventions, loaded only when Claude touches matching
files: `testing.md` (`**/*.test.ts(x)`), `api.md` (`apps/api/src/**`),
`db.md` (`packages/db/**`), `frontend.md` (`apps/web/**`,
`packages/ui/**`).

## Skills (`.claude/skills/`)

- `release` — human-triggered walkthrough of the release process (see
  [CLAUDE.md](../CLAUDE.md#release-process)).
- `retro` — human-triggered end-of-session retrospective that proposes
  updates to `CLAUDE.md`/`.claude/rules/`/`docs/decisions.md`.

## What's intentionally left out

- `archimate-local` (MCP server against `localhost:3001`) and `sonarqube`
  (runs via `docker run`) are personal/local-dev tools that don't fit a
  cloud sandbox — keep those in your own `~/.claude.json` if needed.
