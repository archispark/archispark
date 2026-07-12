/**
 * ArchiSpark REST API — authentication, personal settings, and the ArchiMate
 * model (apps/api).
 *
 * Every request (except the health check, OpenAPI spec/docs, and the public
 * site-messages GET) is authenticated via `requireAuth` — a Keycloak
 * `access_token` cookie/Bearer JWT verified via JWKS, or a personal API
 * token. Workspaces belong to an Organization (owner/admin/member roles);
 * every workspace route resolves its active organization/workspace and
 * checks the caller's role through access.ts — see .claude/rules/api.md.
 *
 * Routes:
 *   GET /me
 *   GET|POST /settings/api-tokens, DELETE /settings/api-tokens/:id
 *   GET|PUT /settings/messages
 *   GET /workspaces
 *   POST /workspaces
 *   PUT /workspaces/:id
 *   DELETE /workspaces/:id
 *   POST /workspaces/:id/activate
 *   GET|POST /organizations
 *   PUT|DELETE /organizations/:id
 *   POST /organizations/:id/activate
 *   GET|POST /organizations/:id/members
 *   PUT|DELETE /organizations/:id/members/:userId
 *   GET /platform/organizations
 *   PUT|DELETE /platform/organizations/:id
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

import express, { Request, Response, NextFunction } from "express"
import { randomUUID } from "crypto"
import cors from "cors"
import helmet from "helmet"
import multer from "multer"
// archiver@8 is a pure-ESM package whose runtime exports a named `ZipArchive`
// class. A static namespace import is statically analyzable, so the bundler
// (Vercel) includes archiver in the function — unlike the old createRequire()
// form which crashed at load with "Cannot find module 'archiver'". The cast
// bridges the @types/archiver typings (which still describe the old CJS API and
// don't declare ZipArchive).
import type { Archiver, ZipOptions } from "archiver"
import * as archiverNs from "archiver"
const ZipArchive = (
  archiverNs as unknown as { ZipArchive: new (opts?: ZipOptions) => Archiver }
).ZipArchive
import { AppError, ValidationError } from "./errors.js"
import { and, eq, sql } from "drizzle-orm"
import {
  db,
  modelFromDb,
  modelToDb,
  apiTokens,
  workspaces,
  siteSettings,
} from "@workspace/db"
import * as store from "./store.js"
import {
  getWorkspaces,
  activateWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "./registry.js"
import {
  activeWorkspaceId,
  assertOrgAccess,
  type AccessUser,
} from "./access.js"
import {
  listOrganizationsForUser,
  createOrganization,
  renameOrganization,
  deleteOrganization,
  activateOrganization,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "./organizations-store.js"
import {
  listAllOrganizations,
  setOrganizationEnabled,
  deleteOrganizationAsPlatformAdmin,
} from "./platform-store.js"
import { serializeToOpenExchange } from "./oxf-serializer.js"
import { parseOpenExchange } from "./oxf-parser.js"
import { openApiSpec } from "./openapi.js"
import { renderViewToSvg } from "./renderer.js"
// Pure DTO converters live in serializers.js; re-export the ones historically
// imported from this module (used by the MCP server and unit tests).
export {
  hexToRgb,
  elementOut,
  relOut,
  nodeOut,
  connectionOut,
  viewOut,
  pdOut,
} from "./serializers.js"
import { requireAuth, requireSuperAdmin, type AuthRequest } from "./auth.js"
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
} from "./schemas.js"
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
  OrganizationCreateSchema,
  OrganizationUpdateSchema,
  OrganizationMemberCreateSchema,
  OrganizationMemberUpdateSchema,
  PlatformOrganizationUpdateSchema,
  ApiTokenCreateSchema,
} from "./validation.js"

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

export const app: ReturnType<typeof express> = express()

// Behind a reverse proxy (Vercel, Traefik) the client IP arrives via
// X-Forwarded-For. Trust one proxy hop so req.ip is correct. `1` (not `true`)
// keeps it from blindly trusting a spoofable client-supplied header.
app.set("trust proxy", 1)

app.use(helmet({ contentSecurityPolicy: false }))
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
)
app.use(express.json())

// Lightweight liveness probe — no auth, no DB, used by Docker healthchecks.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

const xmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "text/xml" ||
      file.mimetype === "application/xml" ||
      file.originalname.endsWith(".xml")
    cb(null, ok)
  },
})

// OpenAPI spec and Swagger UI — public, registered before requireAuth.
app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec)
})

app.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8")
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
</html>`)
})

// Site messages GET (login banner) is the only other public route.
app.get("/settings/messages", async (_req: Request, res: Response) => {
  const defaults = {
    login_message: null,
    login_message_enabled: false,
    banner_message: null,
    banner_message_enabled: false,
  }
  try {
    const [row] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
    if (!row) {
      res.json(defaults)
      return
    }
    res.json({
      login_message: row.loginMessage ?? null,
      login_message_enabled: row.loginMessageEnabled,
      banner_message: row.bannerMessage ?? null,
      banner_message_enabled: row.bannerMessageEnabled,
    })
  } catch {
    res.json(defaults)
  }
})

// All routes below require authentication.
app.use(requireAuth)

function accessUser(req: AuthRequest): AccessUser {
  return { id: req.user!.id, role: req.user!.role }
}

// ---------------------------------------------------------------------------
// User info + personal settings
// ---------------------------------------------------------------------------

app.get("/me", (req: AuthRequest, res: Response) => {
  res.json(req.user ?? null)
})

app.get("/settings/api-tokens", async (req: AuthRequest, res: Response) => {
  const isPlatformAdmin = req.user?.role === "platform_admin"
  const cols = {
    id: apiTokens.id,
    name: apiTokens.name,
    userId: apiTokens.userId,
    createdAt: apiTokens.createdAt,
    lastUsedAt: apiTokens.lastUsedAt,
    expiresAt: apiTokens.expiresAt,
    organizationId: apiTokens.organizationId,
    workspaceId: apiTokens.workspaceId,
  }
  const rows = isPlatformAdmin
    ? await db.select(cols).from(apiTokens)
    : await db
        .select(cols)
        .from(apiTokens)
        .where(eq(apiTokens.userId, req.user!.id))
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      user_id: r.userId,
      created_at: r.createdAt,
      last_used_at: r.lastUsedAt ?? null,
      expires_at: r.expiresAt ?? null,
      // platform_admin sees every token's bookkeeping columns but never the
      // organization/workspace scoping — that would leak organization
      // structure to a role that has no access to organization data (access.ts).
      ...(isPlatformAdmin
        ? {}
        : {
            organization_id: String(r.organizationId),
            workspace_id: r.workspaceId !== null ? String(r.workspaceId) : null,
          }),
    }))
  )
})

app.post("/settings/api-tokens", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ApiTokenCreateSchema, req.body, res)
  if (!body) return

  const organizationId = parseInt(body.organization_id, 10)
  if (!Number.isFinite(organizationId)) {
    res.status(422).json({ detail: "organization_id invalide." })
    return
  }
  // The caller must be a member of the organization the token is scoped to —
  // any role suffices ("read"); the role itself is re-resolved live on every
  // request the token makes (see access.ts), never frozen on the token.
  await assertOrgAccess(accessUser(req), organizationId, "read")

  let workspaceId: number | null = null
  if (body.workspace_id) {
    workspaceId = parseInt(body.workspace_id, 10)
    if (!Number.isFinite(workspaceId)) {
      res.status(422).json({ detail: "workspace_id invalide." })
      return
    }
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.organizationId, organizationId)
        )
      )
    if (!ws) {
      res
        .status(422)
        .json({ detail: "workspace_id invalide pour cette organisation." })
      return
    }
  }

  const expiresAt: number | undefined = (() => {
    if (body.expires_at === null || body.expires_at === undefined)
      return undefined
    const v =
      typeof body.expires_at === "string"
        ? parseInt(body.expires_at, 10)
        : body.expires_at
    return isNaN(v) ? undefined : v
  })()
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")
  const [row] = await db
    .insert(apiTokens)
    .values({
      token,
      name: body.name.trim(),
      userId: req.user!.id,
      organizationId,
      workspaceId,
      expiresAt,
    })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      userId: apiTokens.userId,
      createdAt: apiTokens.createdAt,
      expiresAt: apiTokens.expiresAt,
      organizationId: apiTokens.organizationId,
      workspaceId: apiTokens.workspaceId,
    })
  res.status(201).json({
    id: row!.id,
    name: row!.name,
    user_id: row!.userId,
    created_at: row!.createdAt,
    expires_at: row!.expiresAt ?? null,
    organization_id: String(row!.organizationId),
    workspace_id: row!.workspaceId !== null ? String(row!.workspaceId) : null,
    token,
  })
})

app.delete(
  "/settings/api-tokens/:id",
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    const [existing] = await db
      .select({ userId: apiTokens.userId })
      .from(apiTokens)
      .where(eq(apiTokens.id, id))
    if (!existing) {
      res.status(404).json({ detail: "Token introuvable." })
      return
    }
    if (
      req.user?.role !== "platform_admin" &&
      existing.userId !== req.user?.id
    ) {
      res.status(403).json({ detail: "Accès refusé." })
      return
    }
    await db.delete(apiTokens).where(eq(apiTokens.id, id))
    res.status(204).send()
  }
)

app.put(
  "/settings/messages",
  requireSuperAdmin as express.RequestHandler,
  async (req: Request, res: Response) => {
    const {
      login_message,
      login_message_enabled,
      banner_message,
      banner_message_enabled,
    } = req.body as Record<string, unknown>
    const vals = {
      id: 1 as const,
      loginMessage:
        typeof login_message === "string" ? login_message || null : null,
      loginMessageEnabled: Boolean(login_message_enabled),
      bannerMessage:
        typeof banner_message === "string" ? banner_message || null : null,
      bannerMessageEnabled: Boolean(banner_message_enabled),
      updatedAt: sql`extract(epoch from now())::int`,
    }
    await db
      .insert(siteSettings)
      .values(vals)
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          loginMessage: vals.loginMessage,
          loginMessageEnabled: vals.loginMessageEnabled,
          bannerMessage: vals.bannerMessage,
          bannerMessageEnabled: vals.bannerMessageEnabled,
          updatedAt: vals.updatedAt,
        },
      })
    res.json({ ok: true })
  }
)

// ---------------------------------------------------------------------------
// Organization routes
// ---------------------------------------------------------------------------

app.get("/organizations", async (req: AuthRequest, res: Response) => {
  res.json(await listOrganizationsForUser(accessUser(req)))
})

app.post("/organizations", async (req: AuthRequest, res: Response) => {
  const body = parseBody(OrganizationCreateSchema, req.body, res)
  if (!body) return
  res.status(201).json(await createOrganization(accessUser(req), body.name))
})

app.put("/organizations/:id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(OrganizationUpdateSchema, req.body, res)
  if (!body) return
  const id = parseInt(req.params["id"] as string, 10)
  if (isNaN(id)) {
    res.status(422).json({ detail: "ID invalide." })
    return
  }
  res.json(await renameOrganization(accessUser(req), id, body.name))
})

app.delete("/organizations/:id", async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params["id"] as string, 10)
  if (isNaN(id)) {
    res.status(422).json({ detail: "ID invalide." })
    return
  }
  await deleteOrganization(accessUser(req), id)
  res.status(204).send()
})

app.post(
  "/organizations/:id/activate",
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    res.json(await activateOrganization(accessUser(req), id))
  }
)

app.get(
  "/organizations/:id/members",
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    res.json(await listMembers(accessUser(req), id))
  }
)

app.post(
  "/organizations/:id/members",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(OrganizationMemberCreateSchema, req.body, res)
    if (!body) return
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    res
      .status(201)
      .json(await addMember(accessUser(req), id, body.username, body.role))
  }
)

app.put(
  "/organizations/:id/members/:userId",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(OrganizationMemberUpdateSchema, req.body, res)
    if (!body) return
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    res.json(
      await updateMemberRole(
        accessUser(req),
        id,
        req.params["userId"] as string,
        body.role
      )
    )
  }
)

app.delete(
  "/organizations/:id/members/:userId",
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    await removeMember(accessUser(req), id, req.params["userId"] as string)
    res.status(204).send()
  }
)

// ---------------------------------------------------------------------------
// Platform admin — organization administration (metadata only)
// ---------------------------------------------------------------------------

app.get(
  "/platform/organizations",
  requireSuperAdmin as express.RequestHandler,
  async (_req: Request, res: Response) => {
    res.json(await listAllOrganizations())
  }
)

app.put(
  "/platform/organizations/:id",
  requireSuperAdmin as express.RequestHandler,
  async (req: Request, res: Response) => {
    const body = parseBody(PlatformOrganizationUpdateSchema, req.body, res)
    if (!body) return
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    res.json(await setOrganizationEnabled(id, body.enabled))
  }
)

app.delete(
  "/platform/organizations/:id",
  requireSuperAdmin as express.RequestHandler,
  async (req: Request, res: Response) => {
    const id = parseInt(req.params["id"] as string, 10)
    if (isNaN(id)) {
      res.status(422).json({ detail: "ID invalide." })
      return
    }
    await deleteOrganizationAsPlatformAdmin(id)
    res.status(204).send()
  }
)

// ---------------------------------------------------------------------------
// Workspace routes
// ---------------------------------------------------------------------------

app.get("/workspaces", async (req: AuthRequest, res: Response) => {
  res.json(await getWorkspaces(accessUser(req)))
})

app.post("/workspaces", async (req: AuthRequest, res: Response) => {
  const body = parseBody(WorkspaceCreateSchema, req.body, res)
  if (!body) return
  const organizationId =
    body.organization_id !== undefined
      ? parseInt(body.organization_id, 10)
      : undefined
  if (organizationId !== undefined && !Number.isFinite(organizationId)) {
    res.status(422).json({ detail: "organization_id invalide." })
    return
  }
  res
    .status(201)
    .json(
      await createWorkspace(
        accessUser(req),
        body.name,
        body.path,
        body.description,
        organizationId
      )
    )
})

app.put("/workspaces/:id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(WorkspaceUpdateSchema, req.body, res)
  if (!body) return
  res.json(
    await updateWorkspace(
      accessUser(req),
      req.params["id"] as string,
      body.name,
      body.description
    )
  )
})

app.delete("/workspaces/:id", async (req: AuthRequest, res: Response) => {
  await deleteWorkspace(accessUser(req), req.params["id"] as string)
  res.status(204).send()
})

app.post(
  "/workspaces/:id/activate",
  async (req: AuthRequest, res: Response) => {
    res.json(
      await activateWorkspace(accessUser(req), req.params["id"] as string)
    )
  }
)

app.get("/viewpoints", (_req: Request, res: Response) => {
  res.json([...VIEWPOINTS].sort((a, b) => a.localeCompare(b)))
})

// Model info
app.get("/", async (req: AuthRequest, res: Response) => {
  const wsId = await activeWorkspaceId(req, "read")
  const wsList = await getWorkspaces(accessUser(req))
  const active = wsList.find((w) => w.active)
  res.json({
    ...(await store.getModelInfo(wsId)),
    workspace_id: active?.id ?? null,
    workspace_name: active?.name ?? null,
  })
})

// Persistence is immediate (every write hits Postgres); /save is a no-op kept
// for backwards compatibility with existing clients.
app.post("/save", async (_req: Request, res: Response) => {
  res.json({ saved: true, path: "postgres" })
})

// Export model as XML
app.get("/export", async (req: AuthRequest, res: Response) => {
  const model = await modelFromDb(await activeWorkspaceId(req, "read"))
  const xml = serializeToOpenExchange(model)
  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${model.name || "model"}.xml"`
  )
  res.send(xml)
})

// Export model + all view SVGs as a ZIP archive
app.get("/export/zip", async (req: AuthRequest, res: Response) => {
  const model = await modelFromDb(await activeWorkspaceId(req, "read"))
  const modelName = model.name || "model"
  res.setHeader("Content-Type", "application/zip")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${modelName}.zip"`
  )
  const archive = new ZipArchive({ zlib: { level: 9 } })
  archive.on("error", (err: Error) => {
    res.status(500).json({ detail: err.message })
  })
  archive.pipe(res)
  archive.append(serializeToOpenExchange(model), { name: `${modelName}.xml` })
  for (const view of model.views) {
    const svg = renderViewToSvg(view, model)
    const safeName = view.name.replace(/[^a-zA-Z0-9_-]/g, "_")
    archive.append(svg, { name: `views/${safeName}.svg` })
  }
  await archive.finalize()
})

// Import model from XML — accepts multipart/form-data (file field "file") or raw XML body
app.post(
  "/import",
  (req, res, next) => {
    if (req.is("multipart/form-data")) {
      xmlUpload.single("file")(req, res, next)
    } else {
      express.text({
        type: ["text/xml", "application/xml", "text/plain"],
        limit: "50mb",
      })(req, res, next)
    }
  },
  async (req: AuthRequest, res: Response) => {
    const xml: string = (req as Request & { file?: Express.Multer.File }).file
      ? (req as Request & { file?: Express.Multer.File }).file!.buffer.toString(
          "utf-8"
        )
      : (req.body as string)
    if (!xml || typeof xml !== "string")
      throw new ValidationError(
        "Le corps de la requête doit être un XML valide."
      )
    let newModel: ReturnType<typeof parseOpenExchange>
    try {
      newModel = parseOpenExchange(xml)
    } catch (err) {
      throw new ValidationError(
        `Erreur de parsing XML : ${(err as Error).message}`
      )
    }
    const wsId = await activeWorkspaceId(req, "write")
    await modelToDb(wsId, newModel)
    res.json(await store.getModelInfo(wsId))
  }
)

// Elements
app.get("/elements/types", async (req: AuthRequest, res: Response) => {
  res.json(await store.listElementTypes(await activeWorkspaceId(req, "read")))
})

app.get("/elements", async (req: AuthRequest, res: Response) => {
  const q = parseBody(ElementQuerySchema, req.query, res)
  if (!q) return
  res.json(
    await store.listElements(
      await activeWorkspaceId(req, "read"),
      q.type ?? null,
      q.name ?? null
    )
  )
})

app.get("/elements/in-views", async (req: AuthRequest, res: Response) => {
  res.json(
    await store.listElementsInViews(await activeWorkspaceId(req, "read"))
  )
})

app.get("/elements/:element_id", async (req: AuthRequest, res: Response) => {
  res.json(
    await store.getElementById(
      await activeWorkspaceId(req, "read"),
      req.params["element_id"] as string
    )
  )
})

app.get(
  "/elements/:element_id/views",
  async (req: AuthRequest, res: Response) => {
    res.json(
      await store.getElementViews(
        await activeWorkspaceId(req, "read"),
        req.params["element_id"] as string
      )
    )
  }
)

app.get(
  "/elements/:element_id/relationships",
  async (req: AuthRequest, res: Response) => {
    res.json(
      await store.getElementRelationships(
        await activeWorkspaceId(req, "read"),
        req.params["element_id"] as string
      )
    )
  }
)

app.post("/elements", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ElementCreateSchema, req.body, res)
  if (!body) return
  res
    .status(201)
    .json(
      await store.createElement(
        await activeWorkspaceId(req, "write"),
        body as ElementCreateIn
      )
    )
})

app.put("/elements/:element_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ElementUpdateSchema, req.body, res)
  if (!body) return
  res.json(
    await store.updateElement(
      await activeWorkspaceId(req, "write"),
      req.params["element_id"] as string,
      body as ElementUpdateIn
    )
  )
})

app.delete("/elements/:element_id", async (req: AuthRequest, res: Response) => {
  await store.deleteElement(
    await activeWorkspaceId(req, "write"),
    req.params["element_id"] as string
  )
  res.status(204).send()
})

// Relationships
app.get("/relationships/types", async (req: AuthRequest, res: Response) => {
  res.json(
    await store.listRelationshipTypes(await activeWorkspaceId(req, "read"))
  )
})

app.get("/relationships", async (req: AuthRequest, res: Response) => {
  const q = parseBody(RelationshipQuerySchema, req.query, res)
  if (!q) return
  res.json(
    await store.listRelationships(
      await activeWorkspaceId(req, "read"),
      q.type ?? null,
      q.source_id ?? null,
      q.target_id ?? null
    )
  )
})

app.get(
  "/relationships/:relationship_id/views",
  async (req: AuthRequest, res: Response) => {
    res.json(
      await store.getRelationshipViews(
        await activeWorkspaceId(req, "read"),
        req.params["relationship_id"] as string
      )
    )
  }
)

app.get(
  "/relationships/:relationship_id",
  async (req: AuthRequest, res: Response) => {
    res.json(
      await store.getRelationshipById(
        await activeWorkspaceId(req, "read"),
        req.params["relationship_id"] as string
      )
    )
  }
)

app.post("/relationships", async (req: AuthRequest, res: Response) => {
  const body = parseBody(RelationshipCreateSchema, req.body, res)
  if (!body) return
  res
    .status(201)
    .json(
      await store.createRelationship(
        await activeWorkspaceId(req, "write"),
        body as RelationshipCreateIn
      )
    )
})

app.put(
  "/relationships/:relationship_id",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(RelationshipUpdateSchema, req.body, res)
    if (!body) return
    res.json(
      await store.updateRelationship(
        await activeWorkspaceId(req, "write"),
        req.params["relationship_id"] as string,
        body as RelationshipUpdateIn
      )
    )
  }
)

app.delete(
  "/relationships/:relationship_id",
  async (req: AuthRequest, res: Response) => {
    await store.deleteRelationship(
      await activeWorkspaceId(req, "write"),
      req.params["relationship_id"] as string
    )
    res.status(204).send()
  }
)

// Views
app.get("/views", async (req: AuthRequest, res: Response) => {
  res.json(await store.listViews(await activeWorkspaceId(req, "read")))
})

app.get("/views/:view_id", async (req: AuthRequest, res: Response) => {
  res.json(
    await store.getViewById(
      await activeWorkspaceId(req, "read"),
      req.params["view_id"] as string
    )
  )
})

app.post("/views", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ViewCreateSchema, req.body, res)
  if (!body) return
  res
    .status(201)
    .json(
      await store.createView(
        await activeWorkspaceId(req, "write"),
        body as ViewCreateIn
      )
    )
})

app.put("/views/:view_id", async (req: AuthRequest, res: Response) => {
  const body = parseBody(ViewUpdateSchema, req.body, res)
  if (!body) return
  res.json(
    await store.updateView(
      await activeWorkspaceId(req, "write"),
      req.params["view_id"] as string,
      body as ViewUpdateIn
    )
  )
})

app.delete("/views/:view_id", async (req: AuthRequest, res: Response) => {
  await store.deleteView(
    await activeWorkspaceId(req, "write"),
    req.params["view_id"] as string
  )
  res.status(204).send()
})

app.post("/views/:view_id/nodes", async (req: AuthRequest, res: Response) => {
  const body = parseBody(NodeCreateSchema, req.body, res)
  if (!body) return
  res
    .status(201)
    .json(
      await store.createNode(
        await activeWorkspaceId(req, "write"),
        req.params["view_id"] as string,
        body as NodeCreateIn
      )
    )
})

app.put(
  "/views/:view_id/nodes/:node_id",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(NodeUpdateSchema, req.body, res)
    if (!body) return
    res.json(
      await store.updateViewNode(
        await activeWorkspaceId(req, "write"),
        req.params["view_id"] as string,
        req.params["node_id"] as string,
        body as NodeUpdateIn
      )
    )
  }
)

app.delete(
  "/views/:view_id/nodes/:node_id",
  async (req: AuthRequest, res: Response) => {
    await store.deleteViewNode(
      await activeWorkspaceId(req, "write"),
      req.params["view_id"] as string,
      req.params["node_id"] as string
    )
    res.status(204).send()
  }
)

app.post(
  "/views/:view_id/connections",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(ConnectionCreateSchema, req.body, res)
    if (!body) return
    res
      .status(201)
      .json(
        await store.createViewConnection(
          await activeWorkspaceId(req, "write"),
          req.params["view_id"] as string,
          body as ConnectionCreateIn
        )
      )
  }
)

app.put(
  "/views/:view_id/connections/:conn_id",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(ConnectionUpdateSchema, req.body, res)
    if (!body) return
    res.json(
      await store.updateViewConnection(
        await activeWorkspaceId(req, "write"),
        req.params["view_id"] as string,
        req.params["conn_id"] as string,
        body as ConnectionUpdateIn
      )
    )
  }
)

app.delete(
  "/views/:view_id/connections/:conn_id",
  async (req: AuthRequest, res: Response) => {
    await store.deleteViewConnection(
      await activeWorkspaceId(req, "write"),
      req.params["view_id"] as string,
      req.params["conn_id"] as string
    )
    res.status(204).send()
  }
)

app.get("/views/:view_id/image", async (req: AuthRequest, res: Response) => {
  const format = (req.query["format"] as string) || "svg"
  if (format !== "svg") {
    res.status(422).json({
      detail:
        "Format invalide. Seul 'svg' est supporté côté serveur (l'export PNG se fait côté client).",
    })
    return
  }
  const model = await modelFromDb(await activeWorkspaceId(req, "read"))
  const view = model.views.find((v) => v.uuid === req.params["view_id"])
  if (!view) {
    res
      .status(404)
      .json({ detail: `Vue '${req.params["view_id"]}' introuvable.` })
    return
  }
  const svg = renderViewToSvg(view, model)
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8")
  res.send(svg)
})

// PropertyDefinitions
app.get("/property-definitions", async (req: AuthRequest, res: Response) => {
  res.json(
    await store.listPropertyDefinitions(await activeWorkspaceId(req, "read"))
  )
})

app.get(
  "/property-definitions/:id",
  async (req: AuthRequest, res: Response) => {
    res.json(
      await store.getPropertyDefinitionById(
        await activeWorkspaceId(req, "read"),
        req.params["id"] as string
      )
    )
  }
)

app.post("/property-definitions", async (req: AuthRequest, res: Response) => {
  const body = parseBody(PropertyDefinitionCreateSchema, req.body, res)
  if (!body) return
  res
    .status(201)
    .json(
      await store.createPropertyDefinition(
        await activeWorkspaceId(req, "write"),
        body as PropertyDefinitionCreateIn
      )
    )
})

app.put(
  "/property-definitions/:id",
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(PropertyDefinitionUpdateSchema, req.body, res)
    if (!body) return
    res.json(
      await store.updatePropertyDefinition(
        await activeWorkspaceId(req, "write"),
        req.params["id"] as string,
        body as PropertyDefinitionUpdateIn
      )
    )
  }
)

app.delete(
  "/property-definitions/:id",
  async (req: AuthRequest, res: Response) => {
    await store.deletePropertyDefinition(
      await activeWorkspaceId(req, "write"),
      req.params["id"] as string
    )
    res.status(204).send()
  }
)

// ---------------------------------------------------------------------------
// Global error handler — catches AppError subclasses + unknown errors
// ---------------------------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ detail: err.message })
    return
  }
  const msg = err instanceof Error ? err.message : "Erreur interne du serveur."
  res.status(500).json({ detail: msg })
})
