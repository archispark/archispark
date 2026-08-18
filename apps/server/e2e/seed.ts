/**
 * Runs before `next start` in start-server.sh: applies migrations (creating
 * the seeded admin/admin platform_admin account —
 * packages/db/drizzle-pg/0025_seed_local_admin.sql) and adds a second,
 * ordinary local account with its own organization.
 *
 * admin/admin (platform_admin) is a regular user for organization content
 * (see lib/archimate/access.ts): it has no workspaces unless it's a real
 * member of an organization, and this script doesn't add it to one — it
 * always reaches /platform/*, /login, /change-password and /invitations/*
 * regardless, so it's only usable for auth.spec.ts (login, the forced
 * password change, logout). Every other spec needs an ordinary "user"-role
 * account with an organization to reach workspaces/elements/relationships/
 * views/dashboards/settings at all — this script seeds exactly that account.
 * Organization membership is granted explicitly here rather than relying on
 * the first-workspace auto-provisioning that used to exist (see
 * registry.ts's resolveTargetOrganizationId — users can no longer
 * self-provision an organization).
 */
import { randomUUID } from "crypto"
import { hashPassword } from "@workspace/auth"

export const E2E_USER_USERNAME = "e2e-user"
export const E2E_USER_PASSWORD = "E2E-user-2026!"

async function main(): Promise<void> {
  const { runMigrations, db, users, getOrCreatePersonalOrganization } =
    await import("@workspace/db")
  const { eq } = await import("drizzle-orm")
  await runMigrations()

  const passwordHash = await hashPassword(E2E_USER_PASSWORD)
  const [inserted] = await db
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
    .onConflictDoNothing({ target: users.username })
    .returning({ id: users.id })

  const userId =
    inserted?.id ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, E2E_USER_USERNAME))
    )[0]!.id

  await getOrCreatePersonalOrganization(userId)
}

// fixtures.ts imports E2E_USER_USERNAME/E2E_USER_PASSWORD from this module,
// and Playwright imports fixtures.ts (transitively, via every spec file)
// just to *discover* tests — in its own process, without start-server.sh's
// env. Only run the seed when this file is executed directly (`tsx
// e2e/seed.ts`, from start-server.sh), not on every such import elsewhere.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
