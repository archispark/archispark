/**
 * Multi-workspace registry backed by PostgreSQL (Drizzle ORM).
 *
 * Every workspace is owned by exactly one user (Keycloak `sub`) — there is
 * no organization or team concept. A user only ever sees and operates on
 * their own workspaces.
 *
 * The "active workspace" is per-user (user_active_workspace).
 *
 * Demo data is loaded on demand via `pnpm seed:demo` (packages/db/seeds/demo.sql).
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { db, workspaces as wsTable, userActiveWorkspace, seedWorkspace } from "@workspace/db";
import { parseOpenExchange } from "./oxf-parser.js";
import { NotFoundError, ValidationError } from "./errors.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkspaceOut {
  id: string;       // numeric id as string for URL params
  name: string;
  description?: string | null;
  active: boolean;
  owner_id: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dbIdToStrId(id: number): string {
  return String(id);
}

function strIdToDbId(id: string): number {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid workspace id '${id}'`);
  return n;
}

function toWorkspaceOut(row: typeof wsTable.$inferSelect, activeId: number | null): WorkspaceOut {
  return {
    id: dbIdToStrId(row.id),
    name: row.name,
    description: row.description ?? null,
    active: row.id === activeId,
    owner_id: row.ownerId,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkspaces(userId: string): Promise<WorkspaceOut[]> {
  const rows = await db.select().from(wsTable).where(eq(wsTable.ownerId, userId));
  if (rows.length === 0) return [];

  const [active] = await db.select({ workspaceId: userActiveWorkspace.workspaceId }).from(userActiveWorkspace)
    .where(eq(userActiveWorkspace.userId, userId));
  const visible = rows.map((r) => r.id);
  const activeId = active && visible.includes(active.workspaceId) ? active.workspaceId : Math.min(...visible);

  return [...rows]
    .sort((a, b) => a.id - b.id)
    .map((r) => toWorkspaceOut(r, activeId));
}

/**
 * Resolve the workspace id to operate on for this request. Honours the
 * user's persisted active workspace when still owned by them, otherwise
 * falls back to their lowest-id workspace (and persists that as the new
 * active one). Throws NotFoundError if the user has no workspace.
 */
export async function getActiveWorkspaceId(userId: string): Promise<number> {
  const rows = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.ownerId, userId));
  if (rows.length === 0) throw new NotFoundError("Aucun workspace disponible.");
  const visible = rows.map((r) => r.id);

  const [active] = await db.select({ workspaceId: userActiveWorkspace.workspaceId }).from(userActiveWorkspace)
    .where(eq(userActiveWorkspace.userId, userId));
  if (active && visible.includes(active.workspaceId)) return active.workspaceId;

  const fallback = Math.min(...visible);
  await db.insert(userActiveWorkspace).values({ userId, workspaceId: fallback })
    .onConflictDoUpdate({ target: userActiveWorkspace.userId, set: { workspaceId: fallback } });
  return fallback;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function activateWorkspace(id: string, userId: string): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  const [row] = await db.select().from(wsTable).where(and(eq(wsTable.id, dbId), eq(wsTable.ownerId, userId)));
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);

  await db.insert(userActiveWorkspace).values({ userId, workspaceId: dbId })
    .onConflictDoUpdate({ target: userActiveWorkspace.userId, set: { workspaceId: dbId } });

  return toWorkspaceOut(row, dbId);
}

export async function createWorkspace(
  userId: string,
  name: string,
  xmlFilePath?: string,
  description?: string | null,
): Promise<WorkspaceOut> {
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [existing] = await db.select({ id: wsTable.id }).from(wsTable)
    .where(and(eq(wsTable.ownerId, userId), eq(wsTable.name, name)));
  if (existing) throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`);

  let model: import("./model.js").ArchiModel;

  if (xmlFilePath) {
    const fullPath = join(process.cwd(), xmlFilePath);
    if (!existsSync(fullPath)) throw new ValidationError(`Fichier XML introuvable: ${xmlFilePath}`);
    /* v8 ignore next 2 */ // valid-file path is exercised by deployment seeding, not unit tests
    const xml = readFileSync(fullPath, "utf-8");
    model = parseOpenExchange(xml);
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
    };
  }

  const dbId = await seedWorkspace(name.trim(), model, userId);
  const activeId = await getActiveWorkspaceId(userId);
  return { id: dbIdToStrId(dbId), name: name.trim(), description: model.desc ?? null, active: dbId === activeId, owner_id: userId };
}

export async function updateWorkspace(id: string, name: string, userId: string, description?: string | null): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [dup] = await db.select({ id: wsTable.id }).from(wsTable)
    .where(and(eq(wsTable.ownerId, userId), eq(wsTable.name, name)));
  if (dup && dup.id !== dbId) throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`);
  const updates: Partial<typeof wsTable.$inferInsert> = { name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) };
  if (description !== undefined) updates.description = description?.trim() || null;
  const [row] = await db.update(wsTable).set(updates)
    .where(and(eq(wsTable.id, dbId), eq(wsTable.ownerId, userId))).returning();
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);

  const activeId = await getActiveWorkspaceId(userId);
  return { id, name: name.trim(), description: row.description ?? null, active: dbId === activeId, owner_id: userId };
}

export async function deleteWorkspace(id: string, userId: string): Promise<void> {
  const dbId = strIdToDbId(id);
  const [target] = await db.select({ id: wsTable.id }).from(wsTable)
    .where(and(eq(wsTable.id, dbId), eq(wsTable.ownerId, userId)));
  if (!target) throw new ValidationError(`Workspace '${id}' introuvable.`);
  // user_active_workspace rows pointing at this workspace cascade-delete; the
  // next getActiveWorkspaceId() call falls back to another owned workspace.
  await db.delete(wsTable).where(eq(wsTable.id, dbId));
}
