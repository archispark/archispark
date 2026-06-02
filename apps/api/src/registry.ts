/**
 * Multi-workspace registry backed by PostgreSQL (Drizzle ORM).
 *
 * Architecture:
 *   - Workspaces listed in the `workspaces` DB table (replaces workspaces.json).
 *   - Each workspace stores its ArchiMate model in normalized tables.
 *   - At runtime the active workspace model is held in-memory (DataSource).
 *   - `saveDataSource(ds)` flushes the in-memory model back to DB.
 *   - `activateWorkspace(id)` switches the active workspace and loads its model.
 *   - The exported `dataSource` is a live ESM binding — all importers see the
 *     new value after activateWorkspace() without any route changes.
 *
 * Startup (called from main.ts):
 *   1. runMigrations() — idempotently applies pending SQL migrations.
 *   2. initRegistry() — seeds workspaces.json / XML files if DB is empty,
 *      then loads the first workspace into memory.
 */

import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db, runMigrations, workspaces as wsTable, modelFromDb, modelToDb, seedWorkspace } from "@workspace/db";
import { parseOpenExchange } from "./oxf-parser.js";
import { initUsers } from "./auth.js";
import { NotFoundError, ValidationError } from "./errors.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkspaceOut {
  id: string;       // numeric id as string for URL params
  name: string;
  active: boolean;
}

export interface DataSource {
  readonly workspaceDbId: number;
  readonly path: string;           // kept for backward compat (empty for DB-backed workspaces)
  readonly model: import("./model.js").ArchiModel;
  elementTypes: string[];
  relationshipTypes: string[];
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

let _activeId: number;
const _loaded = new Map<number, DataSource>();

// Live ESM binding — reassigned by activateWorkspace()
export let dataSource: DataSource;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function buildRuntimeDs(dbId: number): Promise<DataSource> {
  const model = await modelFromDb(dbId);
  return {
    workspaceDbId: dbId,
    path: "",
    model,
    elementTypes: [...new Set(model.elements.map((e) => e.type).filter(Boolean))].sort(),
    relationshipTypes: [...new Set(model.relationships.map((r) => r.type).filter(Boolean))].sort(),
  };
}

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

async function _init(): Promise<void> {
  await runMigrations();
  await initUsers();

  const rows = await db.select({ id: wsTable.id }).from(wsTable);
  if (rows.length === 0) {
    await _seedFromLegacy();
    const afterSeed = await db.select({ id: wsTable.id }).from(wsTable);
    if (afterSeed.length === 0) {
      await seedWorkspace("Default", { uuid: randomUUID(), name: "Default", desc: null, version: null, elements: [], relationships: [], propertyDefinitions: [], views: [] });
    }
  }

  const finalRows = await db.select().from(wsTable);
  if (finalRows.length === 0) throw new Error("No workspaces in DB after init");
  const sorted = [...finalRows].sort((a, b) => a.id - b.id);

  // Ensure exactly one workspace is active (persisted in DB → shared across instances).
  let active = sorted.find((r) => r.isActive)?.id ?? null;
  if (active == null) {
    active = sorted[0]!.id;
    await db.update(wsTable).set({ isActive: true }).where(eq(wsTable.id, active));
  }
  _activeId = active;
  const ds = await buildRuntimeDs(_activeId);
  _loaded.set(_activeId, ds);
  dataSource = ds;
}

await _init();

async function _seedFromLegacy(): Promise<void> {
  const wsFile = join(process.cwd(), "workspaces.json");
  const cfgFile = join(process.cwd(), "config.json");

  if (existsSync(wsFile)) {
    const entries = JSON.parse(readFileSync(wsFile, "utf-8")) as Array<{ id: string; name: string; path: string }>;
    for (const entry of entries) {
      const xmlPath = join(process.cwd(), entry.path);
      if (existsSync(xmlPath)) {
        const xml = readFileSync(xmlPath, "utf-8");
        const model = parseOpenExchange(xml);
        await seedWorkspace(entry.name, model);
      }
    }
  } else if (existsSync(cfgFile)) {
    const cfg = JSON.parse(readFileSync(cfgFile, "utf-8")) as { path: string; name: string };
    const xmlPath = join(process.cwd(), cfg.path);
    if (existsSync(xmlPath)) {
      const xml = readFileSync(xmlPath, "utf-8");
      const model = parseOpenExchange(xml);
      await seedWorkspace(cfg.name, model);
    }
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkspaces(): Promise<WorkspaceOut[]> {
  const rows = await db.select().from(wsTable);
  return rows.map((r) => ({
    id: dbIdToStrId(r.id),
    name: r.name,
    active: r.isActive,
  }));
}

/** Numeric id of the active workspace, read from the DB (source of truth). */
export async function getActiveWorkspaceId(): Promise<number> {
  const rows = await db.select().from(wsTable);
  const active = rows.find((r) => r.isActive);
  if (active) return active.id;
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  if (!sorted[0]) throw new Error("No workspaces in DB");
  return sorted[0].id;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function activateWorkspace(id: string): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  const [row] = await db.select().from(wsTable).where(eq(wsTable.id, dbId));
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);
  if (!_loaded.has(dbId)) {
    _loaded.set(dbId, await buildRuntimeDs(dbId));
  }
  // Persist the active workspace in the DB (single active, shared across instances).
  await db.transaction(async (tx) => {
    await tx.update(wsTable).set({ isActive: false }).where(eq(wsTable.isActive, true));
    await tx.update(wsTable).set({ isActive: true }).where(eq(wsTable.id, dbId));
  });
  _activeId = dbId;
  dataSource = _loaded.get(dbId)!;
  return { id, name: row.name, active: true };
}

export async function createWorkspace(name: string, xmlFilePath?: string): Promise<WorkspaceOut> {
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [existing] = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.name, name));
  if (existing) throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`);

  let model: import("./model.js").ArchiModel;

  if (xmlFilePath) {
    const fullPath = join(process.cwd(), xmlFilePath);
    if (!existsSync(fullPath)) throw new ValidationError(`Fichier XML introuvable: ${xmlFilePath}`);
    const xml = readFileSync(fullPath, "utf-8");
    model = parseOpenExchange(xml);
  } else {
    model = {
      uuid: `id-${randomUUID()}`,
      name: name.trim(),
      desc: null,
      version: null,
      elements: [],
      relationships: [],
      propertyDefinitions: [],
      views: [],
    };
  }

  const dbId = await seedWorkspace(name.trim(), model);
  const ds = await buildRuntimeDs(dbId);
  _loaded.set(dbId, ds);
  return { id: dbIdToStrId(dbId), name: name.trim(), active: false };
}

export async function updateWorkspace(id: string, name: string): Promise<WorkspaceOut> {
  const dbId = strIdToDbId(id);
  if (!name?.trim()) throw new ValidationError("Le nom du workspace est requis.");
  const [dup] = await db.select({ id: wsTable.id }).from(wsTable).where(eq(wsTable.name, name));
  if (dup && dup.id !== dbId) throw new ValidationError(`Un workspace nommé '${name}' existe déjà.`);
  const [row] = await db.update(wsTable).set({ name: name.trim(), updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(wsTable.id, dbId)).returning();
  if (!row) throw new NotFoundError(`Workspace '${id}' introuvable.`);
  const ds = _loaded.get(dbId);
  if (ds) ds.model.name = name.trim();
  return { id, name: name.trim(), active: dbId === _activeId };
}

export async function deleteWorkspace(id: string): Promise<void> {
  const all = await db.select({ id: wsTable.id }).from(wsTable);
  if (all.length <= 1) throw new ValidationError("Impossible de supprimer le dernier workspace.");
  const dbId = strIdToDbId(id);
  if (dbId === _activeId) throw new ValidationError("Impossible de supprimer le workspace actif. Activez-en un autre d'abord.");
  const [deleted] = await db.delete(wsTable).where(eq(wsTable.id, dbId)).returning({ id: wsTable.id });
  if (!deleted) throw new ValidationError(`Workspace '${id}' introuvable.`);
  _loaded.delete(dbId);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Flush the in-memory model of a DataSource back to the DB. */
export async function saveDataSource(ds: DataSource): Promise<void> {
  await modelToDb(ds.workspaceDbId, ds.model);
}

/** Recompute cached element/relationship type lists after a mutation. */
export function recomputeDataSourceTypes(ds: DataSource): void {
  ds.elementTypes = [...new Set(ds.model.elements.map((e) => e.type).filter(Boolean))].sort();
  ds.relationshipTypes = [...new Set(ds.model.relationships.map((r) => r.type).filter(Boolean))].sort();
}
