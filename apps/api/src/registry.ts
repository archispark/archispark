/**
 * Multi-workspace ArchiMate model registry.
 * Loads workspaces from workspaces.json; falls back to legacy config.json migration.
 * The exported `dataSource` is a live ESM binding — switching workspace reassigns it
 * and all importers see the new value on next access.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { parseOpenExchange } from "./oxf-parser.js";
import type { ArchiModel } from "./model.js";

export interface WorkspaceEntry {
  id: string;
  name: string;
  path: string;
}

export interface WorkspaceOut extends WorkspaceEntry {
  active: boolean;
}

export interface DataSource {
  readonly path: string;
  readonly model: ArchiModel;
  /** Sorted unique element types present in the model. */
  elementTypes: string[];
  /** Sorted unique relationship types present in the model. */
  relationshipTypes: string[];
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const WORKSPACES_FILE = join(process.cwd(), "workspaces.json");
const CONFIG_FILE = join(process.cwd(), "config.json");

function loadWorkspaceEntries(): WorkspaceEntry[] {
  if (existsSync(WORKSPACES_FILE)) {
    return JSON.parse(readFileSync(WORKSPACES_FILE, "utf-8")) as WorkspaceEntry[];
  }
  // Migrate from legacy config.json
  if (existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as { path: string; name: string };
    const entries: WorkspaceEntry[] = [{ id: `ws-${randomUUID().slice(0, 8)}`, name: cfg.name, path: cfg.path }];
    persistEntries(entries);
    return entries;
  }
  throw new Error("workspaces.json not found and no config.json to migrate from");
}

function persistEntries(entries: WorkspaceEntry[]): void {
  writeFileSync(WORKSPACES_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function buildDataSource(entry: WorkspaceEntry): DataSource {
  const content = readFileSync(join(process.cwd(), entry.path), "utf-8");
  const model = parseOpenExchange(content);
  return {
    path: entry.path,
    model,
    elementTypes: [...new Set(model.elements.map((e) => e.type).filter(Boolean))].sort(),
    relationshipTypes: [...new Set(model.relationships.map((r) => r.type).filter(Boolean))].sort(),
  };
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

const _entries: WorkspaceEntry[] = loadWorkspaceEntries();
const _loaded = new Map<string, DataSource>();
let _activeId: string;

if (_entries.length === 0) throw new Error("workspaces.json must contain at least one workspace");
_activeId = _entries[0]!.id;
_loaded.set(_activeId, buildDataSource(_entries[0]!));

/** Live ESM binding — reassigned by activateWorkspace(). */
export let dataSource: DataSource = _loaded.get(_activeId)!;

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export function getWorkspaces(): WorkspaceOut[] {
  return _entries.map((e) => ({ ...e, active: e.id === _activeId }));
}

export function getActiveWorkspaceId(): string {
  return _activeId;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function activateWorkspace(id: string): WorkspaceOut {
  const entry = _entries.find((e) => e.id === id);
  if (!entry) throw new Error(`Workspace '${id}' introuvable.`);
  if (!_loaded.has(id)) _loaded.set(id, buildDataSource(entry));
  _activeId = id;
  dataSource = _loaded.get(id)!;
  return { ...entry, active: true };
}

export function createWorkspace(name: string, filePath?: string): WorkspaceOut {
  if (!name?.trim()) throw new Error("Le nom du workspace est requis.");
  if (_entries.find((e) => e.name === name)) throw new Error(`Un workspace nommé '${name}' existe déjà.`);
  const id = `ws-${randomUUID().slice(0, 8)}`;
  const path = filePath ?? `data/${id}.xml`;
  const entry: WorkspaceEntry = { id, name: name.trim(), path };
  _entries.push(entry);
  persistEntries(_entries);
  if (filePath && existsSync(join(process.cwd(), filePath))) {
    _loaded.set(id, buildDataSource(entry));
  }
  return { ...entry, active: false };
}

export function updateWorkspace(id: string, name: string): WorkspaceOut {
  const entry = _entries.find((e) => e.id === id);
  if (!entry) throw new Error(`Workspace '${id}' introuvable.`);
  if (!name?.trim()) throw new Error("Le nom du workspace est requis.");
  if (_entries.find((e) => e.name === name && e.id !== id)) throw new Error(`Un workspace nommé '${name}' existe déjà.`);
  entry.name = name.trim();
  persistEntries(_entries);
  return { ...entry, active: entry.id === _activeId };
}

export function deleteWorkspace(id: string): void {
  if (_entries.length <= 1) throw new Error("Impossible de supprimer le dernier workspace.");
  if (id === _activeId) throw new Error("Impossible de supprimer le workspace actif. Activez-en un autre d'abord.");
  const idx = _entries.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error(`Workspace '${id}' introuvable.`);
  _entries.splice(idx, 1);
  _loaded.delete(id);
  persistEntries(_entries);
}

export function reloadWorkspace(id: string): WorkspaceOut {
  const entry = _entries.find((e) => e.id === id);
  if (!entry) throw new Error(`Workspace '${id}' introuvable.`);
  const ds = buildDataSource(entry);
  _loaded.set(id, ds);
  if (id === _activeId) dataSource = ds;
  return { ...entry, active: id === _activeId };
}

/** Recompute elementTypes and relationshipTypes after a mutation. */
export function recomputeDataSourceTypes(ds: DataSource): void {
  ds.elementTypes = [...new Set(ds.model.elements.map((e) => e.type).filter(Boolean))].sort();
  ds.relationshipTypes = [...new Set(ds.model.relationships.map((r) => r.type).filter(Boolean))].sort();
}
