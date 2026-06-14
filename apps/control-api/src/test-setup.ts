import { vi } from "vitest";
import { runMigrations } from "@workspace/db";

// There is no real Keycloak instance in the test environment — replace
// @workspace/auth's Phasetwo Organizations API client with an in-memory fake
// (keeping every other export, e.g. ORG_ROLES/verifyAccessToken, as the real
// implementation). Test files that need to mock verifyAccessToken too
// (auth.test.ts) provide their own vi.mock("@workspace/auth", ...) which must
// also spread fakeOrgsApi to keep this behaviour.
vi.mock("@workspace/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/auth")>();
  const { fakeOrgsApi } = await import("./test/keycloak-orgs-fake.js");
  const { fakeUsersApi, seedDemoKeycloakUsers } = await import("./test/keycloak-users-fake.js");
  seedDemoKeycloakUsers();
  return { ...actual, ...fakeOrgsApi, ...fakeUsersApi };
});

// Shared with the proxy middleware in app.ts (signs) and tenant-api's
// requireTenantToken (verifies) — set here so app.test.ts can mint/verify
// inter-service tokens without TENANT_JWT_SECRET being unset.
process.env["TENANT_JWT_SECRET"] ??= "test-tenant-jwt-secret";

// Redis n'est pas disponible dans l'environnement de test. Ce mock est appliqué
// globalement (avant le chargement de tout module) afin que app.ts et
// better-auth.ts reçoivent un faux client Redis au lieu de throw.
// redis.test.ts utilise vi.unmock("./redis.js") pour tester l'implémentation réelle.
vi.mock("./redis.js", () => {
  // Mini store in-memory — nécessaire car Better Auth utilise secondaryStorage
  // comme stockage primaire des sessions (pas juste un cache).
  const store = new Map<string, string>();
  const mockRedis = {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    setex: vi.fn().mockImplementation((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    del: vi.fn().mockImplementation((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    // rate-limit-redis: SCRIPT LOAD → SHA, EVALSHA → [totalHits≥1, resetMs]
    call: vi.fn().mockImplementation((cmd: string) =>
      Promise.resolve(cmd === "EVALSHA" ? [1, Date.now() + 60000] : "mockedsha")
    ),
    ping: vi.fn().mockResolvedValue("PONG"),
  };
  return {
    initRedis: vi.fn(),
    getRedis: vi.fn().mockReturnValue(mockRedis),
  };
});

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every table (model, RBAC, Better Auth, OAuth
// providers) exists. runMigrations() is idempotent — registry's startup also
// calls it, and drizzle tracks applied migrations.
await runMigrations();
