import { vi } from "vitest"
import { runMigrations } from "@workspace/db"

// There is no real Keycloak instance in the test environment — replace
// @workspace/auth's Users API and verifyAccessToken with in-memory fakes
// (keeping every other export as the real implementation). verifyAccessToken
// decodes a deterministic fake token (see ./test/keycloak-token-fake.ts)
// instead of verifying a real JWT against JWKS.
vi.mock("@workspace/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/auth")>()
  const { fakeUsersApi, seedDemoKeycloakUsers } =
    await import("./test/keycloak-users-fake.js")
  const { fakeVerifyAccessToken } =
    await import("./test/keycloak-token-fake.js")
  seedDemoKeycloakUsers()
  return {
    ...actual,
    ...fakeUsersApi,
    verifyAccessToken: vi.fn().mockImplementation(fakeVerifyAccessToken),
    // verify-any.ts imports verifyAccessToken from its own relative sibling
    // module, not through this package's mocked export, so it never sees the
    // fake above — mock its own entry point too. A real (3-part) JWT, e.g.
    // one from signLocalAccessToken, is dispatched exactly like production;
    // the fixture's fake tokens (a single base64url segment, no dots) go
    // straight to fakeVerifyAccessToken.
    verifyAnyAccessToken: vi
      .fn()
      .mockImplementation(async (token: string) =>
        token.split(".").length === 3
          ? actual.verifyAnyAccessToken(token)
          : fakeVerifyAccessToken(token)
      ),
  }
})

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every table (workspaces, elements, relationships,
// views, api_tokens, site_settings, ...) exists. runMigrations() is idempotent.
await runMigrations()
