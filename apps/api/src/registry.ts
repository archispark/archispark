/**
 * Single ArchiMate model source loader.
 * Reads config.json at startup and parses the configured Open Exchange File (.xml).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parseOpenExchange } from "./oxf-parser.js";
import type { ArchiModel } from "./model.js";

interface AppConfig {
  path: string;
  name: string;
}

export interface DataSource {
  readonly path: string;
  readonly model: ArchiModel;
  /** Sorted unique element types present in the model. */
  elementTypes: string[];
  /** Sorted unique relationship types present in the model. */
  relationshipTypes: string[];
}

function loadConfig(): AppConfig {
  const raw = readFileSync(join(process.cwd(), "config.json"), "utf-8");
  return JSON.parse(raw) as AppConfig;
}

function buildDataSource(cfg: AppConfig): DataSource {
  const content = readFileSync(join(process.cwd(), cfg.path), "utf-8");
  const model = parseOpenExchange(content);
  return {
    path: cfg.path,
    model,
    elementTypes: [...new Set(model.elements.map((e) => e.type).filter(Boolean))].sort(),
    relationshipTypes: [...new Set(model.relationships.map((r) => r.type).filter(Boolean))].sort(),
  };
}

const _config = loadConfig();

export const dataSource: DataSource = buildDataSource(_config);

/** Recompute elementTypes and relationshipTypes after a mutation. */
export function recomputeDataSourceTypes(ds: DataSource): void {
  ds.elementTypes = [...new Set(ds.model.elements.map((e) => e.type).filter(Boolean))].sort();
  ds.relationshipTypes = [...new Set(ds.model.relationships.map((r) => r.type).filter(Boolean))].sort();
}
