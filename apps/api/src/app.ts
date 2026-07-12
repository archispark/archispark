/**
 * REST API for ArchiMate model data (apps/tenant-api).
 *
 * Internal-only service: every route below `/openapi.json`/`/docs` requires a
 * short-lived JWT signed by apps/control-api (see ./tenant-auth.ts).
 * control-api already authenticated the user, resolved their organization/team
 * membership, and enforced the write-permission check (org members are
 * read-only) before proxying here — this app trusts any token signed with the
 * shared TENANT_JWT_SECRET. `DELETE /workspaces/:id` additionally re-checks
 * `org_role === "owner"` itself (control-api also enforces this, but
 * deleting a workspace entirely is destructive enough to warrant
 * defense-in-depth).
 *
 * Routes:
 *   GET /workspaces
 *   POST /workspaces
 *   PUT /workspaces/:id
 *   DELETE /workspaces/:id
 *   POST /workspaces/:id/activate
 *   GET /openapi.json
 *   GET /docs
 *   GET /viewpoints
 *   GET /
 *   POST /save
 *   GET /export[/zip]
 *   POST /import
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
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
// archiver@8 is a pure-ESM package whose runtime exports a named `ZipArchive`
// class. A static namespace import is statically analyzable, so the bundler
// (Vercel) includes archiver in the function — unlike the old createRequire()
// form which crashed at load with "Cannot find module 'archiver'". The cast
// bridges the @types/archiver typings (which still describe the old CJS API and
// don't declare ZipArchive).
import type { Archiver, ZipOptions } from "archiver";
import * as archiverNs from "archiver";
const ZipArchive = (archiverNs as unknown as { ZipArchive: new (opts?: ZipOptions) => Archiver }).ZipArchive;
import { AppError, ValidationError } from "./errors.js";
import { modelFromDb, modelToDb, createTenantDb, decryptConnectionString, runWithTenantDb } from "@workspace/db";
import * as store from "./store.js";
import {
  getActiveWorkspaceId,
  getWorkspaces,
  activateWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "./registry.js";
import { serializeToOpenExchange } from "./oxf-serializer.js";
import { parseOpenExchange } from "./oxf-parser.js";
import { openApiSpec } from "./openapi.js";
import { renderViewToSvg } from "./renderer.js";
// Pure DTO converters live in serializers.js; re-export the ones historically
// imported from this module (used by the MCP server and unit tests).
export { hexToRgb, elementOut, relOut, nodeOut, connectionOut, viewOut, pdOut } from "./serializers.js";
import { requireTenantToken, type AuthRequest } from "./tenant-auth.js";
import {
  VIEWPOINTS,
  ElementCreateIn,
  ElementUpdateIn,
  PropertyDefinitionCreateIn,
  PropertyDefinitionUpdateIn,
  RelationshipCreateIn,
  RelationshipUpdateIn,
  NodeCreateIn,
  NodeUpdateIn,
  ConnectionCreateIn,
  ConnectionUpdateIn,
  ViewCreateIn,
  ViewUpdateIn,
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
} from "./validation.js";

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app: ReturnType<typeof express> = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
app.use(express.json());

// Lightweight liveness probe — no auth, no DB, used by Docker healthchecks.
app.get("/health", (_req, res) => { res.json({ status: "ok" }); });

const xmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "text/xml" || file.mimetype === "application/xml" || file.originalname.endsWith(".xml");
    cb(null, ok);
  },
});

// OpenAPI spec and Swagger UI — public, registered before requireTenantToken so
// apps/control-api can proxy these without an Authorization header.
app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>ArchiSpark API — Documentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
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
    persistAuthorization: true,
    tryItOutEnabled: true,
  });
</script>
</body>
</html>`);
});

// All routes below require a tenant-api token signed by apps/control-api.
app.use(requireTenantToken);

// Bind `db` (from @workspace/db) to this organization's database for the rest
// of the request — store.ts/registry.ts/model-io.ts read it via AsyncLocalStorage.
// `tenant_db` is the encrypted connection string control-api passed through
// (it never decrypts it — only this service holds TENANT_DB_ENCRYPTION_KEY). If
// null, the organization has no dedicated tenant database yet — fall through to
// this service's own DATABASE_URL (shared, transitional database).
app.use((req: AuthRequest, res, next) => {
  if (!req.tenantDbEncrypted) { next(); return; }
  try {
    runWithTenantDb(createTenantDb(decryptConnectionString(req.tenantDbEncrypted)), next);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// Workspace routes
// ---------------------------------------------------------------------------

app.get("/workspaces", async (req: AuthRequest, res: Response) => {
  res.json(await getWorkspaces(req.workspace!, req.user!.id));
});

app.post("/workspaces", async (req: AuthRequest, res: Response) => {
  const body = parseBody(WorkspaceCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await createWorkspace(req.workspace!, req.user!.id, body.name, body.path, body.description, body.team_ids));
});

app.put("/workspaces/:id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(WorkspaceUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await updateWorkspace(req.params["id"] as string, body.name, req.workspace!, req.user!.id, body.team_ids, body.description));
});

app.delete("/workspaces/:id", async (req: AuthRequest, res: Response) => {
  // manage-organization: deleting a workspace entirely is owner-only (admins
  // keep read/write on its content). control-api's requireOrgOwner already
  // enforces this — this is defense-in-depth for direct tenant-api access.
  if (req.user!.role !== "platform_admin" && req.workspace!.orgRole !== "owner") {
    res.status(403).json({ detail: "Action réservée aux propriétaires de l'organisation." });
    return;
  }
  await deleteWorkspace(req.params["id"] as string, req.workspace!.organizationId);
  res.status(204).send();
});

app.post("/workspaces/:id/activate", async (req: AuthRequest, res: Response) => {
  res.json(await activateWorkspace(req.params["id"] as string, req.workspace!, req.user!.id));
});

app.get("/viewpoints", (_req: Request, res: Response) => {
  res.json([...VIEWPOINTS].sort((a, b) => a.localeCompare(b)));
});

// Model info
app.get("/", async (req: AuthRequest, res: Response) => {
  const wsId = await getActiveWorkspaceId(req.workspace!, req.user!.id);
  const workspaces = await getWorkspaces(req.workspace!, req.user!.id);
  const active = workspaces.find((w) => w.active);
  res.json({ ...(await store.getModelInfo(wsId)), workspace_id: active?.id ?? null, workspace_name: active?.name ?? null });
});

// Persistence is immediate (every write hits Postgres); /save is a no-op kept
// for backwards compatibility with existing clients.
app.post("/save", async (_req: Request, res: Response) => {
  res.json({ saved: true, path: "postgres" });
});

// Export model as XML
app.get("/export", async (req: AuthRequest, res: Response) => {
  const model = await modelFromDb(await getActiveWorkspaceId(req.workspace!, req.user!.id));
  const xml = serializeToOpenExchange(model);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${model.name || "model"}.xml"`);
  res.send(xml);
});

// Export model + all view SVGs as a ZIP archive
app.get("/export/zip", async (req: AuthRequest, res: Response) => {
  const model = await modelFromDb(await getActiveWorkspaceId(req.workspace!, req.user!.id));
  const modelName = model.name || "model";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${modelName}.zip"`);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("error", (err: Error) => { res.status(500).json({ detail: err.message }); });
  archive.pipe(res);
  archive.append(serializeToOpenExchange(model), { name: `${modelName}.xml` });
  for (const view of model.views) {
    const svg = renderViewToSvg(view, model);
    const safeName = view.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    archive.append(svg, { name: `views/${safeName}.svg` });
  }
  await archive.finalize();
});

// Import model from XML — accepts multipart/form-data (file field "file") or raw XML body
app.post("/import",
  (req, res, next) => {
    if (req.is("multipart/form-data")) {
      xmlUpload.single("file")(req, res, next);
    } else {
      express.text({ type: ["text/xml", "application/xml", "text/plain"], limit: "50mb" })(req, res, next);
    }
  },
  async (req: AuthRequest, res: Response) => {
    const xml: string = (req as Request & { file?: Express.Multer.File }).file
      ? (req as Request & { file?: Express.Multer.File }).file!.buffer.toString("utf-8")
      : (req.body as string);
    if (!xml || typeof xml !== "string") throw new ValidationError("Le corps de la requête doit être un XML valide.");
    let newModel: ReturnType<typeof parseOpenExchange>;
    try { newModel = parseOpenExchange(xml); }
    catch (err) { throw new ValidationError(`Erreur de parsing XML : ${(err as Error).message}`); }
    const wsId = await getActiveWorkspaceId(req.workspace!, req.user!.id);
    await modelToDb(wsId, newModel);
    res.json(await store.getModelInfo(wsId));
});

// Elements
app.get("/elements/types", async (req: AuthRequest, res: Response) => {
  res.json(await store.listElementTypes(await getActiveWorkspaceId(req.workspace!, req.user!.id)));
});

app.get("/elements", async (req: AuthRequest, res: Response) => {
  const q = parseBody(ElementQuerySchema, req.query, res);
  if (!q) return;
  res.json(await store.listElements(await getActiveWorkspaceId(req.workspace!, req.user!.id), q.type ?? null, q.name ?? null));
});

app.get("/elements/in-views", async (req: AuthRequest, res: Response) => {
  res.json(await store.listElementsInViews(await getActiveWorkspaceId(req.workspace!, req.user!.id)));
});

app.get("/elements/:element_id", async (req: AuthRequest, res: Response) => {
  res.json(await store.getElementById(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["element_id"] as string));
});

app.get("/elements/:element_id/views", async (req: AuthRequest, res: Response) => {
  res.json(await store.getElementViews(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["element_id"] as string));
});

app.get("/elements/:element_id/relationships", async (req: AuthRequest, res: Response) => {
  res.json(await store.getElementRelationships(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["element_id"] as string));
});

app.post("/elements", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ElementCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createElement(await getActiveWorkspaceId(req.workspace!, req.user!.id), body as ElementCreateIn));
});

app.put("/elements/:element_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ElementUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateElement(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["element_id"] as string, body as ElementUpdateIn));
});

app.delete("/elements/:element_id", async (req: AuthRequest, res: Response) => {
  await store.deleteElement(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["element_id"] as string);
  res.status(204).send();
});

// Relationships
app.get("/relationships/types", async (req: AuthRequest, res: Response) => {
  res.json(await store.listRelationshipTypes(await getActiveWorkspaceId(req.workspace!, req.user!.id)));
});

app.get("/relationships", async (req: AuthRequest, res: Response) => {
  const q = parseBody(RelationshipQuerySchema, req.query, res);
  if (!q) return;
  res.json(await store.listRelationships(await getActiveWorkspaceId(req.workspace!, req.user!.id), q.type ?? null, q.source_id ?? null, q.target_id ?? null));
});

app.get("/relationships/:relationship_id/views", async (req: AuthRequest, res: Response) => {
  res.json(await store.getRelationshipViews(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["relationship_id"] as string));
});

app.get("/relationships/:relationship_id", async (req: AuthRequest, res: Response) => {
  res.json(await store.getRelationshipById(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["relationship_id"] as string));
});

app.post("/relationships", async (req: AuthRequest, res: Response) => {
  const body = parseBody(RelationshipCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createRelationship(await getActiveWorkspaceId(req.workspace!, req.user!.id), body as RelationshipCreateIn));
});

app.put("/relationships/:relationship_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(RelationshipUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateRelationship(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["relationship_id"] as string, body as RelationshipUpdateIn));
});

app.delete("/relationships/:relationship_id", async (req: AuthRequest, res: Response) => {
  await store.deleteRelationship(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["relationship_id"] as string);
  res.status(204).send();
});

// Views
app.get("/views", async (req: AuthRequest, res: Response) => {
  res.json(await store.listViews(await getActiveWorkspaceId(req.workspace!, req.user!.id)));
});

app.get("/views/:view_id", async (req: AuthRequest, res: Response) => {
  res.json(await store.getViewById(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string));
});

app.post("/views", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ViewCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createView(await getActiveWorkspaceId(req.workspace!, req.user!.id), body as ViewCreateIn));
});

app.put("/views/:view_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ViewUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateView(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, body as ViewUpdateIn));
});

app.delete("/views/:view_id", async (req: AuthRequest, res: Response) => {
  await store.deleteView(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string);
  res.status(204).send();
});

app.post("/views/:view_id/nodes", async (req: AuthRequest, res: Response) => {
  const body = parseBody(NodeCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createNode(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, body as NodeCreateIn));
});

app.put("/views/:view_id/nodes/:node_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(NodeUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateViewNode(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, req.params["node_id"] as string, body as NodeUpdateIn));
});

app.delete("/views/:view_id/nodes/:node_id", async (req: AuthRequest, res: Response) => {
  await store.deleteViewNode(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, req.params["node_id"] as string);
  res.status(204).send();
});

app.post("/views/:view_id/connections", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ConnectionCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createViewConnection(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, body as ConnectionCreateIn));
});

app.put("/views/:view_id/connections/:conn_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ConnectionUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateViewConnection(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, req.params["conn_id"] as string, body as ConnectionUpdateIn));
});

app.delete("/views/:view_id/connections/:conn_id", async (req: AuthRequest, res: Response) => {
  await store.deleteViewConnection(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["view_id"] as string, req.params["conn_id"] as string);
  res.status(204).send();
});

app.get("/views/:view_id/image", async (req: AuthRequest, res: Response) => {
  const format = (req.query["format"] as string) || "svg";
  if (format !== "svg") {
    res.status(422).json({ detail: "Format invalide. Seul 'svg' est supporté côté serveur (l'export PNG se fait côté client)." });
    return;
  }
  const model = await modelFromDb(await getActiveWorkspaceId(req.workspace!, req.user!.id));
  const view = model.views.find((v) => v.uuid === req.params["view_id"]);
  if (!view) {
    res.status(404).json({ detail: `Vue '${req.params["view_id"]}' introuvable.` });
    return;
  }
  const svg = renderViewToSvg(view, model);
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.send(svg);
});

// PropertyDefinitions
app.get("/property-definitions", async (req: AuthRequest, res: Response) => {
  res.json(await store.listPropertyDefinitions(await getActiveWorkspaceId(req.workspace!, req.user!.id)));
});

app.get("/property-definitions/:id", async (req: AuthRequest, res: Response) => {
  res.json(await store.getPropertyDefinitionById(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["id"] as string));
});

app.post("/property-definitions", async (req: AuthRequest, res: Response) => {
  const body = parseBody(PropertyDefinitionCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createPropertyDefinition(await getActiveWorkspaceId(req.workspace!, req.user!.id), body as PropertyDefinitionCreateIn));
});

app.put("/property-definitions/:id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(PropertyDefinitionUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updatePropertyDefinition(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["id"] as string, body as PropertyDefinitionUpdateIn));
});

app.delete("/property-definitions/:id", async (req: AuthRequest, res: Response) => {
  await store.deletePropertyDefinition(await getActiveWorkspaceId(req.workspace!, req.user!.id), req.params["id"] as string);
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
