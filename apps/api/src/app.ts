/**
 * REST and MCP services to explore and edit ArchiMate models.
 *
 * Multi-workspace mode: workspaces listed in workspaces.json; one is active at a time.
 *
 * Routes:
 *   GET /workspaces
 *   POST /workspaces
 *   PUT /workspaces/:id
 *   DELETE /workspaces/:id
 *   POST /workspaces/:id/activate
 *   GET /openapi.json
 *   GET /docs
 *   GET /
 *   POST /save
 *   GET /elements[/types|/:id]
 *   POST|PUT|DELETE /elements[/:id]
 *   GET /relationships[/types|/:id]
 *   POST|PUT|DELETE /relationships[/:id]
 *   GET /views[/:id]
 *   POST /views
 *   POST /views/:view_id/nodes
 *   GET /property-definitions[/:id]
 *   POST|PUT|DELETE /property-definitions[/:id]
 *   POST|GET|DELETE /mcp/
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/** xs:ID / NCName requires the first char to be a letter or underscore.
 *  `crypto.randomUUID()` may return strings starting with a digit, which is
 *  rejected by the Open Exchange XSD. Prefix with "id-" to stay compliant. */
function newId(): string {
  return `id-${randomUUID()}`;
}
import { join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView, ArchiPropertyDefinition } from "./model.js";
import { version } from "../package.json";
import {
  dataSource,
  DataSource,
  recomputeDataSourceTypes,
  getWorkspaces,
  activateWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "./registry.js";
import { saveModelToFile, serializeToOpenExchange } from "./oxf-serializer.js";
import { parseOpenExchange } from "./oxf-parser.js";
import { openApiSpec } from "./openapi.js";
import { renderViewToSvg, renderViewToPng } from "./renderer.js";
import {
  users,
  userOut,
  loginUser,
  createUser,
  updateUser,
  deleteUser,
  requireAuth,
  requireAdmin,
  type AuthRequest,
} from "./auth.js";
import {
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  PROPERTY_DEFINITION_TYPES,
  ConnectionOut,
  ElementCreateIn,
  ElementOut,
  ElementUpdateIn,
  FontOut,
  ModelInfo,
  NodeOut,
  PropertyOut,
  PropertyDefinitionOut,
  PropertyDefinitionCreateIn,
  PropertyDefinitionUpdateIn,
  RGBColorOut,
  RelationshipCreateIn,
  RelationshipOut,
  RelationshipUpdateIn,
  NodeCreateIn,
  SaveResult,
  StyleOut,
  ViewCreateIn,
  ViewUpdateIn,
  ViewDetailOut,
  ViewOut,
} from "./schemas.js";

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hexStr: string | null | undefined): RGBColorOut | null {
  if (!hexStr) return null;
  const s = hexStr.replace(/^#/, "");
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function colorOut(color: { r: number; g: number; b: number; a?: number | null } | null): RGBColorOut | null {
  if (!color) return null;
  return { r: color.r, g: color.g, b: color.b };
}

function fontOut(obj: {
  font_name?: string | null;
  font_size?: number | null;
  font_color?: { r: number; g: number; b: number; a?: number | null } | null;
}): FontOut | null {
  const name = obj.font_name ?? null;
  const size = obj.font_size ?? null;
  const color = colorOut(obj.font_color ?? null);
  if (name || size !== null || color) return { name, size, color };
  return null;
}

function nodeStyleOut(n: ArchiNode): StyleOut | null {
  const fill = colorOut(n.fill_color);
  const line = colorOut(n.line_color);
  const font = fontOut(n);
  const lw = n.line_width ?? null;
  if (fill || line || font || lw !== null) {
    return { fill_color: fill, line_color: line, font, line_width: lw };
  }
  return null;
}

function connStyleOut(c: ArchiConnection): StyleOut | null {
  const line = colorOut(c.line_color);
  const font = fontOut(c);
  const lw = c.line_width ?? null;
  if (line || font || lw !== null) return { line_color: line, font, line_width: lw };
  return null;
}

// ---------------------------------------------------------------------------
// Conversion helpers (exported for unit tests)
// ---------------------------------------------------------------------------

function propsOut(props: Record<string, string>): PropertyOut[] {
  return Object.entries(props).map(([k, v]) => ({ property_definition_ref: k, value: v }));
}

export function elementOut(e: ArchiElement): ElementOut {
  return {
    identifier: e.uuid,
    name: e.name || "",
    type: e.type || "",
    documentation: e.desc || null,
    properties: propsOut(e.props),
  };
}

export function relOut(r: ArchiRelationship): RelationshipOut {
  const src = r.source;
  const tgt = r.target;
  const relType = r.type || "";
  return {
    identifier: r.uuid,
    name: r.name || null,
    type: relType,
    source: typeof src === "string" ? src : src.uuid,
    source_name: typeof src === "string" ? null : (src.name || null),
    target: typeof tgt === "string" ? tgt : tgt.uuid,
    target_name: typeof tgt === "string" ? null : (tgt.name || null),
    documentation: r.desc || null,
    properties: propsOut(r.props),
    access_type: relType === "Access" ? (r.access_type || null) : null,
    is_directed: relType === "Association" ? r.is_directed : null,
    modifier: relType === "Influence" && r.influence_strength != null ? String(r.influence_strength) : null,
  };
}

export function nodeOut(n: ArchiNode): NodeOut {
  const ref = n.ref;
  const element_ref = ref === null ? null : typeof ref === "string" ? ref : ref.uuid;
  return {
    identifier: n.uuid,
    name: n.name || null,
    element_ref,
    x: n.x !== null ? Math.round(n.x) : null,
    y: n.y !== null ? Math.round(n.y) : null,
    w: n.w !== null ? Math.round(n.w) : null,
    h: n.h !== null ? Math.round(n.h) : null,
    style: nodeStyleOut(n),
    children: n.nodes.map(nodeOut),
  };
}

export function connectionOut(c: ArchiConnection): ConnectionOut {
  return {
    identifier: c.uuid,
    name: c.name || null,
    relationship_ref: c.ref || null,
    source: c.source || null,
    target: c.target || null,
    style: connStyleOut(c),
  };
}

export function viewOut(v: ArchiView, detail?: false): ViewOut;
export function viewOut(v: ArchiView, detail: true): ViewDetailOut;
export function viewOut(v: ArchiView, detail = false): ViewOut | ViewDetailOut {
  const base: ViewOut = {
    identifier: v.uuid,
    name: v.name || "",
    documentation: v.desc || null,
    viewpoint: v.primary_viewpoint || null,
    node_count: v.nodes.length,
    connection_count: v.conns.length,
  };
  if (detail) {
    return { ...base, nodes: v.nodes.map(nodeOut), connections: v.conns.map(connectionOut) } as ViewDetailOut;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function propsIn(properties: PropertyOut[] | undefined): Record<string, string> {
  return Object.fromEntries((properties ?? []).map((p) => [p.property_definition_ref, p.value]));
}

// ---------------------------------------------------------------------------
// Business logic (shared by REST + MCP)
// ---------------------------------------------------------------------------

export function getModelInfo(ds: DataSource): ModelInfo {
  const { model } = ds;
  return {
    identifier: model.uuid || "",
    name: model.name || "",
    documentation: model.desc || null,
    version: model.version || null,
    element_count: model.elements.length,
    relationship_count: model.relationships.length,
    view_count: model.views.length,
  };
}

export function listElementTypes(ds: DataSource): string[] {
  return ds.elementTypes;
}

export function listElements(ds: DataSource, element_type?: string | null, name?: string | null): ElementOut[] {
  let elements = ds.model.elements;
  if (element_type) elements = elements.filter((e) => e.type === element_type);
  if (name) {
    const nl = name.toLowerCase();
    elements = elements.filter((e) => e.name && e.name.toLowerCase().includes(nl));
  }
  return elements.map(elementOut);
}

export function getElementById(ds: DataSource, element_id: string): ElementOut {
  const match = ds.model.elements.find((e) => e.uuid === element_id);
  if (!match) throw new Error(`Élément '${element_id}' introuvable.`);
  return elementOut(match);
}

export function listRelationshipTypes(ds: DataSource): string[] {
  return ds.relationshipTypes;
}

export function listRelationships(
  ds: DataSource,
  rel_type?: string | null,
  source_id?: string | null,
  target_id?: string | null
): RelationshipOut[] {
  let rels = ds.model.relationships;
  if (rel_type) rels = rels.filter((r) => r.type === rel_type);
  if (source_id) {
    rels = rels.filter((r) => {
      const src = r.source;
      return typeof src === "string" ? src === source_id : src.uuid === source_id;
    });
  }
  if (target_id) {
    rels = rels.filter((r) => {
      const tgt = r.target;
      return typeof tgt === "string" ? tgt === target_id : tgt.uuid === target_id;
    });
  }
  return rels.map(relOut);
}

export function getRelationshipById(ds: DataSource, relationship_id: string): RelationshipOut {
  const match = ds.model.relationships.find((r) => r.uuid === relationship_id);
  if (!match) throw new Error(`Relation '${relationship_id}' introuvable.`);
  return relOut(match);
}

export function listViews(ds: DataSource): ViewOut[] {
  return ds.model.views.map((v) => viewOut(v));
}

export function getViewById(ds: DataSource, view_id: string): ViewDetailOut {
  const match = ds.model.views.find((v) => v.uuid === view_id);
  if (!match) throw new Error(`Vue '${view_id}' introuvable.`);
  return viewOut(match, true);
}

// ---------------------------------------------------------------------------
// Mutation business logic – Views & Nodes
// ---------------------------------------------------------------------------

export function updateView(ds: DataSource, view_id: string, input: ViewUpdateIn): ViewDetailOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new Error(`Vue '${view_id}' introuvable.`);
  if (input.name !== undefined) view.name = input.name;
  if (input.documentation !== undefined) view.desc = input.documentation ?? null;
  if (input.viewpoint !== undefined) view.primary_viewpoint = input.viewpoint ?? null;
  return viewOut(view, true);
}

export function deleteView(ds: DataSource, view_id: string): void {
  const idx = ds.model.views.findIndex((v) => v.uuid === view_id);
  if (idx === -1) throw new Error(`Vue '${view_id}' introuvable.`);
  ds.model.views.splice(idx, 1);
}

export function createView(ds: DataSource, input: ViewCreateIn): ViewDetailOut {
  const view: ArchiView = {
    uuid: newId(),
    name: input.name,
    desc: input.documentation ?? null,
    primary_viewpoint: input.viewpoint ?? null,
    nodes: [],
    conns: [],
  };
  ds.model.views.push(view);
  return viewOut(view, true);
}

export function createNode(ds: DataSource, view_id: string, input: NodeCreateIn): NodeOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new Error(`Vue '${view_id}' introuvable.`);
  const element = ds.model.elements.find((e) => e.uuid === input.element_id);
  if (!element) throw new Error(`Élément '${input.element_id}' introuvable.`);
  const node: ArchiNode = {
    uuid: newId(),
    name: null,
    ref: element,
    x: input.x ?? null,
    y: input.y ?? null,
    w: input.w ?? null,
    h: input.h ?? null,
    fill_color: null,
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    archi_type: null,
    nodes: [],
  };
  view.nodes.push(node);
  return nodeOut(node);
}

// ---------------------------------------------------------------------------
// Mutation business logic – Elements
// ---------------------------------------------------------------------------

export function createElement(ds: DataSource, input: ElementCreateIn): ElementOut {
  const element: ArchiElement = {
    uuid: newId(),
    name: input.name,
    type: input.type,
    desc: input.documentation ?? null,
    props: propsIn(input.properties),
  };
  ds.model.elements.push(element);
  recomputeDataSourceTypes(ds);
  return elementOut(element);
}

export function updateElement(ds: DataSource, element_id: string, input: ElementUpdateIn): ElementOut {
  const match = ds.model.elements.find((e) => e.uuid === element_id);
  if (!match) throw new Error(`Élément '${element_id}' introuvable.`);
  if (input.name !== undefined) match.name = input.name;
  if (input.type !== undefined) match.type = input.type;
  if (input.documentation !== undefined) match.desc = input.documentation ?? null;
  if (input.properties !== undefined) match.props = propsIn(input.properties);
  recomputeDataSourceTypes(ds);
  return elementOut(match);
}

export function deleteElement(ds: DataSource, element_id: string): void {
  const idx = ds.model.elements.findIndex((e) => e.uuid === element_id);
  if (idx === -1) throw new Error(`Élément '${element_id}' introuvable.`);
  ds.model.elements.splice(idx, 1);
  ds.model.relationships = ds.model.relationships.filter((r) => {
    const srcId = typeof r.source === "string" ? r.source : r.source.uuid;
    const tgtId = typeof r.target === "string" ? r.target : r.target.uuid;
    return srcId !== element_id && tgtId !== element_id;
  });
  const dropNodes = (nodes: ArchiNode[]): ArchiNode[] =>
    nodes
      .filter((n) => {
        const r = n.ref;
        const refId = r == null ? null : typeof r === "string" ? r : r.uuid;
        return refId !== element_id;
      })
      .map((n) => ({ ...n, nodes: dropNodes(n.nodes) }));
  for (const v of ds.model.views) {
    v.nodes = dropNodes(v.nodes);
  }
  recomputeDataSourceTypes(ds);
}

// ---------------------------------------------------------------------------
// Mutation business logic – Relationships
// ---------------------------------------------------------------------------

export function createRelationship(ds: DataSource, input: RelationshipCreateIn): RelationshipOut {
  const srcElem = ds.model.elements.find((e) => e.uuid === input.source);
  const tgtElem = ds.model.elements.find((e) => e.uuid === input.target);
  if (!srcElem) throw new Error(`Élément source '${input.source}' introuvable.`);
  if (!tgtElem) throw new Error(`Élément cible '${input.target}' introuvable.`);
  const rel: ArchiRelationship = {
    uuid: newId(),
    name: input.name ?? null,
    type: input.type,
    source: srcElem,
    target: tgtElem,
    desc: input.documentation ?? null,
    props: propsIn(input.properties),
    access_type: input.access_type ?? null,
    is_directed: input.is_directed ?? null,
    influence_strength: input.influence_strength ?? null,
  };
  ds.model.relationships.push(rel);
  recomputeDataSourceTypes(ds);
  return relOut(rel);
}

export function updateRelationship(ds: DataSource, relationship_id: string, input: RelationshipUpdateIn): RelationshipOut {
  const match = ds.model.relationships.find((r) => r.uuid === relationship_id);
  if (!match) throw new Error(`Relation '${relationship_id}' introuvable.`);
  if (input.name !== undefined) match.name = input.name;
  if (input.type !== undefined) match.type = input.type;
  if (input.source !== undefined) {
    const srcElem = ds.model.elements.find((e) => e.uuid === input.source);
    if (!srcElem) throw new Error(`Élément source '${input.source}' introuvable.`);
    match.source = srcElem;
  }
  if (input.target !== undefined) {
    const tgtElem = ds.model.elements.find((e) => e.uuid === input.target);
    if (!tgtElem) throw new Error(`Élément cible '${input.target}' introuvable.`);
    match.target = tgtElem;
  }
  if (input.documentation !== undefined) match.desc = input.documentation ?? null;
  if (input.properties !== undefined) match.props = propsIn(input.properties);
  if (input.access_type !== undefined) match.access_type = input.access_type;
  if (input.is_directed !== undefined) match.is_directed = input.is_directed;
  if (input.influence_strength !== undefined) match.influence_strength = input.influence_strength;
  recomputeDataSourceTypes(ds);
  return relOut(match);
}

export function deleteRelationship(ds: DataSource, relationship_id: string): void {
  const idx = ds.model.relationships.findIndex((r) => r.uuid === relationship_id);
  if (idx === -1) throw new Error(`Relation '${relationship_id}' introuvable.`);
  ds.model.relationships.splice(idx, 1);
  recomputeDataSourceTypes(ds);
}

// ---------------------------------------------------------------------------
// Business logic – persistence
// ---------------------------------------------------------------------------

export function saveModel(ds: DataSource): SaveResult {
  saveModelToFile(ds.model, join(process.cwd(), ds.path));
  return { saved: true, path: ds.path };
}

// ---------------------------------------------------------------------------
// Business logic – propertyDefinitions
// ---------------------------------------------------------------------------

export function pdOut(pd: ArchiPropertyDefinition): PropertyDefinitionOut {
  return { identifier: pd.uuid, name: pd.name, type: pd.type };
}

export function listPropertyDefinitions(ds: DataSource): PropertyDefinitionOut[] {
  return ds.model.propertyDefinitions.map(pdOut);
}

export function getPropertyDefinitionById(ds: DataSource, id: string): PropertyDefinitionOut {
  const match = ds.model.propertyDefinitions.find((pd) => pd.uuid === id);
  if (!match) throw new Error(`Définition de propriété '${id}' introuvable.`);
  return pdOut(match);
}

export function createPropertyDefinition(ds: DataSource, input: PropertyDefinitionCreateIn): PropertyDefinitionOut {
  const pd: ArchiPropertyDefinition = {
    uuid: newId(),
    name: input.name,
    type: input.type ?? "string",
  };
  ds.model.propertyDefinitions.push(pd);
  return pdOut(pd);
}

export function updatePropertyDefinition(ds: DataSource, id: string, input: PropertyDefinitionUpdateIn): PropertyDefinitionOut {
  const match = ds.model.propertyDefinitions.find((pd) => pd.uuid === id);
  if (!match) throw new Error(`Définition de propriété '${id}' introuvable.`);
  if (input.name !== undefined) match.name = input.name;
  if (input.type !== undefined) match.type = input.type;
  return pdOut(match);
}

export function deletePropertyDefinition(ds: DataSource, id: string): void {
  const idx = ds.model.propertyDefinitions.findIndex((pd) => pd.uuid === id);
  if (idx === -1) throw new Error(`Définition de propriété '${id}' introuvable.`);
  ds.model.propertyDefinitions.splice(idx, 1);
  for (const elem of ds.model.elements) delete elem.props[id];
  for (const rel of ds.model.relationships) delete rel.props[id];
}

// ---------------------------------------------------------------------------
// Input validation helper
// ---------------------------------------------------------------------------

const _ELEMENT_TYPES_STR = [...ELEMENT_TYPES].sort().join(", ");
const _RELATIONSHIP_TYPES_STR = [...RELATIONSHIP_TYPES].sort().join(", ");
const _PROPERTY_DEFINITION_TYPES_STR = [...PROPERTY_DEFINITION_TYPES].sort().join(", ");

function validateType(
  value: string | null | undefined,
  allowed: ReadonlySet<string>,
  typesStr: string,
  label: string,
  res: Response
): boolean {
  if (value && !allowed.has(value)) {
    res.status(422).json({ detail: `Type ${label} invalide: '${value}'. Types valides: ${typesStr}` });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app = express();

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use(express.json());

// Global auth — exempt only public paths
const PUBLIC_PATHS = new Set(["/auth/login", "/openapi.json", "/docs", "/mcp/"]);
app.use((req: AuthRequest, res, next) => {
  if (
    PUBLIC_PATHS.has(req.path) ||
    req.path.startsWith("/docs") ||
    req.path.startsWith("/mcp/")
  ) return next();
  requireAuth(req, res, next);
});

// Write operations (POST/PUT/DELETE) reserved for admin, except /auth/* and /users (already requireAdmin)
app.use((req: AuthRequest, res, next) => {
  if (
    ["POST", "PUT", "DELETE"].includes(req.method) &&
    !req.path.startsWith("/auth/") &&
    !req.path.startsWith("/users")
  ) {
    if (req.user?.role !== "admin") {
      res.status(403).json({ detail: "Modifications réservées aux administrateurs." });
      return;
    }
  }
  next();
});

// Auto-save model after every successful mutation on model routes
const MODEL_WRITE_PATHS = ["/elements", "/relationships", "/views", "/property-definitions", "/import"];
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!["POST", "PUT", "DELETE"].includes(req.method)) return next();
  if (!MODEL_WRITE_PATHS.some((p) => req.path.startsWith(p))) return next();
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try { saveModel(dataSource); } catch { /* ignore */ }
    }
  });
  next();
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post("/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(422).json({ detail: "username et password requis." });
    return;
  }
  const token = loginUser(username, password);
  if (!token) {
    res.status(401).json({ detail: "Identifiants incorrects." });
    return;
  }
  res.json({ token });
});

app.get("/auth/me", (req: AuthRequest, res: Response) => {
  res.json(req.user);
});

// ---------------------------------------------------------------------------
// Users routes (admin only)
// ---------------------------------------------------------------------------

app.get("/users", requireAdmin as express.RequestHandler, (_req: Request, res: Response) => {
  res.json(users.map(userOut));
});

app.post("/users", requireAdmin as express.RequestHandler, (req: Request, res: Response) => {
  const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
  if (!username || !password) {
    res.status(422).json({ detail: "username et password requis." });
    return;
  }
  try {
    res.status(201).json(createUser(username, password, (role === "admin" ? "admin" : "user")));
  } catch (err) {
    res.status(422).json({ detail: (err as Error).message });
  }
});

app.put("/users/:id", requireAdmin as express.RequestHandler, (req: Request, res: Response) => {
  const { password, role } = req.body as { password?: string; role?: string };
  try {
    res.json(updateUser(req.params["id"] as string, {
      password: password || undefined,
      role: role === "admin" ? "admin" : role === "user" ? "user" : undefined,
    }));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.delete("/users/:id", requireAdmin as express.RequestHandler, (req: Request, res: Response) => {
  try {
    deleteUser(req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    res.status(422).json({ detail: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Workspace routes
// ---------------------------------------------------------------------------

app.get("/workspaces", (_req: Request, res: Response) => {
  res.json(getWorkspaces());
});

app.post("/workspaces", (req: Request, res: Response) => {
  const { name, path: filePath } = req.body as { name?: string; path?: string };
  if (!name) {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  try {
    res.status(201).json(createWorkspace(name, filePath));
  } catch (err) {
    res.status(422).json({ detail: (err as Error).message });
  }
});

app.put("/workspaces/:id", (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  try {
    res.json(updateWorkspace(req.params["id"] as string, name));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.delete("/workspaces/:id", (req: Request, res: Response) => {
  try {
    deleteWorkspace(req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    res.status(422).json({ detail: (err as Error).message });
  }
});

app.post("/workspaces/:id/activate", (req: Request, res: Response) => {
  try {
    res.json(activateWorkspace(req.params["id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// OpenAPI spec and Swagger UI
app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>mcp-archimate — API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});

// Model info
app.get("/", (_req: Request, res: Response) => {
  const workspaces = getWorkspaces();
  const active = workspaces.find((w) => w.active);
  res.json({ ...getModelInfo(dataSource), workspace_id: active?.id ?? null, workspace_name: active?.name ?? null });
});

// Save model to file
app.post("/save", (_req: Request, res: Response) => {
  try {
    res.json(saveModel(dataSource));
  } catch (err) {
    res.status(500).json({ detail: (err as Error).message });
  }
});

// Export model as XML
app.get("/export", (_req: Request, res: Response) => {
  try {
    const xml = serializeToOpenExchange(dataSource.model);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${dataSource.model.name || "model"}.xml"`);
    res.send(xml);
  } catch (err) {
    res.status(500).json({ detail: (err as Error).message });
  }
});

// Import model from XML (replaces in-memory model, does not auto-save)
app.post("/import", express.text({ type: ["text/xml", "application/xml", "text/plain"], limit: "50mb" }), (req: Request, res: Response) => {
  try {
    const xml = req.body as string;
    if (!xml || typeof xml !== "string") {
      res.status(422).json({ detail: "Le corps de la requête doit être un XML valide." });
      return;
    }
    const newModel = parseOpenExchange(xml);
    // Replace model in-place so all references to dataSource remain valid
    dataSource.model.uuid = newModel.uuid;
    dataSource.model.name = newModel.name;
    dataSource.model.desc = newModel.desc;
    dataSource.model.version = newModel.version;
    dataSource.model.elements.splice(0, dataSource.model.elements.length, ...newModel.elements);
    dataSource.model.relationships.splice(0, dataSource.model.relationships.length, ...newModel.relationships);
    dataSource.model.propertyDefinitions.splice(0, dataSource.model.propertyDefinitions.length, ...newModel.propertyDefinitions);
    dataSource.model.views.splice(0, dataSource.model.views.length, ...newModel.views);
    (dataSource.model as { _raw?: unknown })._raw = newModel._raw;
    recomputeDataSourceTypes(dataSource);
    res.json(getModelInfo(dataSource));
  } catch (err) {
    res.status(422).json({ detail: `Erreur de parsing XML : ${(err as Error).message}` });
  }
});

// Elements
app.get("/elements/types", (_req: Request, res: Response) => {
  res.json(listElementTypes(dataSource));
});

app.get("/elements", (req: Request, res: Response) => {
  const type = (req.query["type"] as string) || null;
  const name = (req.query["name"] as string) || null;
  if (!validateType(type, ELEMENT_TYPES, _ELEMENT_TYPES_STR, "d'élément ArchiMate", res)) return;
  res.json(listElements(dataSource, type, name));
});

app.get("/elements/:element_id", (req: Request, res: Response) => {
  try {
    res.json(getElementById(dataSource, req.params["element_id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.post("/elements", (req: Request, res: Response) => {
  const body = req.body as ElementCreateIn;
  if (!body.name || typeof body.name !== "string") {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  if (!body.type || typeof body.type !== "string") {
    res.status(422).json({ detail: "Le champ 'type' est requis." });
    return;
  }
  if (!validateType(body.type, ELEMENT_TYPES, _ELEMENT_TYPES_STR, "d'élément ArchiMate", res)) return;
  try {
    res.status(201).json(createElement(dataSource, body));
  } catch (err) {
    res.status(422).json({ detail: (err as Error).message });
  }
});

app.put("/elements/:element_id", (req: Request, res: Response) => {
  const body = req.body as ElementUpdateIn;
  if (body.type !== undefined && !validateType(body.type, ELEMENT_TYPES, _ELEMENT_TYPES_STR, "d'élément ArchiMate", res)) return;
  try {
    res.json(updateElement(dataSource, req.params["element_id"] as string, body));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.delete("/elements/:element_id", (req: Request, res: Response) => {
  try {
    deleteElement(dataSource, req.params["element_id"] as string);
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// Relationships
app.get("/relationships/types", (_req: Request, res: Response) => {
  res.json(listRelationshipTypes(dataSource));
});

app.get("/relationships", (req: Request, res: Response) => {
  const type = (req.query["type"] as string) || null;
  const source_id = (req.query["source_id"] as string) || null;
  const target_id = (req.query["target_id"] as string) || null;
  if (!validateType(type, RELATIONSHIP_TYPES, _RELATIONSHIP_TYPES_STR, "de relation ArchiMate", res)) return;
  res.json(listRelationships(dataSource, type, source_id, target_id));
});

app.get("/relationships/:relationship_id", (req: Request, res: Response) => {
  try {
    res.json(getRelationshipById(dataSource, req.params["relationship_id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.post("/relationships", (req: Request, res: Response) => {
  const body = req.body as RelationshipCreateIn;
  if (!body.type || typeof body.type !== "string") {
    res.status(422).json({ detail: "Le champ 'type' est requis." });
    return;
  }
  if (!body.source || typeof body.source !== "string") {
    res.status(422).json({ detail: "Le champ 'source' est requis." });
    return;
  }
  if (!body.target || typeof body.target !== "string") {
    res.status(422).json({ detail: "Le champ 'target' est requis." });
    return;
  }
  if (!validateType(body.type, RELATIONSHIP_TYPES, _RELATIONSHIP_TYPES_STR, "de relation ArchiMate", res)) return;
  try {
    res.status(201).json(createRelationship(dataSource, body));
  } catch (err) {
    res.status(422).json({ detail: (err as Error).message });
  }
});

app.put("/relationships/:relationship_id", (req: Request, res: Response) => {
  const body = req.body as RelationshipUpdateIn;
  if (body.type !== undefined && !validateType(body.type, RELATIONSHIP_TYPES, _RELATIONSHIP_TYPES_STR, "de relation ArchiMate", res)) return;
  try {
    res.json(updateRelationship(dataSource, req.params["relationship_id"] as string, body));
  } catch (err) {
    const msg = (err as Error).message;
    res.status(msg.startsWith("Relation ") ? 404 : 422).json({ detail: msg });
  }
});

app.delete("/relationships/:relationship_id", (req: Request, res: Response) => {
  try {
    deleteRelationship(dataSource, req.params["relationship_id"] as string);
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// Views
app.get("/views", (_req: Request, res: Response) => {
  res.json(listViews(dataSource));
});

app.get("/views/:view_id", (req: Request, res: Response) => {
  try {
    res.json(getViewById(dataSource, req.params["view_id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.post("/views", (req: Request, res: Response) => {
  const body = req.body as ViewCreateIn;
  if (!body.name || typeof body.name !== "string") {
    res.status(422).json({ detail: "Field 'name' is required." });
    return;
  }
  res.status(201).json(createView(dataSource, body));
});

app.put("/views/:view_id", (req: Request, res: Response) => {
  const body = req.body as ViewUpdateIn;
  try {
    res.json(updateView(dataSource, req.params["view_id"] as string, body));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.delete("/views/:view_id", (req: Request, res: Response) => {
  try {
    deleteView(dataSource, req.params["view_id"] as string);
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.post("/views/:view_id/nodes", (req: Request, res: Response) => {
  const body = req.body as NodeCreateIn;
  if (!body.element_id || typeof body.element_id !== "string") {
    res.status(422).json({ detail: "Field 'element_id' is required." });
    return;
  }
  try {
    res.status(201).json(createNode(dataSource, req.params["view_id"] as string, body));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.get("/views/:view_id/image", async (req: Request, res: Response) => {
  const format = (req.query["format"] as string) || "svg";
  if (format !== "svg" && format !== "png") {
    res.status(422).json({ detail: "Format invalide. Valeurs acceptées: 'svg', 'png'." });
    return;
  }
  const view = dataSource.model.views.find((v) => v.uuid === req.params["view_id"]);
  if (!view) {
    res.status(404).json({ detail: `Vue '${req.params["view_id"]}' introuvable.` });
    return;
  }
  try {
    if (format === "png") {
      const buf = await renderViewToPng(view, dataSource.model);
      res.setHeader("Content-Type", "image/png");
      res.send(buf);
    } else {
      const svg = renderViewToSvg(view, dataSource.model);
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.send(svg);
    }
  } catch (err) {
    res.status(500).json({ detail: (err as Error).message });
  }
});

// PropertyDefinitions
app.get("/property-definitions", (_req: Request, res: Response) => {
  res.json(listPropertyDefinitions(dataSource));
});

app.get("/property-definitions/:id", (req: Request, res: Response) => {
  try {
    res.json(getPropertyDefinitionById(dataSource, req.params["id"] as string));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.post("/property-definitions", (req: Request, res: Response) => {
  const body = req.body as PropertyDefinitionCreateIn;
  if (!body.name || typeof body.name !== "string") {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  if (body.type !== undefined && !PROPERTY_DEFINITION_TYPES.has(body.type)) {
    res.status(422).json({ detail: `Type invalide: '${body.type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}` });
    return;
  }
  res.status(201).json(createPropertyDefinition(dataSource, body));
});

app.put("/property-definitions/:id", (req: Request, res: Response) => {
  const body = req.body as PropertyDefinitionUpdateIn;
  if (body.type !== undefined && !PROPERTY_DEFINITION_TYPES.has(body.type)) {
    res.status(422).json({ detail: `Type invalide: '${body.type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}` });
    return;
  }
  try {
    res.json(updatePropertyDefinition(dataSource, req.params["id"] as string, body));
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

app.delete("/property-definitions/:id", (req: Request, res: Response) => {
  try {
    deletePropertyDefinition(dataSource, req.params["id"] as string);
    res.status(204).send();
  } catch (err) {
    res.status(404).json({ detail: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const mcpServer = new McpServer({ name: "ArchiMate MCP", version });

function toContent(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

mcpServer.registerTool(
  "get_model_info",
  { description: "Retourne les métadonnées globales du modèle ArchiMate chargé (identifiant, nom, version, compteurs).", inputSchema: {} },
  async () => toContent(getModelInfo(dataSource))
);

mcpServer.registerTool(
  "list_element_types",
  { description: "Retourne la liste triée des types d'éléments ArchiMate 3.1 présents dans le modèle.", inputSchema: {} },
  async () => toContent(listElementTypes(dataSource))
);

mcpServer.registerTool(
  "list_elements",
  {
    description: `Liste les éléments du modèle avec filtres optionnels. element_type doit être un type ArchiMate 3.1 valide parmi: ${_ELEMENT_TYPES_STR}.`,
    inputSchema: {
      element_type: z.string().optional().describe("Type ArchiMate 3.1 (ex: ApplicationComponent)"),
      name: z.string().optional().describe("Filtre par nom (insensible à la casse, sous-chaîne)"),
    },
  },
  async ({ element_type, name }) => {
    if (element_type && !ELEMENT_TYPES.has(element_type)) {
      throw new Error(`Type d'élément invalide: '${element_type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(listElements(dataSource, element_type, name));
  }
);

mcpServer.registerTool(
  "get_element",
  { description: "Retourne le détail d'un élément ArchiMate par son identifiant (champ 'identifier').", inputSchema: { element_id: z.string().describe("Identifiant de l'élément") } },
  async ({ element_id }) => toContent(getElementById(dataSource, element_id))
);

mcpServer.registerTool(
  "list_relationship_types",
  { description: "Retourne la liste triée des types de relations ArchiMate 3.1 présents dans le modèle.", inputSchema: {} },
  async () => toContent(listRelationshipTypes(dataSource))
);

mcpServer.registerTool(
  "list_relationships",
  {
    description: `Liste les relations du modèle avec filtres optionnels. rel_type doit être parmi: ${_RELATIONSHIP_TYPES_STR}.`,
    inputSchema: {
      rel_type: z.string().optional().describe("Type de relation ArchiMate 3.1"),
      source_id_filter: z.string().optional().describe("Filtrer par identifiant source"),
      target_id: z.string().optional().describe("Filtrer par identifiant cible"),
    },
  },
  async ({ rel_type, source_id_filter, target_id }) => {
    if (rel_type && !RELATIONSHIP_TYPES.has(rel_type)) {
      throw new Error(`Type de relation invalide: '${rel_type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(listRelationships(dataSource, rel_type, source_id_filter, target_id));
  }
);

mcpServer.registerTool(
  "get_relationship",
  { description: "Retourne le détail d'une relation ArchiMate par son identifiant.", inputSchema: { relationship_id: z.string().describe("Identifiant de la relation") } },
  async ({ relationship_id }) => toContent(getRelationshipById(dataSource, relationship_id))
);

mcpServer.registerTool(
  "list_views",
  { description: "Liste toutes les vues du modèle avec leur nombre de nœuds et de connexions.", inputSchema: {} },
  async () => toContent(listViews(dataSource))
);

mcpServer.registerTool(
  "get_view",
  { description: "Retourne le détail d'une vue ArchiMate par son identifiant.", inputSchema: { view_id: z.string().describe("Identifiant de la vue") } },
  async ({ view_id }) => toContent(getViewById(dataSource, view_id))
);

mcpServer.registerTool(
  "create_view",
  {
    description: "Crée une nouvelle vue (diagramme) dans le modèle ArchiMate.",
    inputSchema: {
      name: z.string().describe("Nom de la vue"),
      viewpoint: z.string().optional().nullable().describe("Point de vue ArchiMate (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation (optionnel)"),
    },
  },
  async ({ name, viewpoint, documentation }) =>
    toContent(createView(dataSource, { name, viewpoint, documentation }))
);

mcpServer.registerTool(
  "create_node",
  {
    description: "Ajoute un nœud (représentation visuelle d'un élément) dans une vue ArchiMate.",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue"),
      element_id: z.string().describe("Identifiant de l'élément à représenter"),
      x: z.number().optional().nullable().describe("Position X en pixels"),
      y: z.number().optional().nullable().describe("Position Y en pixels"),
      w: z.number().optional().nullable().describe("Largeur en pixels"),
      h: z.number().optional().nullable().describe("Hauteur en pixels"),
    },
  },
  async ({ view_id, element_id, x, y, w, h }) =>
    toContent(createNode(dataSource, view_id, { element_id, x, y, w, h }))
);

// ---------------------------------------------------------------------------
// MCP tools – mutations (create / update / delete)
// ---------------------------------------------------------------------------

const propertyItemSchema = z.object({
  property_definition_ref: z.string().describe("Référence à la définition de propriété"),
  value: z.string().describe("Valeur de la propriété"),
});

mcpServer.registerTool(
  "create_element",
  {
    description: `Crée un nouvel élément ArchiMate dans le modèle (en mémoire). Types valides: ${_ELEMENT_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de l'élément"),
      type: z.string().describe("Type ArchiMate 3.1 (ex: ApplicationComponent, BusinessActor)"),
      documentation: z.string().optional().nullable().describe("Documentation / description"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
    },
  },
  async ({ name, type, documentation, properties }) => {
    if (!ELEMENT_TYPES.has(type)) {
      throw new Error(`Type d'élément invalide: '${type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    return toContent(createElement(dataSource, { name, type, documentation, properties }));
  }
);

mcpServer.registerTool(
  "update_element",
  {
    description: "Met à jour un élément ArchiMate existant. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type ArchiMate 3.1"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation (null pour effacer)"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés (remplace les existantes)"),
    },
  },
  async ({ element_id, name, type, documentation, properties }) => {
    if (type && !ELEMENT_TYPES.has(type)) {
      throw new Error(`Type d'élément invalide: '${type}'. Types valides: ${_ELEMENT_TYPES_STR}`);
    }
    const input: ElementUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    return toContent(updateElement(dataSource, element_id, input));
  }
);

mcpServer.registerTool(
  "delete_element",
  {
    description: "Supprime un élément ArchiMate et toutes les relations qui le référencent.",
    inputSchema: {
      element_id: z.string().describe("Identifiant de l'élément à supprimer"),
    },
  },
  async ({ element_id }) => {
    deleteElement(dataSource, element_id);
    return toContent({ deleted: true, identifier: element_id });
  }
);

mcpServer.registerTool(
  "create_relationship",
  {
    description: `Crée une nouvelle relation ArchiMate entre deux éléments. Types valides: ${_RELATIONSHIP_TYPES_STR}.`,
    inputSchema: {
      type: z.string().describe("Type de relation ArchiMate 3.1 (ex: Association, Composition)"),
      source: z.string().describe("Identifiant de l'élément source"),
      target: z.string().describe("Identifiant de l'élément cible"),
      name: z.string().optional().nullable().describe("Nom de la relation (optionnel)"),
      documentation: z.string().optional().nullable().describe("Documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Propriétés personnalisées"),
      access_type: z.string().optional().nullable().describe("Type d'accès (Access uniquement): Access, Read, Write, ReadWrite"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée (Association uniquement)"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence (Influence uniquement)"),
    },
  },
  async ({ type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (!RELATIONSHIP_TYPES.has(type)) {
      throw new Error(`Type de relation invalide: '${type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    return toContent(createRelationship(dataSource, { type, source, target, name, documentation, properties, access_type, is_directed, influence_strength }));
  }
);

mcpServer.registerTool(
  "update_relationship",
  {
    description: "Met à jour une relation ArchiMate existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à modifier"),
      name: z.string().optional().nullable().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de relation"),
      source: z.string().optional().describe("Nouvel identifiant d'élément source"),
      target: z.string().optional().describe("Nouvel identifiant d'élément cible"),
      documentation: z.string().optional().nullable().describe("Nouvelle documentation"),
      properties: z.array(propertyItemSchema).optional().describe("Nouvelles propriétés"),
      access_type: z.string().optional().nullable().describe("Type d'accès"),
      is_directed: z.boolean().optional().nullable().describe("Relation dirigée"),
      influence_strength: z.string().optional().nullable().describe("Force d'influence"),
    },
  },
  async ({ relationship_id, name, type, source, target, documentation, properties, access_type, is_directed, influence_strength }) => {
    if (type && !RELATIONSHIP_TYPES.has(type)) {
      throw new Error(`Type de relation invalide: '${type}'. Types valides: ${_RELATIONSHIP_TYPES_STR}`);
    }
    const input: RelationshipUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (source !== undefined) input.source = source;
    if (target !== undefined) input.target = target;
    if (documentation !== undefined) input.documentation = documentation;
    if (properties !== undefined) input.properties = properties;
    if (access_type !== undefined) input.access_type = access_type;
    if (is_directed !== undefined) input.is_directed = is_directed;
    if (influence_strength !== undefined) input.influence_strength = influence_strength;
    return toContent(updateRelationship(dataSource, relationship_id, input));
  }
);

mcpServer.registerTool(
  "delete_relationship",
  {
    description: "Supprime une relation ArchiMate du modèle.",
    inputSchema: {
      relationship_id: z.string().describe("Identifiant de la relation à supprimer"),
    },
  },
  async ({ relationship_id }) => {
    deleteRelationship(dataSource, relationship_id);
    return toContent({ deleted: true, identifier: relationship_id });
  }
);

// ---------------------------------------------------------------------------
// MCP tools – propertyDefinitions
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "list_property_definitions",
  { description: "Liste toutes les définitions de propriétés du modèle ArchiMate.", inputSchema: {} },
  async () => toContent(listPropertyDefinitions(dataSource))
);

mcpServer.registerTool(
  "get_property_definition",
  {
    description: "Retourne le détail d'une définition de propriété par son identifiant.",
    inputSchema: { id: z.string().describe("Identifiant de la définition de propriété") },
  },
  async ({ id }) => toContent(getPropertyDefinitionById(dataSource, id))
);

mcpServer.registerTool(
  "create_property_definition",
  {
    description: `Crée une nouvelle définition de propriété dans le modèle. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}.`,
    inputSchema: {
      name: z.string().describe("Nom de la définition de propriété"),
      type: z.string().optional().describe("Type de données (string par défaut): string, boolean, date, number, enumeration"),
    },
  },
  async ({ name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    return toContent(createPropertyDefinition(dataSource, { name, type }));
  }
);

mcpServer.registerTool(
  "update_property_definition",
  {
    description: "Met à jour une définition de propriété existante. Seuls les champs fournis sont modifiés.",
    inputSchema: {
      id: z.string().describe("Identifiant de la définition à modifier"),
      name: z.string().optional().describe("Nouveau nom"),
      type: z.string().optional().describe("Nouveau type de données"),
    },
  },
  async ({ id, name, type }) => {
    if (type && !PROPERTY_DEFINITION_TYPES.has(type)) {
      throw new Error(`Type invalide: '${type}'. Types valides: ${_PROPERTY_DEFINITION_TYPES_STR}`);
    }
    const input: PropertyDefinitionUpdateIn = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    return toContent(updatePropertyDefinition(dataSource, id, input));
  }
);

mcpServer.registerTool(
  "delete_property_definition",
  {
    description: "Supprime une définition de propriété et retire toutes les propriétés associées des éléments et relations.",
    inputSchema: { id: z.string().describe("Identifiant de la définition à supprimer") },
  },
  async ({ id }) => {
    deletePropertyDefinition(dataSource, id);
    return toContent({ deleted: true, identifier: id });
  }
);

// ---------------------------------------------------------------------------
// MCP tools – persistence
// ---------------------------------------------------------------------------

mcpServer.registerTool(
  "save_model",
  {
    description: "Saves the current in-memory model to its source file on disk (Open Exchange XML).",
    inputSchema: {},
  },
  async () => toContent(saveModel(dataSource))
);

mcpServer.registerTool(
  "render_view",
  {
    description:
      "Génère une image SVG ou PNG d'une vue ArchiMate. " +
      "SVG est retourné directement (toujours disponible). " +
      "PNG nécessite le paquet optionnel 'sharp' (npm install sharp).",
    inputSchema: {
      view_id: z.string().describe("Identifiant de la vue à rendre"),
      format: z
        .enum(["svg", "png"])
        .optional()
        .describe("Format de sortie: 'svg' (défaut) ou 'png'"),
    },
  },
  async ({ view_id, format = "svg" }) => {
    const view = dataSource.model.views.find((v) => v.uuid === view_id);
    if (!view) throw new Error(`Vue '${view_id}' introuvable.`);
    if (format === "png") {
      const buf = await renderViewToPng(view, dataSource.model);
      return {
        content: [{ type: "image" as const, data: buf.toString("base64"), mimeType: "image/png" }],
      };
    }
    const svg = renderViewToSvg(view, dataSource.model);
    return {
      content: [{ type: "image" as const, data: Buffer.from(svg).toString("base64"), mimeType: "image/svg+xml" }],
    };
  }
);

// ---------------------------------------------------------------------------
// MCP HTTP transport (session-aware, streamable-http)
// ---------------------------------------------------------------------------

const mcpTransports: Record<string, StreamableHTTPServerTransport> = {};
const mcpSessionTimestamps: Record<string, number> = {};
const SESSION_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const id of Object.keys(mcpSessionTimestamps)) {
    if ((mcpSessionTimestamps[id] ?? 0) < cutoff) {
      delete mcpTransports[id];
      delete mcpSessionTimestamps[id];
    }
  }
}, 5 * 60 * 1000).unref();

app.post("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && mcpTransports[sessionId]) {
    mcpSessionTimestamps[sessionId] = Date.now();
    await mcpTransports[sessionId]!.handleRequest(req, res, req.body);
    return;
  }

  if (isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        mcpTransports[id] = transport;
        mcpSessionTimestamps[id] = Date.now();
      },
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: "Bad Request: missing or invalid session." });
});

app.get("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && mcpTransports[sessionId]) {
    await mcpTransports[sessionId]!.handleRequest(req, res);
    return;
  }
  res.status(405).json({ error: "Method Not Allowed" });
});

app.delete("/mcp/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && mcpTransports[sessionId]) {
    await mcpTransports[sessionId]!.handleRequest(req, res);
    delete mcpTransports[sessionId];
    return;
  }
  res.status(404).json({ error: "Session not found" });
});
