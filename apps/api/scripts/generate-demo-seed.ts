/**
 * Generates packages/db/seeds/demo.sql from data/ArchiSurance.xml and data/ArchiMetal.xml.
 * Usage: tsx apps/api/scripts/generate-demo-seed.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOpenExchange } from "../src/oxf-parser.js";
import { flattenNodes } from "@workspace/db";
import type { ArchiModel } from "@workspace/db";

const ROOT      = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DATA_DIR  = resolve(ROOT, "data");
const OUT_FILE  = resolve(ROOT, "packages/db/seeds/demo.sql");

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function q(v: string | null | undefined): string {
  if (v == null) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function n(v: number | null | undefined): string {
  return v == null ? "NULL" : String(v);
}

function bool(v: boolean | null | undefined): string {
  if (v == null) return "NULL";
  return v ? "TRUE" : "FALSE";
}

function endpointUuid(ep: string | { uuid: string }): string {
  return typeof ep === "string" ? ep : ep.uuid;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Per-entity SQL line helpers
// ---------------------------------------------------------------------------

function propDefLines(pd: ArchiModel["propertyDefinitions"][number]): string[] {
  return [
    `    INSERT INTO property_definitions (workspace_id, uuid, name, type)`,
    `      VALUES (ws_id, ${q(pd.uuid)}, ${q(pd.name)}, ${q(pd.type)});`,
  ];
}

function elementLines(e: ArchiModel["elements"][number]): string[] {
  const lines = [
    `    INSERT INTO elements (workspace_id, uuid, type, name, description)`,
    `      VALUES (ws_id, ${q(e.uuid)}, ${q(e.type)}, ${q(e.name)}, ${q(e.desc)})`,
    `      RETURNING id INTO el_db_id;`,
  ];
  for (const [defUuid, val] of Object.entries(e.props)) {
    lines.push(`    INSERT INTO element_properties (element_id, property_def_uuid, value)`);
    lines.push(`      VALUES (el_db_id, ${q(defUuid)}, ${q(val)});`);
  }
  return lines;
}

function relationshipLines(r: ArchiModel["relationships"][number]): string[] {
  const srcUuid = endpointUuid(r.source);
  const tgtUuid = endpointUuid(r.target);
  const lines = [
    `    INSERT INTO relationships (workspace_id, uuid, type, name, description, source_uuid, target_uuid, access_type, is_directed, influence_modifier)`,
    `      VALUES (ws_id, ${q(r.uuid)}, ${q(r.type)}, ${q(r.name)}, ${q(r.desc)}, ${q(srcUuid)}, ${q(tgtUuid)}, ${q(r.access_type)}, ${bool(r.is_directed)}, ${q(r.influence_strength)})`,
    `      RETURNING id INTO rel_db_id;`,
  ];
  for (const [defUuid, val] of Object.entries(r.props)) {
    lines.push(`    INSERT INTO relationship_properties (relationship_id, property_def_uuid, value)`);
    lines.push(`      VALUES (rel_db_id, ${q(defUuid)}, ${q(val)});`);
  }
  return lines;
}

function connectionLines(c: ArchiModel["views"][number]["conns"][number]): string[] {
  const lines = [
    `    INSERT INTO connections (view_id, uuid, name, relationship_uuid, source_node_uuid, target_node_uuid, line_color_r, line_color_g, line_color_b, line_color_a, line_width, font_name, font_size, font_color_r, font_color_g, font_color_b, font_color_a)`,
    `      VALUES (view_db_id, ${q(c.uuid)}, ${q(c.name)}, ${q(c.ref)}, ${q(c.source)}, ${q(c.target)}, ${n(c.line_color?.r)}, ${n(c.line_color?.g)}, ${n(c.line_color?.b)}, ${n(c.line_color?.a)}, ${n(c.line_width)}, ${q(c.font_name)}, ${n(c.font_size)}, ${n(c.font_color?.r)}, ${n(c.font_color?.g)}, ${n(c.font_color?.b)}, ${n(c.font_color?.a)})`,
    `      RETURNING id INTO conn_db_id;`,
  ];
  for (const [idx, bp] of (c.bendpoints ?? []).entries()) {
    lines.push(`    INSERT INTO bendpoints (connection_id, x, y, sort_order)`);
    lines.push(`      VALUES (conn_db_id, ${bp.x}, ${bp.y}, ${idx});`);
  }
  return lines;
}

function viewLines(v: ArchiModel["views"][number]): string[] {
  const lines = [
    `    INSERT INTO views (workspace_id, uuid, name, description, viewpoint)`,
    `      VALUES (ws_id, ${q(v.uuid)}, ${q(v.name)}, ${q(v.desc)}, ${q(v.primary_viewpoint)})`,
    `      RETURNING id INTO view_db_id;`,
  ];

  const flat: Parameters<typeof flattenNodes>[2] = [];
  flattenNodes(v.nodes, null, flat, { i: 0 });
  for (const nd of flat) {
    lines.push(`    INSERT INTO nodes (view_id, uuid, element_uuid, parent_node_uuid, name, x, y, w, h, fill_color_r, fill_color_g, fill_color_b, fill_color_a, line_color_r, line_color_g, line_color_b, line_color_a, font_name, font_size, font_color_r, font_color_g, font_color_b, font_color_a, line_width, sort_order)`);
    lines.push(`      VALUES (view_db_id, ${q(nd.uuid)}, ${q(nd.elementUuid)}, ${q(nd.parentNodeUuid)}, ${q(nd.name)}, ${n(nd.x)}, ${n(nd.y)}, ${n(nd.w)}, ${n(nd.h)}, ${n(nd.fillColorR)}, ${n(nd.fillColorG)}, ${n(nd.fillColorB)}, ${n(nd.fillColorA)}, ${n(nd.lineColorR)}, ${n(nd.lineColorG)}, ${n(nd.lineColorB)}, ${n(nd.lineColorA)}, ${q(nd.fontName)}, ${n(nd.fontSize)}, ${n(nd.fontColorR)}, ${n(nd.fontColorG)}, ${n(nd.fontColorB)}, ${n(nd.fontColorA)}, ${n(nd.lineWidth)}, ${nd.sortOrder})`);
    lines.push(`      RETURNING id INTO node_db_id;`);
  }

  for (const c of v.conns) lines.push(...connectionLines(c));

  lines.push(``);
  return lines;
}

// ---------------------------------------------------------------------------
// Per-organization SQL block (one demo organization per workspace)
// ---------------------------------------------------------------------------

function organizationBlock(model: ArchiModel): string[] {
  const ws = model.name;
  const orgId = `org-${slugify(ws)}`;
  const orgSlug = slugify(ws);

  return [
    `  -- Organization: ${ws}`,
    `  INSERT INTO organization (id, name, slug, created_at)`,
    `    VALUES (${q(orgId)}, ${q(ws)}, ${q(orgSlug)}, NOW())`,
    `    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    `    RETURNING id INTO org_id;`,
    ``,
    `  INSERT INTO member (id, organization_id, user_id, role, created_at)`,
    `  SELECT 'member-' || org_id || '-' || u.id, org_id, u.id,`,
    `         CASE WHEN u.role = 'platform_admin' THEN 'owner' ELSE 'member' END, NOW()`,
    `  FROM "user" u`,
    `  ON CONFLICT (organization_id, user_id) DO NOTHING;`,
    ``,
  ];
}

// ---------------------------------------------------------------------------
// Per-workspace SQL block
// ---------------------------------------------------------------------------

function workspaceBlock(model: ArchiModel): string {
  const lines: string[] = [];
  const ws = model.name;

  lines.push(`  -- ${"=".repeat(65)}`);
  lines.push(`  -- Workspace: ${ws}  (${model.elements.length} elements, ${model.relationships.length} rels, ${model.views.length} views)`);
  lines.push(`  -- ${"=".repeat(65)}`);
  lines.push(...organizationBlock(model));
  lines.push(`  DELETE FROM workspaces WHERE organization_id = org_id AND name = ${q(ws)};`);
  lines.push(`  INSERT INTO workspaces (uuid, name, description, version, organization_id, created_at, updated_at)`);
  lines.push(`    VALUES (${q(model.uuid)}, ${q(ws)}, ${q(model.desc)}, ${q(model.version)}, org_id, EXTRACT(EPOCH FROM NOW())::INT, EXTRACT(EPOCH FROM NOW())::INT)`);
  lines.push(`    RETURNING id INTO ws_id;`);
  lines.push(``);
  lines.push(`  INSERT INTO user_active_workspace (user_id, organization_id, workspace_id)`);
  lines.push(`  SELECT u.id, org_id, ws_id FROM "user" u`);
  lines.push(`  ON CONFLICT (user_id, organization_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;`);
  lines.push(``);

  for (const pd of model.propertyDefinitions) lines.push(...propDefLines(pd));
  if (model.propertyDefinitions.length) lines.push(``);

  for (const e of model.elements) lines.push(...elementLines(e));
  lines.push(``);

  for (const r of model.relationships) lines.push(...relationshipLines(r));
  lines.push(``);

  for (const v of model.views) lines.push(...viewLines(v));

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = ["ArchiSurance.xml", "ArchiMetal.xml"];
const models = files.map(f => parseOpenExchange(readFileSync(resolve(DATA_DIR, f), "utf-8")));

const header = `-- Demo seed: ${models.map(m => m.name).join(" + ")}
-- Generated from: ${files.join(", ")}
-- Usage: psql $DATABASE_URL -f packages/db/seeds/demo.sql
-- Or via script: pnpm --filter @workspace/db seed:demo
-- Destructive reset: deletes existing ArchiSurance/ArchiMetal workspaces (CASCADE) then reimports.

DO $$
DECLARE
  org_id    TEXT;
  ws_id     INTEGER;
  el_db_id  INTEGER;
  rel_db_id INTEGER;
  view_db_id INTEGER;
  node_db_id INTEGER;
  conn_db_id INTEGER;
BEGIN
`;

const footer = `\nEND $$;\n`;

const body = models.map(workspaceBlock).join("\n\n");

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, header + body + footer, "utf-8");
console.log(`Written: ${OUT_FILE}`);
console.log(`  Lines: ${(header + body + footer).split("\n").length}`);
