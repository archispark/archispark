---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Testing conventions

- Vitest (+ `supertest` for HTTP-level tests in `apps/api`). Test files
  are colocated with source as `*.test.ts` — no separate `__tests__`
  directory.
- Tests run against real **PGlite** (in-memory Postgres), not a mocked
  DB. `apps/api/src/test-setup.ts` runs migrations once per suite
  before tests execute.
- **Keycloak auth is faked, not the JWT layer mocked wholesale.**
  `test-setup.ts` globally `vi.mock`s `@workspace/auth`, replacing only
  `verifyAccessToken`/the users API while keeping other exports real.
  Get a usable token via `getAdminToken()` / `getSecondUserToken()` in
  `apps/api/src/test-helper.ts` — fake tokens are base64url-encoded
  `KeycloakClaims` built by `apps/api/src/test/keycloak-token-fake.ts`.
  Never spin up a real Keycloak or hand-roll a JWT in a test.
- `apps/api` tests run with `pool: "forks"` and a **90s** hook/test
  timeout — each test file boots its own PGlite instance and turbo runs
  packages in parallel, so this isn't slack to remove. Don't lower it,
  and don't be surprised if a slow integration test needs it.
- Some test blocks are **order-dependent within a file** (e.g. a block
  that empties a table is explicitly commented "keep this last").
  Preserve existing ordering when adding or moving tests in such files.
- Run a single test file or test name directly with vitest from the app
  directory: `cd apps/api && pnpm vitest run src/registry.test.ts` or
  `pnpm vitest run -t "creates a workspace with empty model"`.
