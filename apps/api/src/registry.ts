/**
 * Multi-workspace registry backed by PostgreSQL (Drizzle ORM).
 *
 * Workspaces belong to an organization and may optionally be restricted to
 * one or more teams within that organization (workspace_teams). Without a
 * team restriction, a workspace is visible to every member of the
 * organization. Organization owners/admins always see every workspace in
 * their organization.
 *
 * The "active workspace" is now per-user (user_active_workspace), keyed by
 * (userId, organizationId) — different users in the same organization can
 * work on different workspaces at the same time.
 *
 * Startup (top-level await at import):
 *   1. runMigrations() — idempotently applies pending SQL migrations.
 *   2. initUsers() — seeds default users + a default organization.
 *
 * Demo data is loaded on demand via `pnpm seed:demo` (packages/db/seeds/demo.sql).
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { and, eq, inArray } from "drizzle-orm";
import { db, runMigrations, workspaces as wsTable, workspaceTeams, userActiveWorkspace, seedWorkspace } from "@workspace/db";
import { parseOpenExchange } from "./oxf-parser.js";
import { initUsers } from "./auth.js";
import type { WorkspaceContext } from "./auth.js";
import { NotFoundError, ValidationError } from "./errors.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkspaceOut {
  id: string;       // numeric id as string for URL params
  name: string;
  description?: string | null;
  active: boolean;
  organization_id: string;
  team_ids: string[];
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

/** Workspace ids in `organizationId` visible to a member with `teamIds`/`orgRole`. */
async function getVisibleWorkspaceIds(organizationId: string, teamIds: string[], orgRole: string): Promise<number[]> {
  const rows = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.organizationId, organizationId));
  if (rows.length === 0) return [];
  if (orgRole === "owner" || orgRole === "admin") return rows.map((r) => r.id);

  const restricted = await db.select({ workspaceId: workspaceTeams.workspaceId, teamId: workspaceTeams.teamId })
    .from(workspaceTeams).where(inArray(workspaceTeams.workspaceId, rows.map((r) => r.id)));
  const restrictedIds = new Set(restricted.map((r) => r.workspaceId));
  const allowedRestrictedIds = new Set(restricted.filter((r) => teamIds.includes(r.teamId)).map((r) => r.workspaceId));
  return rows.filter((r) => !restrictedIds.has(r.id) || allowedRestrictedIds.has(r.id)).map((r) => r.id);
}

async function getTeamIdsForWorkspaces(workspaceIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (workspaceIds.length === 0) return map;
  const rows = await db.select().from(workspaceTeams).where(inArray(workspaceTeams.workspaceId, workspaceIds));
  for (const r of rows) {
    const list = map.get(r.workspaceId);
    if (list) list.push(r.teamId); else map.set(r.workspaceId, [r.teamId]);
  }
  return map;
}

function toWorkspaceOut(row: typeof wsTable.$inferSelect, activeId: number | null, teamIds: string[]): WorkspaceOut {
  return {
    id: dbIdToStrId(row.id),
    name: row.name,
    description: row.description ?? null,
    active: row.id === activeId,
    organization_id: row.organizationId,
    team_ids: teamIds,
  };
}

// ---------------------------------------------------------------------------
// Auto-init at module load time via top-level await
// (runs migrations + seeds default users/organization if DB is empty)
// ---------------------------------------------------------------------------

/* v8 ignore start */
async function _init(): Promise<void> {
  await runMigrations();
  await initUsers();
}

// Non-fatal: in serverless a cold start that can't reach the DB must not crash
// module load — requests then surface a clear per-request error instead of
// FUNCTION_INVOCATION_FAILED.
await _init().catch((err) => console.error("[registry] init failed:", err));
/* v8 ignore stop */

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkspaces(ctx: WorkspaceContext, userId: string): Promise<WorkspaceOut[]> {
  const visible = await getVisibleWorkspaceIds(ctx.organizationId, ctx.teamIds, ctx.orgRole);
  if (visible.length === 0) return [];

  const rows = await db.select().from(wsTable).where(inArray(wsTable.id, visible));
  const [active] = await db.select({ workspaceId: userActiveWorkspace.workspaceId }).from(userActiveWorkspace)
    .where(and(eq(userActiveWorkspace.userId, userId), eq(userActiveWorkspace.organizationId, ctx.organizationId)));
  const activeId = active && visible.includes(active.workspaceId) ? active.workspaceId : Math.min(...visible);

  const teamMap = await getTeamIdsForWorkspaces(visible);
  return [...rows]
    .sort((a, b) => a.id - b.id)
    .map((r) => toWorkspaceOut(r, activeId, teamMap.get(r.id) ?? []));
}

/**
 * Resolve the workspace id to operate on for this request. Honours the
 * user's persisted active workspace when still visible, otherwise falls back
 * to the lowest-id visible workspace (and persists that as the new active
 * one). Throws NotFoundError if the organization has no visible workspaces.
 */
export async function getActiveWorkspaceId(ctx: WorkspaceContext, userId: string): Promise<number> {
  const visible = await getVisibleWorkspaceIds(ctx.organizationId, ctx.teamIds, ctx.orgRole);
  if (visible.length === 0) throw new NotFoundError("Aucun workspace disponible pour cette organisation.");

  const [active] = await db.select({ workspaceId: userActiveWorkspace.workspaceId }).from(userActiveWorkspace)
    .where(and(eq(userActiveWorkspace.userId, userId), eq(userActiveWorkspace.organizationId, ctx.organizationId)));
  if (active && visible.includes(active.workspaceId)) return active.workspaceId;

  const fallback = Math.min(...visible);
  await db.insert(userActiveWorkspace).values({ userId, organizationId: ctx.organizationId, workspaceId: fallback })
    .onConflictDoUpdate({ target: [userActiveWorkspace.userId, userActiveWorkspace.organizationId], set: { workspaceId: fallback } });
  return fallback;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function activateWorkspace(id: string, ctx: WorkspaceContext, userId: string): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  const [row] = await db.select().from(wsTable).where(and(eq(wsTable.id, dbId), eq(wsTable.organizationId, ctx.organizationId)));
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);
  const visible = await getVisibleWorkspaceIds(ctx.organizationId, ctx.teamIds, ctx.orgRole);
  if (!visible.includes(dbId)) throw new NotFoundError(`Workspace '${id}' introuvable.`);

  await db.insert(userActiveWorkspace).values({ userId, organizationId: ctx.organizationId, workspaceId: dbId })
    .onConflictDoUpdate({ target: [userActiveWorkspace.userId, userActiveWorkspace.organizationId], set: { workspaceId: dbId } });

  const teamMap = await getTeamIdsForWorkspaces([dbId]);
  return toWorkspaceOut(row, dbId, teamMap.get(dbId) ?? []);
}

export async function createWorkspace(
  ctx: WorkspaceContext,
  userId: string,
  name: string,
  xmlFilePath?: string,
  description?: string | null,
  teamIds: string[] = [],
): Promise<WorkspaceOut> {
  const organizationId = ctx.organizationId;
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [existing] = await db.select({ id: wsTable.id }).from(wsTable)
    .where(and(eq(wsTable.organizationId, organizationId), eq(wsTable.name, name)));
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

  const dbId = await seedWorkspace(name.trim(), model, organizationId);
  if (teamIds.length > 0) {
    await db.insert(workspaceTeams).values(teamIds.map((teamId) => ({ workspaceId: dbId, teamId })));
  }
  const activeId = await getActiveWorkspaceId(ctx, userId);
  return { id: dbIdToStrId(dbId), name: name.trim(), description: model.desc ?? null, active: dbId === activeId, organization_id: organizationId, team_ids: teamIds };
}

export async function updateWorkspace(id: string, name: string, ctx: WorkspaceContext, userId: string, teamIds?: string[]): Promise<WorkspaceOut> {
  const organizationId = ctx.organizationId;
  const dbId = strIdToDbId(id);
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [dup] = await db.select({ id: wsTable.id }).from(wsTable)
    .where(and(eq(wsTable.organizationId, organizationId), eq(wsTable.name, name)));
  if (dup && dup.id !== dbId) throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`);
  const [row] = await db.update(wsTable).set({ name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(wsTable.id, dbId), eq(wsTable.organizationId, organizationId))).returning();
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);

  if (teamIds !== undefined) {
    await db.delete(workspaceTeams).where(eq(workspaceTeams.workspaceId, dbId));
    if (teamIds.length > 0) await db.insert(workspaceTeams).values(teamIds.map((teamId) => ({ workspaceId: dbId, teamId })));
  }
  const teamMap = await getTeamIdsForWorkspaces([dbId]);
  const activeId = await getActiveWorkspaceId(ctx, userId);
  return { id, name: name.trim(), description: row.description ?? null, active: dbId === activeId, organization_id: organizationId, team_ids: teamMap.get(dbId) ?? [] };
}

export async function deleteWorkspace(id: string, organizationId: string): Promise<void> {
  const dbId = strIdToDbId(id);
  const [target] = await db.select({ id: wsTable.id }).from(wsTable)
    .where(and(eq(wsTable.id, dbId), eq(wsTable.organizationId, organizationId)));
  if (!target) throw new ValidationError(`Workspace '${id}' introuvable.`);
  // user_active_workspace rows pointing at this workspace cascade-delete; the
  // next getActiveWorkspaceId() call falls back to another visible workspace.
  await db.delete(wsTable).where(eq(wsTable.id, dbId));
}
