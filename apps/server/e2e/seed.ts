/**
 * Runs before `next start` in start-server.sh: applies migrations (creating
 * the seeded admin/admin platform_admin account —
 * packages/db/drizzle-pg/0025_seed_local_admin.sql) and adds a second,
 * ordinary local account.
 *
 * Every real page in the app except /login, /change-password,
 * /invitations/*, and /platform/* is gated behind "has an active
 * organization" for a platform_admin session (see
 * components/client-layout.tsx's PlatformAdminBlock) — platform_admin is
 * meant to manage *other* organizations' content via
 * POST /api/platform/organizations/:id/enter, not hold workspaces of its
 * own. admin/admin is therefore only usable for auth.spec.ts (login, the
 * forced password change, logout); every other spec needs an ordinary
 * "user"-role account to reach workspaces/elements/relationships/views/
 * dashboards/settings at all — this script seeds exactly that account.
 */
import { randomUUID } from "crypto"
import { hashPassword } from "@workspace/auth"

export const E2E_USER_USERNAME = "e2e-user"
export const E2E_USER_PASSWORD = "E2E-user-2026!"

async function main(): Promise<void> {
  const { runMigrations, db, users } = await import("@workspace/db")
  await runMigrations()

  const passwordHash = await hashPassword(E2E_USER_PASSWORD)
  await db
    .insert(users)
    .values({
      id: `local:${randomUUID()}`,
      username: E2E_USER_USERNAME,
      email: "e2e-user@archispark.internal",
      passwordHash,
      displayName: "E2E User",
      role: "user",
      enabled: true,
      emailVerified: true,
    })
    .onConflictDoNothing()
}

// fixtures.ts imports E2E_USER_USERNAME/E2E_USER_PASSWORD from this module,
// and Playwright imports fixtures.ts (transitively, via every spec file)
// just to *discover* tests — in its own process, without start-server.sh's
// env. Only run the seed when this file is executed directly (`tsx
// e2e/seed.ts`, from start-server.sh), not on every such import elsewhere.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
