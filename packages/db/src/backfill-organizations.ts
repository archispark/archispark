/**
 * Idempotent data backfill for the Organization → Workspace migration
 * (expand→backfill→verify→contract, see plan.md Phase 2). Runs automatically
 * right after `runMigrations()` at every app startup (apps/api/src/main.ts,
 * apps/api/api/index.ts) — a no-op once every workspace/token has an
 * organization. Safe to run more than once (WHERE organization_id IS NULL
 * guards every write) and safe to run concurrently across instances (the
 * `organizations.personal_owner_id` unique constraint arbitrates races).
 *
 * For every distinct user who owns a workspace or an API token without an
 * organization, this creates (or reuses) that user's personal organization
 * and attaches the orphaned rows to it.
 */

import { and, eq, isNull } from "drizzle-orm"
import { db } from "./connection.js"
import { workspaces, apiTokens } from "./schema.js"
import { getOrCreatePersonalOrganization } from "./organizations.js"

export async function runOrganizationBackfill(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).transaction(async (tx: any) => {
    let workspacesBackfilled = 0
    let tokensBackfilled = 0
    const organizationsTouched = new Set<number>()

    const orphanWorkspaceUsers = await tx
      .selectDistinct({ userId: workspaces.createdById })
      .from(workspaces)
      .where(isNull(workspaces.organizationId))

    for (const { userId } of orphanWorkspaceUsers) {
      const orgId = await getOrCreatePersonalOrganization(userId, tx)
      organizationsTouched.add(orgId)
      const updated = await tx
        .update(workspaces)
        .set({ organizationId: orgId })
        .where(
          and(
            eq(workspaces.createdById, userId),
            isNull(workspaces.organizationId)
          )
        )
        .returning({ id: workspaces.id })
      workspacesBackfilled += updated.length
    }

    const orphanTokenUsers = await tx
      .selectDistinct({ userId: apiTokens.userId })
      .from(apiTokens)
      .where(isNull(apiTokens.organizationId))

    for (const { userId } of orphanTokenUsers) {
      const orgId = await getOrCreatePersonalOrganization(userId, tx)
      organizationsTouched.add(orgId)
      const updated = await tx
        .update(apiTokens)
        .set({ organizationId: orgId })
        .where(
          and(eq(apiTokens.userId, userId), isNull(apiTokens.organizationId))
        )
        .returning({ id: apiTokens.id })
      tokensBackfilled += updated.length
    }

    if (workspacesBackfilled > 0 || tokensBackfilled > 0) {
      console.log(
        `[backfill-organizations] ${workspacesBackfilled} workspace(s), ${tokensBackfilled} token(s) ` +
          `attached to ${organizationsTouched.size} personal organization(s).`
      )
    }
  })
}
