/**
 * platform_admin "admin mode" — choosing which organization's content-facing
 * routes (elements, workspaces, dashboards, member management, ...) resolve
 * to, via the same active-organization pointer used by regular members (see
 * access.ts). Distinct from platform-store.ts, which only ever touches
 * organization metadata.
 */

import { eq } from "drizzle-orm"
import { db, organizations } from "@workspace/db"
import { NotFoundError } from "./errors"
import {
  assertOrgAccess,
  resolveActivePlatformOrganizationId,
  setActivePlatformOrganization,
  clearActivePlatformOrganization,
  type AccessUser,
} from "./access"
import { toPlatformOrgOut, type PlatformOrganizationOut } from "./platform-store"

/** "Enters" `organizationId` for `user` (a platform_admin) — see access.ts's setActivePlatformOrganization. */
export async function enterOrganizationAsPlatformAdmin(
  user: AccessUser,
  organizationId: number
): Promise<PlatformOrganizationOut> {
  await assertOrgAccess(user, organizationId, "read") // 404 if the org doesn't exist
  await setActivePlatformOrganization(user.id, organizationId)
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")
  return toPlatformOrgOut(org)
}

/** The organization `userId` (a platform_admin) is currently administering, or null if none. */
export async function getActivePlatformOrganization(
  userId: string
): Promise<PlatformOrganizationOut | null> {
  let organizationId: number
  try {
    organizationId = await resolveActivePlatformOrganizationId(userId)
  } catch {
    return null
  }
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  return org ? toPlatformOrgOut(org) : null
}

/** Clears `userId`'s (a platform_admin) administered-organization pointer ("exit"). */
export async function exitPlatformOrganization(userId: string): Promise<void> {
  await clearActivePlatformOrganization(userId)
}
