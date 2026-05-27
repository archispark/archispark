/**
 * Single ArchiMate model source loader.
 * Reads config.json at startup and parses the configured Open Exchange File (.xml).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parseOpenExchange } from "./oxf-parser.js";
function loadConfig() {
    const raw = readFileSync(join(process.cwd(), "config.json"), "utf-8");
    return JSON.parse(raw);
}
function buildDataSource(cfg) {
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
export const dataSource = buildDataSource(_config);
/** Recompute elementTypes and relationshipTypes after a mutation. */
export function recomputeDataSourceTypes(ds) {
    ds.elementTypes = [...new Set(ds.model.elements.map((e) => e.type).filter(Boolean))].sort();
    ds.relationshipTypes = [...new Set(ds.model.relationships.map((r) => r.type).filter(Boolean))].sort();
}
