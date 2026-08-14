import { defineConfig, devices } from "@playwright/test"

// A "local account" e2e suite: no Keycloak required. e2e/start-server.sh
// (this config's webServer.command) starts a throwaway Postgres container,
// waits for it, seeds accounts (e2e/seed.ts — runs migrations, which also
// auto-creates the built-in admin/admin platform_admin account, see
// packages/db/drizzle-pg/0025_seed_local_admin.sql), then launches
// `next start`.
//
// Not DB_CLIENT=pglite: that works for Vitest, which is single-process, but
// Next.js's production build splits routes into separate bundles that each
// open their own in-memory PGlite instance, so only the bundle that happens
// to run instrumentation.ts's runMigrations() ends up with a schema —
// every other route hits "relation ... does not exist".
//
// Two accounts, two purposes: admin/admin (platform_admin) only exercises
// auth.spec.ts's login/forced-password-change/logout flow — it has no
// organization of its own, so components/client-layout.tsx's
// PlatformAdminBlock gates it out of every other page. Every other spec
// logs in as e2e-user (an ordinary "user"-role account, fixtures.ts) to
// actually reach workspaces/elements/relationships/views/dashboards/
// settings.
//
// Multi-role (owner/editor/viewer), invitations, and platform-admin-mode
// (entering another organization) scenarios need Keycloak-backed accounts
// sharing an organization, which local accounts can't do
// (packages/auth/src/admin-users.ts resolves members via the Keycloak
// Admin API, not the local `users` table) — out of scope for this suite.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // A single e2e-user account and a single shared Postgres for all
  // non-auth specs: concurrent workers creating workspaces on the same
  // account would interfere with each other. Revisit once a second suite
  // adds more accounts.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["html", { open: "never" }], ["github"]]
    : "list",
  use: {
    baseURL: "http://localhost:8000",
    trace: "on-first-retry",
  },
  projects: [
    // auth.spec.ts is the only spec touching the admin/admin account (see
    // the file-top comment); every other spec uses the unrelated e2e-user
    // account, so this ordering isn't required for correctness — kept for
    // grouping (auth-only output first) and so a future admin-touching spec
    // added to "chromium" doesn't need to rediscover this.
    {
      name: "auth-setup",
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /auth\.spec\.ts/,
      dependencies: ["auth-setup"],
    },
  ],
  webServer: {
    command: "./e2e/start-server.sh",
    url: "http://localhost:8000/api/health",
    // Always fresh, never reused: the throwaway Postgres container this
    // starts (see start-server.sh) is specific to one run, so leaving it
    // running between invocations (Playwright's default local behavior for
    // `reuseExistingServer: true`) would strand it — a subsequent run
    // would then remove it out from under the still-running server it's
    // "reusing". A clean boot costs a few seconds; correctness doesn't.
    reuseExistingServer: false,
    timeout: 60000,
  },
})
