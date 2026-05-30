/**
 * REST service to explore and edit ArchiMate models.
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
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { colord } from "colord";
import multer from "multer";
import { createRequire } from "module";
const archiver = createRequire(import.meta.url)("archiver") as typeof import("archiver").default;
import { AppError, NotFoundError, ValidationError } from "./errors.js";

/** xs:ID / NCName requires the first char to be a letter or underscore.
 *  `crypto.randomUUID()` may return strings starting with a digit, which is
 *  rejected by the Open Exchange XSD. Prefix with "id-" to stay compliant. */
function newId(): string {
  return `id-${randomUUID()}`;
}
import type { ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView, ArchiPropertyDefinition } from "@workspace/db";
import {
  dataSource,
  DataSource,
  recomputeDataSourceTypes,
  saveDataSource,
  getWorkspaces,
  activateWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "./registry.js";
import { serializeToOpenExchange } from "./oxf-serializer.js";
import { parseOpenExchange } from "./oxf-parser.js";
import { openApiSpec } from "./openapi.js";
import { renderViewToSvg, renderViewToPng } from "./renderer.js";
import {
  listUsers,
  createUser as createUserFn,
  updateUserById,
  deleteUserById,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignUserToRole,
  unassignUserFromRole,
  listRolesForUser,
  getRoleLayerPermission,
  setRoleLayerPermission,
  removeRoleLayerPermission,
  ARCHIMATE_LAYERS,
  PERMISSION_FLAGS,
  requireAuth,
  requireAdmin,
  requirePermission,
  type AuthRequest,
  type LayerPermissions,
} from "./auth.js";
import { auth as baAuth, getConfiguredProviders } from "./better-auth.js";
import { toNodeHandler } from "better-auth/node";
import {
  VIEWPOINTS,
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
  NodeUpdateIn,
  ConnectionCreateIn,
  ConnectionUpdateIn,
  SaveResult,
  StyleOut,
  ViewCreateIn,
  ViewUpdateIn,
  ViewDetailOut,
  ViewOut,
} from "./schemas.js";
import {
  parseBody,
  ElementCreateSchema,
  ElementUpdateSchema,
  ElementQuerySchema,
  RelationshipCreateSchema,
  RelationshipUpdateSchema,
  RelationshipQuerySchema,
  ViewCreateSchema,
  ViewUpdateSchema,
  NodeCreateSchema,
  NodeUpdateSchema,
  ConnectionCreateSchema,
  ConnectionUpdateSchema,
  PropertyDefinitionCreateSchema,
  PropertyDefinitionUpdateSchema,
  WorkspaceCreateSchema,
  WorkspaceUpdateSchema,
  RoleCreateSchema,
  RoleUpdateSchema,
} from "./validation.js";

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

export function hexToRgb(hexStr: string | null | undefined): RGBColorOut | null {
  if (!hexStr) return null;
  const s = hexStr.replace(/^#/, "");
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  const { r, g, b } = colord(`#${s}`).toRgb();
  return { r, g, b };
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
    source_side: c.source_side ?? null,
    target_side: c.target_side ?? null,
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
// Business logic
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
    property_definition_count: model.propertyDefinitions.length,
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
  if (!match) throw new NotFoundError(`Élément '${element_id}' introuvable.`);
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
  if (!match) throw new NotFoundError(`Relation '${relationship_id}' introuvable.`);
  return relOut(match);
}

export function listViews(ds: DataSource): ViewOut[] {
  return ds.model.views.map((v) => viewOut(v));
}

export function getViewById(ds: DataSource, view_id: string): ViewDetailOut {
  const match = ds.model.views.find((v) => v.uuid === view_id);
  if (!match) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  return viewOut(match, true);
}

// ---------------------------------------------------------------------------
// Mutation business logic – Views & Nodes
// ---------------------------------------------------------------------------

export function updateView(ds: DataSource, view_id: string, input: ViewUpdateIn): ViewDetailOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  if (input.name !== undefined) view.name = input.name;
  if (input.documentation !== undefined) view.desc = input.documentation ?? null;
  if (input.viewpoint !== undefined) view.primary_viewpoint = input.viewpoint ?? null;
  return viewOut(view, true);
}

export function deleteView(ds: DataSource, view_id: string): void {
  const idx = ds.model.views.findIndex((v) => v.uuid === view_id);
  if (idx === -1) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
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

function findNodeAnywhere(nodes: ArchiNode[], node_id: string): { node: ArchiNode; parent: ArchiNode[] } | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (n.uuid === node_id) return { node: n, parent: nodes };
    const inner = findNodeAnywhere(n.nodes, node_id);
    if (inner) return inner;
  }
  return null;
}

export function updateViewNode(ds: DataSource, view_id: string, node_id: string, input: NodeUpdateIn): NodeOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  const found = findNodeAnywhere(view.nodes, node_id);
  if (!found) throw new NotFoundError(`Nœud '${node_id}' introuvable dans la vue.`);
  const n = found.node;
  if (input.x !== undefined) n.x = input.x;
  if (input.y !== undefined) n.y = input.y;
  if (input.w !== undefined) n.w = input.w;
  if (input.h !== undefined) n.h = input.h;
  if (input.name !== undefined) n.name = input.name;
  return nodeOut(n);
}

export function deleteViewNode(ds: DataSource, view_id: string, node_id: string): void {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  const found = findNodeAnywhere(view.nodes, node_id);
  if (!found) throw new NotFoundError(`Nœud '${node_id}' introuvable dans la vue.`);
  const idx = found.parent.indexOf(found.node);
  if (idx !== -1) found.parent.splice(idx, 1);
  view.conns = view.conns.filter((c) => c.source !== node_id && c.target !== node_id);
}

export function createViewConnection(ds: DataSource, view_id: string, input: ConnectionCreateIn): ConnectionOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  if (!findNodeAnywhere(view.nodes, input.source)) throw new ValidationError(`Nœud source '${input.source}' introuvable.`);
  if (!findNodeAnywhere(view.nodes, input.target)) throw new ValidationError(`Nœud cible '${input.target}' introuvable.`);
  if (input.relationship_id && !ds.model.relationships.find((r) => r.uuid === input.relationship_id)) {
    throw new ValidationError(`Relation '${input.relationship_id}' introuvable.`);
  }
  const conn: ArchiConnection = {
    uuid: newId(),
    name: input.name ?? null,
    ref: input.relationship_id ?? null,
    source: input.source,
    target: input.target,
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    source_side: input.source_side ?? null,
    target_side: input.target_side ?? null,
  };
  view.conns.push(conn);
  return connectionOut(conn);
}

export function updateViewConnection(ds: DataSource, view_id: string, conn_id: string, input: ConnectionUpdateIn): ConnectionOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  const conn = view.conns.find((c) => c.uuid === conn_id);
  if (!conn) throw new NotFoundError(`Connexion '${conn_id}' introuvable.`);
  if (input.name !== undefined) conn.name = input.name;
  if (input.source !== undefined) {
    if (!findNodeAnywhere(view.nodes, input.source)) throw new ValidationError(`Nœud source '${input.source}' introuvable.`);
    conn.source = input.source;
  }
  if (input.target !== undefined) {
    if (!findNodeAnywhere(view.nodes, input.target)) throw new ValidationError(`Nœud cible '${input.target}' introuvable.`);
    conn.target = input.target;
  }
  if (input.source_side !== undefined) conn.source_side = input.source_side;
  if (input.target_side !== undefined) conn.target_side = input.target_side;
  return connectionOut(conn);
}

export function deleteViewConnection(ds: DataSource, view_id: string, conn_id: string): void {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  const idx = view.conns.findIndex((c) => c.uuid === conn_id);
  if (idx === -1) throw new NotFoundError(`Connexion '${conn_id}' introuvable.`);
  view.conns.splice(idx, 1);
}

export function createNode(ds: DataSource, view_id: string, input: NodeCreateIn): NodeOut {
  const view = ds.model.views.find((v) => v.uuid === view_id);
  if (!view) throw new NotFoundError(`Vue '${view_id}' introuvable.`);
  const element = ds.model.elements.find((e) => e.uuid === input.element_id);
  if (!element) throw new NotFoundError(`Élément '${input.element_id}' introuvable.`);
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
  if (!match) throw new NotFoundError(`Élément '${element_id}' introuvable.`);
  if (input.name !== undefined) match.name = input.name;
  if (input.type !== undefined) match.type = input.type;
  if (input.documentation !== undefined) match.desc = input.documentation ?? null;
  if (input.properties !== undefined) match.props = propsIn(input.properties);
  recomputeDataSourceTypes(ds);
  return elementOut(match);
}

export function deleteElement(ds: DataSource, element_id: string): void {
  const idx = ds.model.elements.findIndex((e) => e.uuid === element_id);
  if (idx === -1) throw new NotFoundError(`Élément '${element_id}' introuvable.`);
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
  if (!srcElem) throw new ValidationError(`Élément source '${input.source}' introuvable.`);
  if (!tgtElem) throw new ValidationError(`Élément cible '${input.target}' introuvable.`);
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
  if (!match) throw new NotFoundError(`Relation '${relationship_id}' introuvable.`);
  if (input.name !== undefined) match.name = input.name;
  if (input.type !== undefined) match.type = input.type;
  if (input.source !== undefined) {
    const srcElem = ds.model.elements.find((e) => e.uuid === input.source);
    if (!srcElem) throw new ValidationError(`Élément source '${input.source}' introuvable.`);
    match.source = srcElem;
  }
  if (input.target !== undefined) {
    const tgtElem = ds.model.elements.find((e) => e.uuid === input.target);
    if (!tgtElem) throw new ValidationError(`Élément cible '${input.target}' introuvable.`);
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
  if (idx === -1) throw new NotFoundError(`Relation '${relationship_id}' introuvable.`);
  ds.model.relationships.splice(idx, 1);
  recomputeDataSourceTypes(ds);
}

// ---------------------------------------------------------------------------
// Business logic – persistence
// ---------------------------------------------------------------------------

export async function saveModel(ds: DataSource): Promise<SaveResult> {
  await saveDataSource(ds);
  return { saved: true, path: ds.path || "archispark.db" };
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
  if (!match) throw new NotFoundError(`Définition de propriété '${id}' introuvable.`);
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
  if (!match) throw new NotFoundError(`Définition de propriété '${id}' introuvable.`);
  if (input.name !== undefined) match.name = input.name;
  if (input.type !== undefined) match.type = input.type;
  return pdOut(match);
}

export function deletePropertyDefinition(ds: DataSource, id: string): void {
  const idx = ds.model.propertyDefinitions.findIndex((pd) => pd.uuid === id);
  if (idx === -1) throw new NotFoundError(`Définition de propriété '${id}' introuvable.`);
  ds.model.propertyDefinitions.splice(idx, 1);
  for (const elem of ds.model.elements) delete elem.props[id];
  for (const rel of ds.model.relationships) delete rel.props[id];
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app: ReturnType<typeof express> = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
app.use(express.json());

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Trop de tentatives, réessayez dans 15 minutes." },
});

const xmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "text/xml" || file.mimetype === "application/xml" || file.originalname.endsWith(".xml");
    cb(null, ok);
  },
});

const importRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Trop d'imports, réessayez dans 1 minute." },
});

// Returns configured OAuth/OIDC providers so the frontend can render SSO buttons
app.get("/auth/providers", (_req, res) => {
  res.json(getConfiguredProviders());
});

// Mount Better Auth at /auth — handles sign-in, sign-out, session, user CRUD
// Must be BEFORE global auth middleware
app.all("/auth/*path", authRateLimit, toNodeHandler(baAuth));

// Global auth — exempt Better Auth routes and public paths
app.use((req: AuthRequest, res, next) => {
  if (
    req.path.startsWith("/auth") ||
    req.path.startsWith("/docs") ||
    req.path === "/openapi.json"
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
      saveDataSource(dataSource).catch(() => { /* ignore */ });
    }
  });
  next();
});

// ---------------------------------------------------------------------------
// User info endpoint — wraps Better Auth session
// ---------------------------------------------------------------------------

app.get("/me", (req: AuthRequest, res: Response) => {
  res.json(req.user ?? null);
});

// ---------------------------------------------------------------------------
// Users routes (read via custom query; mutations via Better Auth admin plugin)
// ---------------------------------------------------------------------------

app.get("/users", requireAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  res.json(await listUsers());
});

app.post("/users", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { username, password, role } = req.body as { username?: unknown; password?: unknown; role?: unknown };
  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    res.status(422).json({ detail: "Les champs 'username' et 'password' sont requis." });
    return;
  }
  res.status(201).json(await createUserFn(username, password, typeof role === "string" ? role : "user"));
});

app.put("/users/:id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { password, role } = req.body as { password?: unknown; role?: unknown };
  res.json(await updateUserById(req.params["id"] as string, {
    password: typeof password === "string" && password ? password : undefined,
    role: typeof role === "string" ? role : undefined,
  }));
});

app.delete("/users/:id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  await deleteUserById(req.params["id"] as string);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Roles routes (first-class entities; many users per role; per-layer permissions)
// ---------------------------------------------------------------------------

function sanitizePermissions(body: unknown): Record<string, LayerPermissions> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const result: Record<string, LayerPermissions> = {};
  for (const [layer, flags] of Object.entries(body as Record<string, unknown>)) {
    if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) continue;
    if (!Array.isArray(flags)) continue;
    result[layer] = flags.filter((f): f is string => typeof f === "string" && (PERMISSION_FLAGS as readonly string[]).includes(f)) as LayerPermissions;
  }
  return result;
}

app.get("/roles", requireAuth as express.RequestHandler, async (_req: Request, res: Response) => {
  res.json(await listRoles());
});

app.get("/roles/catalog", requireAuth as express.RequestHandler, (_req: Request, res: Response) => {
  res.json({ layers: ARCHIMATE_LAYERS, flags: PERMISSION_FLAGS });
});

app.post("/roles", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const body = parseBody(RoleCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await createRole(body.name, body.description ?? null, sanitizePermissions(body.permissions)));
});

app.get("/roles/:role_id", requireAuth as express.RequestHandler, async (req: Request, res: Response) => {
  res.json(await getRole(req.params["role_id"] as string));
});

app.put("/roles/:role_id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const body = parseBody(RoleUpdateSchema, req.body, res);
  if (!body) return;
  const role = await getRole(req.params["role_id"] as string);
    if (role.is_system) {
      res.status(403).json({ detail: "Les rôles système ne peuvent pas être modifiés." });
      return;
    }
    res.json(await updateRole(req.params["role_id"] as string, {
      name: body.name,
      description: body.description,
      permissions: sanitizePermissions(body.permissions),
    }));
});

app.delete("/roles/:role_id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  await deleteRole(req.params["role_id"] as string);
    res.status(204).send();
});

app.get("/roles/:role_id/users", requireAuth as express.RequestHandler, async (req: Request, res: Response) => {
  res.json((await getRole(req.params["role_id"] as string)).user_ids);
});

app.put("/roles/:role_id/users/:user_id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  await assignUserToRole(req.params["role_id"] as string, req.params["user_id"] as string);
    res.status(204).send();
});

app.delete("/roles/:role_id/users/:user_id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  await unassignUserFromRole(req.params["role_id"] as string, req.params["user_id"] as string);
    res.status(204).send();
});

app.get("/users/:user_id/roles", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  res.json(await listRolesForUser(req.params["user_id"] as string));
});

// Layer permissions per role
app.get("/roles/:role_id/layers", requireAuth as express.RequestHandler, async (req: Request, res: Response) => {
  res.json((await getRole(req.params["role_id"] as string)).permissions);
});

app.get("/roles/:role_id/layers/:layer", requireAuth as express.RequestHandler, async (req: Request, res: Response) => {
  const layer = req.params["layer"] as string;
    res.json({ layer, permission: await getRoleLayerPermission(req.params["role_id"] as string, layer) });
});

app.put("/roles/:role_id/layers/:layer", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { permissions } = req.body as { permissions?: unknown };
  if (!Array.isArray(permissions)) {
    res.status(422).json({ detail: "Field 'permissions' must be an array of flags (read, create, update, delete)." });
    return;
  }
  const flags = permissions.filter((f): f is string => typeof f === "string" && (PERMISSION_FLAGS as readonly string[]).includes(f)) as LayerPermissions;
  const layer = req.params["layer"] as string;
    const updated = await setRoleLayerPermission(req.params["role_id"] as string, layer, flags);
    res.json({ layer, permissions: updated });
});

app.delete("/roles/:role_id/layers/:layer", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  await removeRoleLayerPermission(req.params["role_id"] as string, req.params["layer"] as string);
    res.status(204).send();
});

// ---------------------------------------------------------------------------
// Workspace routes
// ---------------------------------------------------------------------------

app.get("/workspaces", async (_req: Request, res: Response) => {
  res.json(await getWorkspaces());
});

app.post("/workspaces", async (req: Request, res: Response) => {
  const body = parseBody(WorkspaceCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await createWorkspace(body.name, body.path));
});

app.put("/workspaces/:id", async (req: Request, res: Response) => {
  const body = parseBody(WorkspaceUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await updateWorkspace(req.params["id"] as string, body.name));
});

app.delete("/workspaces/:id", async (req: Request, res: Response) => {
  await deleteWorkspace(req.params["id"] as string);
    res.status(204).send();
});

app.post("/workspaces/:id/activate", async (req: Request, res: Response) => {
  res.json(await activateWorkspace(req.params["id"] as string));
});

// OpenAPI spec and Swagger UI
app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get("/viewpoints", (_req: Request, res: Response) => {
  res.json([...VIEWPOINTS].sort());
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
app.get("/", async (_req: Request, res: Response) => {
  const workspaces = await getWorkspaces();
  const active = workspaces.find((w) => w.active);
  res.json({ ...getModelInfo(dataSource), workspace_id: active?.id ?? null, workspace_name: active?.name ?? null });
});

// Save model to file
app.post("/save", async (_req: Request, res: Response) => {
  res.json(await saveModel(dataSource));
});

// Export model as XML
app.get("/export", (_req: Request, res: Response) => {
  const xml = serializeToOpenExchange(dataSource.model);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${dataSource.model.name || "model"}.xml"`);
    res.send(xml);
});

// Export model + all view SVGs as a ZIP archive
app.get("/export/zip", async (_req: Request, res: Response) => {
  const modelName = dataSource.model.name || "model";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${modelName}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { res.status(500).json({ detail: err.message }); });
    archive.pipe(res);
    archive.append(serializeToOpenExchange(dataSource.model), { name: `${modelName}.xml` });
    for (const view of dataSource.model.views) {
      const svg = renderViewToSvg(view, dataSource.model);
      const safeName = view.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      archive.append(svg, { name: `views/${safeName}.svg` });
    }
    await archive.finalize();
});

// Import model from XML — accepts multipart/form-data (file field "file") or raw XML body
app.post("/import", importRateLimit,
  (req, res, next) => {
    if (req.is("multipart/form-data")) {
      xmlUpload.single("file")(req, res, next);
    } else {
      express.text({ type: ["text/xml", "application/xml", "text/plain"], limit: "50mb" })(req, res, next);
    }
  },
  (req: Request, res: Response) => {
    const xml: string = (req as Request & { file?: Express.Multer.File }).file
      ? (req as Request & { file?: Express.Multer.File }).file!.buffer.toString("utf-8")
      : (req.body as string);
    if (!xml || typeof xml !== "string") throw new ValidationError("Le corps de la requête doit être un XML valide.");
    let newModel: ReturnType<typeof parseOpenExchange>;
    try { newModel = parseOpenExchange(xml); }
    catch (err) { throw new ValidationError(`Erreur de parsing XML : ${(err as Error).message}`); }
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
});

// Elements
app.get("/elements/types", (_req: Request, res: Response) => {
  res.json(listElementTypes(dataSource));
});

app.get("/elements", (req: Request, res: Response) => {
  const q = parseBody(ElementQuerySchema, req.query, res);
  if (!q) return;
  res.json(listElements(dataSource, q.type ?? null, q.name ?? null));
});

app.get("/elements/:element_id", (req: Request, res: Response) => {
  res.json(getElementById(dataSource, req.params["element_id"] as string));
});

app.post("/elements", (req: Request, res: Response) => {
  const body = parseBody(ElementCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(createElement(dataSource, body as ElementCreateIn));
});

app.put("/elements/:element_id", (req: Request, res: Response) => {
  const body = parseBody(ElementUpdateSchema, req.body, res);
  if (!body) return;
  res.json(updateElement(dataSource, req.params["element_id"] as string, body as ElementUpdateIn));
});

app.delete("/elements/:element_id", (req: Request, res: Response) => {
  deleteElement(dataSource, req.params["element_id"] as string);
    res.status(204).send();
});

// Relationships
app.get("/relationships/types", (_req: Request, res: Response) => {
  res.json(listRelationshipTypes(dataSource));
});

app.get("/relationships", requirePermission("Relations", "read"), (req: Request, res: Response) => {
  const q = parseBody(RelationshipQuerySchema, req.query, res);
  if (!q) return;
  res.json(listRelationships(dataSource, q.type ?? null, q.source_id ?? null, q.target_id ?? null));
});

app.get("/relationships/:relationship_id", requirePermission("Relations", "read"), (req: Request, res: Response) => {
  res.json(getRelationshipById(dataSource, req.params["relationship_id"] as string));
});

app.post("/relationships", requirePermission("Relations", "create"), (req: Request, res: Response) => {
  const body = parseBody(RelationshipCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(createRelationship(dataSource, body as RelationshipCreateIn));
});

app.put("/relationships/:relationship_id", requirePermission("Relations", "update"), (req: Request, res: Response) => {
  const body = parseBody(RelationshipUpdateSchema, req.body, res);
  if (!body) return;
  res.json(updateRelationship(dataSource, req.params["relationship_id"] as string, body as RelationshipUpdateIn));
});

app.delete("/relationships/:relationship_id", requirePermission("Relations", "delete"), (req: Request, res: Response) => {
  deleteRelationship(dataSource, req.params["relationship_id"] as string);
    res.status(204).send();
});

// Views
app.get("/views", requirePermission("Views", "read"), (_req: Request, res: Response) => {
  res.json(listViews(dataSource));
});

app.get("/views/:view_id", requirePermission("Views", "read"), (req: Request, res: Response) => {
  res.json(getViewById(dataSource, req.params["view_id"] as string));
});

app.post("/views", requirePermission("Views", "create"), (req: Request, res: Response) => {
  const body = parseBody(ViewCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(createView(dataSource, body as ViewCreateIn));
});

app.put("/views/:view_id", requirePermission("Views", "update"), (req: Request, res: Response) => {
  const body = parseBody(ViewUpdateSchema, req.body, res);
  if (!body) return;
  res.json(updateView(dataSource, req.params["view_id"] as string, body as ViewUpdateIn));
});

app.delete("/views/:view_id", requirePermission("Views", "delete"), (req: Request, res: Response) => {
  deleteView(dataSource, req.params["view_id"] as string);
    res.status(204).send();
});

app.post("/views/:view_id/nodes", requirePermission("Views", "update"), (req: Request, res: Response) => {
  const body = parseBody(NodeCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(createNode(dataSource, req.params["view_id"] as string, body as NodeCreateIn));
});

app.put("/views/:view_id/nodes/:node_id", requirePermission("Views", "update"), (req: Request, res: Response) => {
  const body = parseBody(NodeUpdateSchema, req.body, res);
  if (!body) return;
  res.json(updateViewNode(dataSource, req.params["view_id"] as string, req.params["node_id"] as string, body as NodeUpdateIn));
});

app.delete("/views/:view_id/nodes/:node_id", requirePermission("Views", "update"), (req: Request, res: Response) => {
  deleteViewNode(dataSource, req.params["view_id"] as string, req.params["node_id"] as string);
    res.status(204).send();
});

app.post("/views/:view_id/connections", requirePermission("Views", "update"), (req: Request, res: Response) => {
  const body = parseBody(ConnectionCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(createViewConnection(dataSource, req.params["view_id"] as string, body as ConnectionCreateIn));
});

app.put("/views/:view_id/connections/:conn_id", requirePermission("Views", "update"), (req: Request, res: Response) => {
  const body = parseBody(ConnectionUpdateSchema, req.body, res);
  if (!body) return;
  res.json(updateViewConnection(dataSource, req.params["view_id"] as string, req.params["conn_id"] as string, body as ConnectionUpdateIn));
});

app.delete("/views/:view_id/connections/:conn_id", requirePermission("Views", "update"), (req: Request, res: Response) => {
  deleteViewConnection(dataSource, req.params["view_id"] as string, req.params["conn_id"] as string);
    res.status(204).send();
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
  if (format === "png") {
      const buf = await renderViewToPng(view, dataSource.model);
      res.setHeader("Content-Type", "image/png");
      res.send(buf);
    } else {
      const svg = renderViewToSvg(view, dataSource.model);
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.send(svg);
    }
});

// PropertyDefinitions
app.get("/property-definitions", (_req: Request, res: Response) => {
  res.json(listPropertyDefinitions(dataSource));
});

app.get("/property-definitions/:id", (req: Request, res: Response) => {
  res.json(getPropertyDefinitionById(dataSource, req.params["id"] as string));
});

app.post("/property-definitions", (req: Request, res: Response) => {
  const body = parseBody(PropertyDefinitionCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(createPropertyDefinition(dataSource, body as PropertyDefinitionCreateIn));
});

app.put("/property-definitions/:id", (req: Request, res: Response) => {
  const body = parseBody(PropertyDefinitionUpdateSchema, req.body, res);
  if (!body) return;
  res.json(updatePropertyDefinition(dataSource, req.params["id"] as string, body as PropertyDefinitionUpdateIn));
});

app.delete("/property-definitions/:id", (req: Request, res: Response) => {
  deletePropertyDefinition(dataSource, req.params["id"] as string);
    res.status(204).send();
});

// ---------------------------------------------------------------------------
// Global error handler — catches AppError subclasses + unknown errors
// ---------------------------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ detail: err.message });
    return;
  }
  const msg = err instanceof Error ? err.message : "Erreur interne du serveur.";
  res.status(500).json({ detail: msg });
});
