---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Testing conventions

- Vitest, run via `test.projects` in `apps/server/vitest.config.ts`: a
  `jsdom` project ("web") for React component/page tests, and a `node`
  project ("server") for `lib/archimate/`, `lib/http/`, `lib/mcp/` business
  logic and Route Handler tests. Test files are colocated with source as
  `*.test.ts(x)` — no separate `__tests__` directory.
- **Never colocate a test file under `apps/server/pages/api/`.** Next.js's
  Pages Router treats every file in `pages/api/` as a live route, so a
  `*.test.ts` there becomes a served endpoint at build time (it happened
  once — `pages/api/mcp.test.ts` shipped as `/api/mcp.test`). Test a
  Pages Router route from outside `pages/` instead, importing the route
  module directly — see `lib/mcp/mcp-route.test.ts` for `pages/api/mcp.ts`.
- The "server" project's `include` list is deliberately an explicit
  directory allowlist (`lib/archimate/**`, `lib/mcp/**`, `lib/http/**`),
  not `pages/api/**` — keep it that way for the reason above.
- Tests run against real **PGlite** (in-memory Postgres), not a mocked
  DB, for `lib/archimate/` — `lib/archimate/test-setup.ts` runs migrations
  once per suite before tests execute. MCP tool tests
  (`lib/mcp/tools/*.test.ts`) instead mock `lib/archimate/store.ts`/
  `registry.ts`/`access.ts` directly and capture registered handlers via
  `lib/mcp/tools/test-helper.ts`'s `createFakeMcpServer()` — no PGlite
  needed there, since the goal is exercising each tool's input mapping and
  validation, not the data layer (already covered by `store.test.ts`).
- **Keycloak auth is faked, not the JWT layer mocked wholesale.**
  `test-setup.ts` globally `vi.mock`s `@workspace/auth`, replacing only
  `verifyAccessToken`/the users API while keeping other exports real.
  Get a usable token via `getAdminToken()` / `getSecondUserToken()` in
  `apps/server/lib/archimate/test-helper.ts` — fake tokens are
  base64url-encoded `KeycloakClaims` built by
  `apps/server/lib/archimate/test/keycloak-token-fake.ts`. Never spin up
  a real Keycloak or hand-roll a JWT in a test.
- The "server" vitest project runs with `pool: "forks"` and a **90s**
  hook/test timeout — each test file boots its own PGlite instance and
  turbo runs packages in parallel, so this isn't slack to remove. Don't
  lower it, and don't be surprised if a slow integration test needs it.
- Some test blocks are **order-dependent within a file** (e.g. a block
  that empties a table is explicitly commented "keep this last").
  Preserve existing ordering when adding or moving tests in such files.
- Run a single test file or test name directly with vitest from the app
  directory: `cd apps/server && pnpm vitest run lib/archimate/store.test.ts`
  or `pnpm vitest run -t "creates a workspace with empty model"`. Add
  `--project server` / `--project web` to target one project only.
