/**
 * Multi-workspace registry backed by PostgreSQL (Drizzle ORM).
 *
 * The API is stateless: there is no in-memory model. The active workspace is a
 * single row flag (`workspaces.is_active`) persisted in the DB, so any instance
 * resolves the same active workspace. `getActiveWorkspaceId()` reads it; data
 * access goes through `store.ts` (row-level reads/writes).
 *
 * Startup (top-level await at import):
 *   1. runMigrations() — idempotently applies pending SQL migrations.
 *   2. initUsers() — seeds RBAC roles + default users.
 *   3. Ensures exactly one workspace is active when any exist (zero is a valid
 *      state — the web UI then redirects to /workspaces).
 *
 * Demo data is loaded on demand via `pnpm seed:demo` (packages/db/seeds/demo.sql).
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db, runMigrations, workspaces as wsTable, seedWorkspace } from "@workspace/db";
import { parseOpenExchange } from "./oxf-parser.js";
import { initUsers } from "./auth.js";
import { NotFoundError, ValidationError } from "./errors.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkspaceOut {
  id: string;       // numeric id as string for URL params
  name: string;
  description?: string | null;
  active: boolean;
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

// ---------------------------------------------------------------------------
// Auto-init at module load time via top-level await
// (runs migrations + seeds from legacy files if DB is empty)
// ---------------------------------------------------------------------------

/* v8 ignore start */
async function _init(): Promise<void> {
  await runMigrations();
  await initUsers();

  // Ensure exactly one workspace is active when any exist. Zero is a valid state
  // (the user deleted them all); the web app then redirects to /workspaces.
  // Demo data is loaded on demand via `pnpm seed:demo`.
  const rows = await db.select().from(wsTable);
  if (rows.length > 0) {
    const sorted = [...rows].sort((a, b) => a.id - b.id);
    const active = sorted.find((r) => r.isActive)?.id ?? null;
    if (active == null) {
      await db.update(wsTable).set({ isActive: true }).where(eq(wsTable.id, sorted[0]!.id));
    }
  }
}

// Non-fatal: in serverless a cold start that can't reach the DB must not crash
// module load — requests then surface a clear per-request error instead of
// FUNCTION_INVOCATION_FAILED.
await _init().catch((err) => console.error("[registry] init failed:", err));
/* v8 ignore stop */

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkspaces(): Promise<WorkspaceOut[]> {
  const rows = await db.select().from(wsTable);
  return rows.map((r) => ({
    id: dbIdToStrId(r.id),
    name: r.name,
    description: r.description ?? null,
    active: r.isActive,
  }));
}

/** Numeric id of the active workspace, read from the DB (source of truth). */
export async function getActiveWorkspaceId(): Promise<number> {
  const rows = await db.select().from(wsTable);
  const active = rows.find((r) => r.isActive);
  if (active) return active.id;
  /* v8 ignore next 2 */
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  if (!sorted[0]) throw new Error("No workspaces in DB");
  /* v8 ignore next */
  return sorted[0].id;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function activateWorkspace(id: string): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  const [row] = await db.select().from(wsTable).where(eq(wsTable.id, dbId));
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);
  // Persist the active workspace in the DB (single active, shared across instances).
  await db.transaction(async (tx) => {
    await tx.update(wsTable).set({ isActive: false }).where(eq(wsTable.isActive, true));
    await tx.update(wsTable).set({ isActive: true }).where(eq(wsTable.id, dbId));
  });
  return { id, name: row.name, description: row.description ?? null, active: true };
}

export async function createWorkspace(name: string, xmlFilePath?: string, description?: string | null): Promise<WorkspaceOut> {
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [existing] = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.name, name));
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

  const dbId = await seedWorkspace(name.trim(), model);
  // When no workspace is active (e.g. the user had deleted them all), the new
  // one becomes active so the app always resolves a workspace once any exists.
  const [anyActive] = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.isActive, true));
  const active = !anyActive;
  if (active) await db.update(wsTable).set({ isActive: true }).where(eq(wsTable.id, dbId));
  return { id: dbIdToStrId(dbId), name: name.trim(), description: model.desc ?? null, active };
}

export async function updateWorkspace(id: string, name: string): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [dup] = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.name, name));
  if (dup && dup.id !== dbId) throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`);
  const [row] = await db.update(wsTable).set({ name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(wsTable.id, dbId)).returning();
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);
  return { id, name: name.trim(), description: row.description ?? null, active: row.isActive };
}

export async function deleteWorkspace(id: string): Promise<void> {
  const all = await db.select().from(wsTable);
  const dbId = strIdToDbId(id);
  const target = all.find((w) => w.id === dbId);
  if (!target) throw new ValidationError(`Workspace '${id}' introuvable.`);
  await db.delete(wsTable).where(eq(wsTable.id, dbId));

  // Deleting the active workspace promotes the lowest-id remaining one. Deleting
  // the last workspace is allowed and leaves zero — the web UI then redirects to
  // /workspaces where the user can create a new one.
  const remaining = all.filter((w) => w.id !== dbId);
  if (target.isActive && remaining.length > 0) {
    const next = [...remaining].sort((a, b) => a.id - b.id)[0]!;
    await db.update(wsTable).set({ isActive: true }).where(eq(wsTable.id, next.id));
  }
}
