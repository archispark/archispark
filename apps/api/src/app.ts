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
import { randomUUID, randomBytes } from "crypto";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "./redis.js";
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
import { db, oauthProviders, apiTokens, mcpTokens, modelFromDb, modelToDb } from "@workspace/db";
import { eq } from "drizzle-orm";
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
import { getAuth, getConfiguredProviders, reloadAuth } from "./better-auth.js";
import { toNodeHandler } from "better-auth/node";
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
  RoleCreateSchema,
  RoleUpdateSchema,
} from "./validation.js";

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app: ReturnType<typeof express> = express();

// Behind a reverse proxy (Vercel, Traefik) the client IP arrives via
// X-Forwarded-For. Trust one proxy hop so req.ip is correct and express-rate-limit
// doesn't throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. `1` (not `true`) keeps it from
// blindly trusting a spoofable client-supplied header.
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
app.use(express.json());

// Lightweight liveness probe — no auth, no DB, used by Docker healthchecks.
app.get("/health", (_req, res) => { res.json({ status: "ok" }); });

function redisStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => getRedis().call(args[0]!, ...args.slice(1)) as Promise<number>,
  });
}

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Trop de tentatives, réessayez dans 15 minutes." },
  store: redisStore("rl:auth:"),
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
  store: redisStore("rl:import:"),
});

// Returns configured OAuth/OIDC providers so the frontend can render SSO buttons
app.get("/auth/providers", async (_req, res) => {
  res.json(await getConfiguredProviders());
});

// Mount Better Auth at /auth — handles sign-in, sign-out, session, user CRUD
// Must be BEFORE global auth middleware
app.all("/auth/*path", authRateLimit, (req, res) => toNodeHandler(getAuth())(req, res));

// Global auth — exempt Better Auth routes and public paths
app.use((req: AuthRequest, res, next) => {
  if (
    req.path.startsWith("/auth") ||
    req.path === "/openapi.json" ||
    req.path === "/docs"
  ) return next();
  requireAuth(req, res, next);
});

// Write operations (POST/PUT/DELETE) reserved for admin, except /auth/*, /users and
// /settings/api-tokens (users manage their own tokens).
app.use((req: AuthRequest, res, next) => {
  if (
    ["POST", "PUT", "DELETE"].includes(req.method) &&
    !req.path.startsWith("/auth/") &&
    !req.path.startsWith("/users") &&
    !req.path.startsWith("/settings/api-tokens")
  ) {
    if (req.user?.role !== "admin") {
      res.status(403).json({ detail: "Modifications réservées aux administrateurs." });
      return;
    }
  }
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
// OAuth provider CRUD (admin only — stored in DB, auth reloads on change)
// ---------------------------------------------------------------------------

const PROVIDER_TYPES = ["oidc", "google", "github", "microsoft-entra-id"] as const;
type ProviderType = typeof PROVIDER_TYPES[number];

interface ProviderOut {
  id: string;
  provider_id: string;
  type: ProviderType;
  name: string;
  client_id: string;
  issuer_url: string | null;
  tenant_id: string | null;
  enabled: boolean;
  created_at: number;
}

function providerOut(row: typeof oauthProviders.$inferSelect): ProviderOut {
  return {
    id:          row.id,
    provider_id: row.providerId,
    type:        row.type as ProviderType,
    name:        row.name,
    client_id:   row.clientId,
    issuer_url:  row.issuerUrl ?? null,
    tenant_id:   row.tenantId ?? null,
    enabled:     Boolean(row.enabled),
    created_at:  row.createdAt,
  };
}

app.get("/settings/providers", requireAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  const rows = await db.select().from(oauthProviders);
  res.json(rows.map(providerOut));
});

app.post("/settings/providers", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { type, name, client_id, client_secret, issuer_url, tenant_id, enabled } =
    req.body as Record<string, unknown>;
  if (!type || !PROVIDER_TYPES.includes(type as ProviderType)) {
    res.status(422).json({ detail: `type must be one of: ${PROVIDER_TYPES.join(", ")}` });
    return;
  }
  if (!name || typeof name !== "string") {
    res.status(422).json({ detail: "name is required" });
    return;
  }
  if (!client_id || typeof client_id !== "string") {
    res.status(422).json({ detail: "client_id is required" });
    return;
  }
  if (!client_secret || typeof client_secret !== "string") {
    res.status(422).json({ detail: "client_secret is required" });
    return;
  }
  if ((type === "oidc") && (!issuer_url || typeof issuer_url !== "string")) {
    res.status(422).json({ detail: "issuer_url is required for oidc type" });
    return;
  }
  const providerId = (name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const [existing] = await db.select({ id: oauthProviders.id })
    .from(oauthProviders).where(eq(oauthProviders.providerId, providerId));
  if (existing) {
    res.status(422).json({ detail: `Provider ID '${providerId}' already exists.` });
    return;
  }
  const [row] = await db.insert(oauthProviders).values({
    id:           randomUUID(),
    providerId,
    type:         type as ProviderType,
    name:         name as string,
    clientId:     client_id,
    clientSecret: client_secret,
    issuerUrl:    typeof issuer_url === "string" ? issuer_url : null,
    tenantId:     typeof tenant_id === "string" ? tenant_id : null,
    enabled:      enabled !== false,
    createdAt:    Math.floor(Date.now() / 1000),
  }).returning();
  await reloadAuth();
  res.status(201).json(providerOut(row!));
});

app.put("/settings/providers/:id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const [existing] = await db.select().from(oauthProviders)
    .where(eq(oauthProviders.id, req.params["id"] as string));
  if (!existing) { res.status(404).json({ detail: "Provider not found." }); return; }
  const { name, client_id, client_secret, issuer_url, tenant_id, enabled } =
    req.body as Record<string, unknown>;
  await db.update(oauthProviders).set({
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof client_id === "string" ? { clientId: client_id } : {}),
    ...(typeof client_secret === "string" ? { clientSecret: client_secret } : {}),
    ...(issuer_url !== undefined ? { issuerUrl: issuer_url as string | null } : {}),
    ...(tenant_id !== undefined ? { tenantId: tenant_id as string | null } : {}),
    ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
  }).where(eq(oauthProviders.id, req.params["id"] as string));
  const [updated] = await db.select().from(oauthProviders)
    .where(eq(oauthProviders.id, req.params["id"] as string));
  await reloadAuth();
  res.json(providerOut(updated!));
});

app.delete("/settings/providers/:id", requireAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const [existing] = await db.select({ id: oauthProviders.id })
    .from(oauthProviders).where(eq(oauthProviders.id, req.params["id"] as string));
  if (!existing) { res.status(404).json({ detail: "Provider not found." }); return; }
  await db.delete(oauthProviders).where(eq(oauthProviders.id, req.params["id"] as string));
  await reloadAuth();
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Redis status (admin only — read-only, config via REDIS_URL env var)
// ---------------------------------------------------------------------------

app.get("/settings/redis", requireAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  const url = process.env["REDIS_URL"]!;
  let host: string | null = null;
  let port: number | null = null;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parsed.port ? parseInt(parsed.port, 10) : 6379;
  } catch { /* malformed URL */ }

  try {
    await getRedis().ping();
    res.json({ connected: true, host, port });
  } catch {
    res.json({ connected: false, host, port });
  }
});

// ---------------------------------------------------------------------------
// MCP token routes (admin only — single shared bearer token for MCP clients)
// ---------------------------------------------------------------------------

app.get("/settings/mcp-token", requireAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  const [row] = await db.select({ token: mcpTokens.token, createdAt: mcpTokens.createdAt }).from(mcpTokens).limit(1);
  if (!row) { res.json(null); return; }
  res.json({ token: row.token, created_at: row.createdAt });
});

app.post("/settings/mcp-token/regenerate", requireAdmin as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const token = randomBytes(32).toString("hex");
  const now   = Math.floor(Date.now() / 1000);
  await db.delete(mcpTokens);
  await db.insert(mcpTokens).values({ token, createdAt: now, createdBy: req.user?.id ?? null });
  res.json({ token, created_at: now });
});

// ---------------------------------------------------------------------------
// API token routes (personal access tokens — any authenticated user)
// ---------------------------------------------------------------------------

app.get("/settings/api-tokens", requireAuth as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const rows = req.user?.role === "admin"
    ? await db.select({ id: apiTokens.id, name: apiTokens.name, userId: apiTokens.userId, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt }).from(apiTokens)
    : await db.select({ id: apiTokens.id, name: apiTokens.name, userId: apiTokens.userId, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt }).from(apiTokens).where(eq(apiTokens.userId, req.user!.id));
  res.json(rows.map((r) => ({ id: r.id, name: r.name, user_id: r.userId, created_at: r.createdAt, last_used_at: r.lastUsedAt ?? null })));
});

app.post("/settings/api-tokens", requireAuth as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const { name } = req.body as { name?: unknown };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const [row] = await db.insert(apiTokens).values({ token, name: name.trim(), userId: req.user!.id })
    .returning({ id: apiTokens.id, name: apiTokens.name, userId: apiTokens.userId, createdAt: apiTokens.createdAt });
  res.status(201).json({ id: row!.id, name: row!.name, user_id: row!.userId, created_at: row!.createdAt, token });
});

app.delete("/settings/api-tokens/:id", requireAuth as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(422).json({ detail: "ID invalide." }); return; }
  const [existing] = await db.select({ userId: apiTokens.userId }).from(apiTokens).where(eq(apiTokens.id, id));
  if (!existing) { res.status(404).json({ detail: "Token introuvable." }); return; }
  if (req.user?.role !== "admin" && existing.userId !== req.user?.id) {
    res.status(403).json({ detail: "Accès refusé." }); return;
  }
  await db.delete(apiTokens).where(eq(apiTokens.id, id));
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

app.get("/viewpoints", (_req: Request, res: Response) => {
  res.json([...VIEWPOINTS].sort());
});


// Model info
app.get("/", async (_req: Request, res: Response) => {
  const wsId = await getActiveWorkspaceId();
  const workspaces = await getWorkspaces();
  const active = workspaces.find((w) => w.active);
  res.json({ ...(await store.getModelInfo(wsId)), workspace_id: active?.id ?? null, workspace_name: active?.name ?? null });
});

// Persistence is immediate (every write hits Postgres); /save is a no-op kept
// for backwards compatibility with existing clients.
app.post("/save", async (_req: Request, res: Response) => {
  res.json({ saved: true, path: "postgres" });
});

// Export model as XML
app.get("/export", async (_req: Request, res: Response) => {
  const model = await modelFromDb(await getActiveWorkspaceId());
  const xml = serializeToOpenExchange(model);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${model.name || "model"}.xml"`);
  res.send(xml);
});

// Export model + all view SVGs as a ZIP archive
app.get("/export/zip", async (_req: Request, res: Response) => {
  const model = await modelFromDb(await getActiveWorkspaceId());
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
app.post("/import", importRateLimit,
  (req, res, next) => {
    if (req.is("multipart/form-data")) {
      xmlUpload.single("file")(req, res, next);
    } else {
      express.text({ type: ["text/xml", "application/xml", "text/plain"], limit: "50mb" })(req, res, next);
    }
  },
  async (req: Request, res: Response) => {
    const xml: string = (req as Request & { file?: Express.Multer.File }).file
      ? (req as Request & { file?: Express.Multer.File }).file!.buffer.toString("utf-8")
      : (req.body as string);
    if (!xml || typeof xml !== "string") throw new ValidationError("Le corps de la requête doit être un XML valide.");
    let newModel: ReturnType<typeof parseOpenExchange>;
    try { newModel = parseOpenExchange(xml); }
    catch (err) { throw new ValidationError(`Erreur de parsing XML : ${(err as Error).message}`); }
    const wsId = await getActiveWorkspaceId();
    await modelToDb(wsId, newModel);
    res.json(await store.getModelInfo(wsId));
});

// Elements
app.get("/elements/types", async (_req: Request, res: Response) => {
  res.json(await store.listElementTypes(await getActiveWorkspaceId()));
});

app.get("/elements", async (req: Request, res: Response) => {
  const q = parseBody(ElementQuerySchema, req.query, res);
  if (!q) return;
  res.json(await store.listElements(await getActiveWorkspaceId(), q.type ?? null, q.name ?? null));
});

app.get("/elements/in-views", async (_req: Request, res: Response) => {
  res.json(await store.listElementsInViews(await getActiveWorkspaceId()));
});

app.get("/elements/:element_id", async (req: Request, res: Response) => {
  res.json(await store.getElementById(await getActiveWorkspaceId(), req.params["element_id"] as string));
});

app.get("/elements/:element_id/views", async (req: Request, res: Response) => {
  res.json(await store.getElementViews(await getActiveWorkspaceId(), req.params["element_id"] as string));
});

app.get("/elements/:element_id/relationships", requirePermission("Relations", "read"), async (req: Request, res: Response) => {
  res.json(await store.getElementRelationships(await getActiveWorkspaceId(), req.params["element_id"] as string));
});

app.post("/elements", async (req: Request, res: Response) => {
  const body = parseBody(ElementCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createElement(await getActiveWorkspaceId(), body as ElementCreateIn));
});

app.put("/elements/:element_id", async (req: Request, res: Response) => {
  const body = parseBody(ElementUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateElement(await getActiveWorkspaceId(), req.params["element_id"] as string, body as ElementUpdateIn));
});

app.delete("/elements/:element_id", async (req: Request, res: Response) => {
  await store.deleteElement(await getActiveWorkspaceId(), req.params["element_id"] as string);
  res.status(204).send();
});

// Relationships
app.get("/relationships/types", async (_req: Request, res: Response) => {
  res.json(await store.listRelationshipTypes(await getActiveWorkspaceId()));
});

app.get("/relationships", requirePermission("Relations", "read"), async (req: Request, res: Response) => {
  const q = parseBody(RelationshipQuerySchema, req.query, res);
  if (!q) return;
  res.json(await store.listRelationships(await getActiveWorkspaceId(), q.type ?? null, q.source_id ?? null, q.target_id ?? null));
});

app.get("/relationships/:relationship_id", requirePermission("Relations", "read"), async (req: Request, res: Response) => {
  res.json(await store.getRelationshipById(await getActiveWorkspaceId(), req.params["relationship_id"] as string));
});

app.post("/relationships", requirePermission("Relations", "create"), async (req: Request, res: Response) => {
  const body = parseBody(RelationshipCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createRelationship(await getActiveWorkspaceId(), body as RelationshipCreateIn));
});

app.put("/relationships/:relationship_id", requirePermission("Relations", "update"), async (req: Request, res: Response) => {
  const body = parseBody(RelationshipUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateRelationship(await getActiveWorkspaceId(), req.params["relationship_id"] as string, body as RelationshipUpdateIn));
});

app.delete("/relationships/:relationship_id", requirePermission("Relations", "delete"), async (req: Request, res: Response) => {
  await store.deleteRelationship(await getActiveWorkspaceId(), req.params["relationship_id"] as string);
  res.status(204).send();
});

// Views
app.get("/views", requirePermission("Views", "read"), async (_req: Request, res: Response) => {
  res.json(await store.listViews(await getActiveWorkspaceId()));
});

app.get("/views/:view_id", requirePermission("Views", "read"), async (req: Request, res: Response) => {
  res.json(await store.getViewById(await getActiveWorkspaceId(), req.params["view_id"] as string));
});

app.post("/views", requirePermission("Views", "create"), async (req: Request, res: Response) => {
  const body = parseBody(ViewCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createView(await getActiveWorkspaceId(), body as ViewCreateIn));
});

app.put("/views/:view_id", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  const body = parseBody(ViewUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateView(await getActiveWorkspaceId(), req.params["view_id"] as string, body as ViewUpdateIn));
});

app.delete("/views/:view_id", requirePermission("Views", "delete"), async (req: Request, res: Response) => {
  await store.deleteView(await getActiveWorkspaceId(), req.params["view_id"] as string);
  res.status(204).send();
});

app.post("/views/:view_id/nodes", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  const body = parseBody(NodeCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createNode(await getActiveWorkspaceId(), req.params["view_id"] as string, body as NodeCreateIn));
});

app.put("/views/:view_id/nodes/:node_id", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  const body = parseBody(NodeUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateViewNode(await getActiveWorkspaceId(), req.params["view_id"] as string, req.params["node_id"] as string, body as NodeUpdateIn));
});

app.delete("/views/:view_id/nodes/:node_id", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  await store.deleteViewNode(await getActiveWorkspaceId(), req.params["view_id"] as string, req.params["node_id"] as string);
  res.status(204).send();
});

app.post("/views/:view_id/connections", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  const body = parseBody(ConnectionCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createViewConnection(await getActiveWorkspaceId(), req.params["view_id"] as string, body as ConnectionCreateIn));
});

app.put("/views/:view_id/connections/:conn_id", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  const body = parseBody(ConnectionUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updateViewConnection(await getActiveWorkspaceId(), req.params["view_id"] as string, req.params["conn_id"] as string, body as ConnectionUpdateIn));
});

app.delete("/views/:view_id/connections/:conn_id", requirePermission("Views", "update"), async (req: Request, res: Response) => {
  await store.deleteViewConnection(await getActiveWorkspaceId(), req.params["view_id"] as string, req.params["conn_id"] as string);
  res.status(204).send();
});

app.get("/views/:view_id/image", async (req: Request, res: Response) => {
  const format = (req.query["format"] as string) || "svg";
  if (format !== "svg") {
    res.status(422).json({ detail: "Format invalide. Seul 'svg' est supporté côté serveur (l'export PNG se fait côté client)." });
    return;
  }
  const model = await modelFromDb(await getActiveWorkspaceId());
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
app.get("/property-definitions", async (_req: Request, res: Response) => {
  res.json(await store.listPropertyDefinitions(await getActiveWorkspaceId()));
});

app.get("/property-definitions/:id", async (req: Request, res: Response) => {
  res.json(await store.getPropertyDefinitionById(await getActiveWorkspaceId(), req.params["id"] as string));
});

app.post("/property-definitions", async (req: Request, res: Response) => {
  const body = parseBody(PropertyDefinitionCreateSchema, req.body, res);
  if (!body) return;
  res.status(201).json(await store.createPropertyDefinition(await getActiveWorkspaceId(), body as PropertyDefinitionCreateIn));
});

app.put("/property-definitions/:id", async (req: Request, res: Response) => {
  const body = parseBody(PropertyDefinitionUpdateSchema, req.body, res);
  if (!body) return;
  res.json(await store.updatePropertyDefinition(await getActiveWorkspaceId(), req.params["id"] as string, body as PropertyDefinitionUpdateIn));
});

app.delete("/property-definitions/:id", async (req: Request, res: Response) => {
  await store.deletePropertyDefinition(await getActiveWorkspaceId(), req.params["id"] as string);
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
