/**
 * Workspace registry backed by PostgreSQL (Drizzle ORM).
 *
 * Every workspace belongs to exactly one organization (see access.ts for the
 * authorization gateway) — all members of that organization can see it,
 * subject to their role (owner/admin: read+write, member: read-only).
 * `createdById` is traceability only, never used for access control.
 *
 * The "active workspace" is per-user, per-organization (user_active_workspace).
 *
 * Demo data is loaded on demand via `pnpm seed:demo` (packages/db/seeds/demo.sql).
 */

import { readFileSync, existsSync } from "fs"
import { randomUUID } from "crypto"
import { join } from "path"
import { and, eq } from "drizzle-orm"
import {
  db,
  workspaces as wsTable,
  userActiveOrganization,
  userActiveWorkspace,
  organizationMembers,
  seedWorkspace,
  getOrCreatePersonalOrganization,
} from "@workspace/db"
import { parseOpenExchange } from "./oxf-parser.js"
import { NotFoundError, ValidationError } from "./errors.js"
import {
  assertOrgAccess,
  assertWorkspaceAccess,
  resolveActiveOrganization,
  type AccessUser,
} from "./access.js"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkspaceOut {
  id: string // numeric id as string for URL params
  name: string
  description?: string | null
  active: boolean
  organization_id: string
  created_by_id: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dbIdToStrId(id: number): string {
  return String(id)
}

function strIdToDbId(id: string): number {
  const n = parseInt(id, 10)
  if (!Number.isFinite(n)) throw new Error(`Invalid workspace id '${id}'`)
  return n
}

function toWorkspaceOut(
  row: typeof wsTable.$inferSelect,
  activeId: number | null
): WorkspaceOut {
  return {
    id: dbIdToStrId(row.id),
    name: row.name,
    description: row.description ?? null,
    active: row.id === activeId,
    organization_id: String(row.organizationId),
    created_by_id: row.createdById,
  }
}

/** The organization a new workspace should land in when the caller doesn't pin one explicitly. */
async function resolveTargetOrganizationId(user: AccessUser): Promise<number> {
  const [membership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
  if (!membership) return getOrCreatePersonalOrganization(user.id)
  const { organizationId } = await resolveActiveOrganization(user, "write")
  return organizationId
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkspaces(user: AccessUser): Promise<WorkspaceOut[]> {
  // A brand new user with no organization yet (no workspace created, no
  // personal org auto-provisioned — see Phase 4 invariant) simply has no
  // workspaces to list, same as the pre-organization behaviour.
  let organizationId: number
  try {
    ;({ organizationId } = await resolveActiveOrganization(user, "read"))
  } catch (err) {
    if (err instanceof NotFoundError) return []
    throw err
  }
  const rows = await db
    .select()
    .from(wsTable)
    .where(eq(wsTable.organizationId, organizationId))
  if (rows.length === 0) return []

  const [active] = await db
    .select({ workspaceId: userActiveWorkspace.workspaceId })
    .from(userActiveWorkspace)
    .where(
      and(
        eq(userActiveWorkspace.userId, user.id),
        eq(userActiveWorkspace.organizationId, organizationId)
      )
    )
  const visible = rows.map((r) => r.id)
  const activeId =
    active && visible.includes(active.workspaceId)
      ? active.workspaceId
      : Math.min(...visible)

  return [...rows]
    .sort((a, b) => a.id - b.id)
    .map((r) => toWorkspaceOut(r, activeId))
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function activateWorkspace(
  user: AccessUser,
  id: string
): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id)
  const { organizationId } = await assertWorkspaceAccess(user, dbId, "read")
  const [row] = await db.select().from(wsTable).where(eq(wsTable.id, dbId))
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`)

  await db
    .insert(userActiveOrganization)
    .values({ userId: user.id, organizationId })
    .onConflictDoUpdate({
      target: userActiveOrganization.userId,
      set: { organizationId },
    })
  await db
    .insert(userActiveWorkspace)
    .values({ userId: user.id, organizationId, workspaceId: dbId })
    .onConflictDoUpdate({
      target: [userActiveWorkspace.userId, userActiveWorkspace.organizationId],
      set: { workspaceId: dbId },
    })

  return toWorkspaceOut(row, dbId)
}

export async function createWorkspace(
  user: AccessUser,
  name: string,
  xmlFilePath?: string,
  description?: string | null,
  organizationId?: number
): Promise<WorkspaceOut> {
  if (!name?.trim())
    throw new ValidationError("Le nom du workspace est requis.")

  let orgId: number
  if (organizationId !== undefined) {
    await assertOrgAccess(user, organizationId, "write")
    orgId = organizationId
  } else {
    orgId = await resolveTargetOrganizationId(user)
  }

  const [existing] = await db
    .select({ id: wsTable.id })
    .from(wsTable)
    .where(and(eq(wsTable.organizationId, orgId), eq(wsTable.name, name)))
  if (existing)
    throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`)

  let model: import("./model.js").ArchiModel

  if (xmlFilePath) {
    const fullPath = join(process.cwd(), xmlFilePath)
    if (!existsSync(fullPath))
      throw new ValidationError(`Fichier XML introuvable: ${xmlFilePath}`)
    /* v8 ignore next 2 */ // valid-file path is exercised by deployment seeding, not unit tests
    const xml = readFileSync(fullPath, "utf-8")
    model = parseOpenExchange(xml)
  } else {
    model = {
      uuid: `id-${randomUUID()}`,
      name: name.trim(),
      desc: description?.trim() || null,
      version: null,
      elements: [],
      relationships: [],
      propertyDefinitions: [],
      views: [],
    }
  }

  const dbId = await seedWorkspace(name.trim(), model, user.id, orgId)
  await db
    .insert(userActiveOrganization)
    .values({ userId: user.id, organizationId: orgId })
    .onConflictDoUpdate({
      target: userActiveOrganization.userId,
      set: { organizationId: orgId },
    })
  await db
    .insert(userActiveWorkspace)
    .values({ userId: user.id, organizationId: orgId, workspaceId: dbId })
    .onConflictDoUpdate({
      target: [userActiveWorkspace.userId, userActiveWorkspace.organizationId],
      set: { workspaceId: dbId },
    })

  return {
    id: dbIdToStrId(dbId),
    name: name.trim(),
    description: model.desc ?? null,
    active: true,
    organization_id: String(orgId),
    created_by_id: user.id,
  }
}

export async function updateWorkspace(
  user: AccessUser,
  id: string,
  name: string,
  description?: string | null
): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id)
  if (!name?.trim())
    throw new ValidationError("Le nom du workspace est requis.")
  const { organizationId } = await assertWorkspaceAccess(user, dbId, "write")

  const [dup] = await db
    .select({ id: wsTable.id })
    .from(wsTable)
    .where(
      and(eq(wsTable.organizationId, organizationId), eq(wsTable.name, name))
    )
  if (dup && dup.id !== dbId)
    throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`)

  const updates: Partial<typeof wsTable.$inferInsert> = {
    name: name.trim(),
    updatedAt: Math.floor(Date.now() / 1000),
  }
  if (description !== undefined)
    updates.description = description?.trim() || null
  const [row] = await db
    .update(wsTable)
    .set(updates)
    .where(eq(wsTable.id, dbId))
    .returning()
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`)

  const [active] = await db
    .select({ workspaceId: userActiveWorkspace.workspaceId })
    .from(userActiveWorkspace)
    .where(
      and(
        eq(userActiveWorkspace.userId, user.id),
        eq(userActiveWorkspace.organizationId, organizationId)
      )
    )
  return toWorkspaceOut(row, active?.workspaceId ?? null)
}

export async function deleteWorkspace(
  user: AccessUser,
  id: string
): Promise<void> {
  const dbId = strIdToDbId(id)
  // Phase 4 invariant: deleting a workspace requires owner or admin — the
  // same "write" intent already used for mutations.
  await assertWorkspaceAccess(user, dbId, "write")
  await db.delete(wsTable).where(eq(wsTable.id, dbId))
}
