/**
 * Shared organization helpers used by both the startup backfill
 * (backfill-organizations.ts) and the app-level "auto-create a personal
 * organization on first workspace" invariant (apps/api/src/organizations-store.ts).
 * Keeping this in @workspace/db avoids duplicating the idempotent
 * get-or-create logic between the two call sites.
 */

import { eq } from "drizzle-orm"
import { db as defaultDb } from "./connection.js"
import { organizations, organizationMembers } from "./schema.js"

// `any` matches the rest of the codebase's transaction-callback convention
// (see model-io.ts) — a Drizzle transaction handle (`tx`) is structurally
// compatible with `db` but has a distinct generated type per call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Returns the id of `userId`'s personal organization, creating it (with an
 * `owner` membership) if it doesn't exist yet. Idempotent under concurrency:
 * `organizations.personal_owner_id` is unique, so a racing insert loses the
 * `ON CONFLICT DO NOTHING` and both callers converge on the same org id.
 */
export async function getOrCreatePersonalOrganization(
  userId: string,
  database: Db = defaultDb
): Promise<number> {
  const [existing] = await database
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.personalOwnerId, userId))
  if (existing) return existing.id

  const slug = `perso-${slugify(userId)}`
  const [inserted] = await database
    .insert(organizations)
    .values({
      slug,
      name: "Organisation personnelle",
      isPersonal: true,
      personalOwnerId: userId,
    })
    .onConflictDoNothing({ target: organizations.personalOwnerId })
    .returning({ id: organizations.id })

  const orgId =
    inserted?.id ??
    (
      await database
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.personalOwnerId, userId))
    )[0]?.id
  if (orgId === undefined)
    throw new Error(
      `Failed to create or find personal organization for user ${userId}`
    )

  await database
    .insert(organizationMembers)
    .values({ organizationId: orgId, userId, role: "owner" })
    .onConflictDoNothing({
      target: [organizationMembers.organizationId, organizationMembers.userId],
    })

  return orgId
}
