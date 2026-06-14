import { vi } from "vitest";
import { runMigrations } from "@workspace/db";

// There is no real Keycloak instance in the test environment — replace
// @workspace/auth's Phasetwo Organizations/Users API and verifyAccessToken
// with in-memory fakes (keeping every other export, e.g. ORG_ROLES, as the
// real implementation). verifyAccessToken decodes a deterministic fake token
// (see ./test/keycloak-token-fake.ts) instead of verifying a real JWT against
// JWKS. Test files that need per-test verifyAccessToken behaviour
// (auth.test.ts) provide their own vi.mock("@workspace/auth", ...) which must
// also spread fakeOrgsApi/fakeUsersApi and the fake verifyAccessToken to keep
// this behaviour.
vi.mock("@workspace/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/auth")>();
  const { fakeOrgsApi } = await import("./test/keycloak-orgs-fake.js");
  const { fakeUsersApi, seedDemoKeycloakUsers } = await import("./test/keycloak-users-fake.js");
  const { fakeVerifyAccessToken } = await import("./test/keycloak-token-fake.js");
  seedDemoKeycloakUsers();
  return { ...actual, ...fakeOrgsApi, ...fakeUsersApi, verifyAccessToken: vi.fn().mockImplementation(fakeVerifyAccessToken) };
});

// Shared with the proxy middleware in app.ts (signs) and tenant-api's
// requireTenantToken (verifies) — set here so app.test.ts can mint/verify
// inter-service tokens without TENANT_JWT_SECRET being unset.
process.env["TENANT_JWT_SECRET"] ??= "test-tenant-jwt-secret";

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every table (teams, API tokens, organization
// settings, tenant databases, site settings) exists. runMigrations() is
// idempotent — registry's startup also calls it, and drizzle tracks applied
// migrations.
await runMigrations();
