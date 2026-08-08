import { vi } from "vitest";
import { runMigrations } from "@workspace/db";

// There is no real Keycloak instance in the test environment — replace
// @workspace/auth's Users API and verifyAccessToken with in-memory fakes
// (keeping every other export as the real implementation). verifyAccessToken
// decodes a deterministic fake token (see ./test/keycloak-token-fake.ts)
// instead of verifying a real JWT against JWKS.
vi.mock("@workspace/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/auth")>();
  const { fakeUsersApi, seedDemoKeycloakUsers } = await import("./test/keycloak-users-fake.js");
  const { fakeVerifyAccessToken } = await import("./test/keycloak-token-fake.js");
  seedDemoKeycloakUsers();
  return { ...actual, ...fakeUsersApi, verifyAccessToken: vi.fn().mockImplementation(fakeVerifyAccessToken) };
});

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every table (workspaces, elements, relationships,
// views, api_tokens, site_settings, ...) exists. runMigrations() is idempotent.
await runMigrations();
