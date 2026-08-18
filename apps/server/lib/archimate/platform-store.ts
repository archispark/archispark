/**
 * platform_admin-only organization administration — metadata only, never
 * organization content (no join into workspaces/elements/etc.). Mounted
 * behind requireSuperAdmin in app.ts; access.ts's per-org gate is not used
 * here since these routes are role-gated once, globally, at the middleware
 * level rather than per-organization.
 */

import { randomUUID } from "crypto"
import { asc, eq } from "drizzle-orm"
import { db, organizations } from "@workspace/db"
import { NotFoundError } from "./errors"
import { listOrganizationMembers } from "./platform-organization-members-store"

const UNIQUE_VIOLATION = "23505"

// Drizzle wraps the raw pg error in a DrizzleQueryError, with the pg error
// (and its `.code`) as `.cause` — check both shapes.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export interface PlatformOrganizationOut {
  id: string
  slug: string
  name: string
  description: string | null
  is_personal: boolean
  enabled: boolean
  created_at: number
}

export interface PlatformOrganizationDetailOut extends PlatformOrganizationOut {
  members: Awaited<ReturnType<typeof listOrganizationMembers>>
}

export function toPlatformOrgOut(
  org: typeof organizations.$inferSelect
): PlatformOrganizationOut {
  return {
    id: String(org.id),
    slug: org.slug,
    name: org.name,
    description: org.description,
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

export interface PlatformOrganizationCreateIn {
  name: string
  description?: string | null
}

/**
 * Creates a "team" organization from the admin console — the only way a new
 * organization comes into existence. Users can no longer self-provision one
 * (see registry.ts's resolveTargetOrganizationId): membership must be
 * granted explicitly by an owner/editor or by a platform_admin adding
 * themselves from here. Retries with a random suffix on a slug collision
 * rather than rejecting the request: the slug is derived from the name but
 * never shown to the admin, so surfacing a collision as a validation error
 * would be confusing.
 */
export async function createOrganization(
  input: PlatformOrganizationCreateIn
): Promise<PlatformOrganizationOut> {
  const base = slugify(input.name) || "organisation"
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`
    try {
      const [org] = await db
        .insert(organizations)
        .values({
          slug,
          name: input.name,
          description: input.description ?? null,
        })
        .returning()
      return toPlatformOrgOut(org!)
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 4) throw err
    }
  }
  throw new Error("Impossible de créer l'organisation.")
}

export async function getPlatformOrganization(
  organizationId: number
): Promise<PlatformOrganizationDetailOut> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!org) throw new NotFoundError("Organisation introuvable.")

  return {
    ...toPlatformOrgOut(org),
    members: await listOrganizationMembers(organizationId),
  }
}

export interface PlatformOrganizationUpdateIn {
  enabled?: boolean
  name?: string
  description?: string | null
}

export async function updatePlatformOrganization(
  organizationId: number,
  changes: PlatformOrganizationUpdateIn
): Promise<PlatformOrganizationOut> {
  const [target] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
  if (!target) throw new NotFoundError("Organisation introuvable.")

  const [org] = await db
    .update(organizations)
    .set({
      enabled: changes.enabled ?? target.enabled,
      name: changes.name ?? target.name,
      description:
        changes.description !== undefined
          ? changes.description
          : target.description,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(organizations.id, organizationId))
    .returning()
  return toPlatformOrgOut(org!)
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
