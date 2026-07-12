/**
 * platform_admin-only organization administration — metadata only, never
 * organization content (no join into workspaces/elements/etc.). Mounted
 * behind requireSuperAdmin in app.ts; access.ts's per-org gate is not used
 * here since these routes are role-gated once, globally, at the middleware
 * level rather than per-organization.
 */

import { asc, eq } from "drizzle-orm"
import { db, organizations } from "@workspace/db"
import { NotFoundError } from "./errors.js"

export interface PlatformOrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  created_at: number
}

function toPlatformOrgOut(
  org: typeof organizations.$inferSelect
): PlatformOrganizationOut {
  return {
    id: String(org.id),
    slug: org.slug,
    name: org.name,
    is_personal: org.isPersonal,
    enabled: org.enabled,
    created_at: org.createdAt,
  }
}

export async function listAllOrganizations(): Promise<
  PlatformOrganizationOut[]
> {
  const rows = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.id))
  return rows.map(toPlatformOrgOut)
}

export async function setOrganizationEnabled(
  organizationId: number,
  enabled: boolean
): Promise<PlatformOrganizationOut> {
  const [org] = await db
    .update(organizations)
    .set({ enabled, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(organizations.id, organizationId))
    .returning()
  if (!org) throw new NotFoundError("Organisation introuvable.")
  return toPlatformOrgOut(org)
}

export async function deleteOrganizationAsPlatformAdmin(
  organizationId: number
): Promise<void> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")
  await db.delete(organizations).where(eq(organizations.id, organizationId))
}
