/**
 * Control-plane REST service: authentication, users, organizations, settings.
 *
 * Every request is authenticated (Keycloak `access_token` cookie/Bearer JWT,
 * verified via JWKS, or a personal API token, via `requireAuth`), its
 * organization/team membership resolved (`resolveWorkspaceContext`), and
 * write operations are gated to org owners/admins (`requireWorkspaceWrite`)
 * — all before anything reaches `apps/tenant-api`. Any request that doesn't
 * match a control-plane route below is reverse-proxied to `TENANT_API_URL`
 * with a short-lived inter-service JWT (`signTenantToken`, see
 * `@workspace/db`'s tenant-jwt.ts) carrying the resolved identity, workspace,
 * and — if the organization has an active dedicated database — the encrypted
 * tenant connection string. control-api never holds
 * `TENANT_DB_ENCRYPTION_KEY`; it only passes the ciphertext through.
 *
 * Routes:
 *   GET /me
 *   GET /organizations/members, PUT|DELETE /organizations/members/:userId
 *   GET|POST /organizations/invitations, DELETE /organizations/invitations/:invitationId
 *   GET|POST /organizations/teams, PUT|DELETE /organizations/teams/:teamId
 *   GET|POST /organizations/teams/:teamId/members, DELETE /organizations/teams/:teamId/members/:userId
 *   GET|POST /users, PUT|DELETE /users/:id
 *   GET /admin/organizations, POST /admin/organizations, PUT /admin/organizations/:id
 *   POST /admin/organizations/:id/verify-db, POST /admin/organizations/:id/reprovision
 *   GET /admin/neon/status
 *   GET /settings/redis
 *   GET /settings/postgres
 *   GET|POST /settings/api-tokens, DELETE /settings/api-tokens/:id
 *   GET|PUT /settings/messages
 *   *  -> proxied to TENANT_API_URL (workspaces, elements, relationships,
 *         views, property-definitions, export/import, openapi/docs, ...)
 *
 * Organization membership/roles (owner|admin|member) and invitations live in
 * Keycloak (Phasetwo Organizations extension, see @workspace/auth's orgs.ts);
 * teams/team members stay local, scoped to a Keycloak organization id.
 * Members with role "member" get read-only access (requireWorkspaceWrite).
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { Readable } from "node:stream";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "./redis.js";
import { AppError } from "./errors.js";
import { controlDb, apiTokens, siteSettings, getTenantConnectionStringEncrypted, signTenantToken, getNeonApiConfig, getDefaultBranchId, provisionTenantDatabase, verifyTenantDatabaseConnectivity, canProvisionLocally } from "@workspace/db";
import { ORG_ROLES, type OrgRoleName } from "@workspace/auth";
import { eq, sql } from "drizzle-orm";
import {
  listUsers,
  createUser as createUserFn,
  updateUserById,
  deleteUserById,
  listAdminOrganizations,
  setOrganizationEnabled,
  createOrganizationWithOwner,
  deleteOrganization,
  listOrgMembersOut,
  updateOrgMemberRole,
  removeOrgMemberById,
  listOrgInvitationsOut,
  createInvitation,
  cancelInvitation,
  listTeams,
  createTeam,
  updateTeam,
  removeTeam,
  listTeamMembersOut,
  addTeamMember,
  removeTeamMember,
  requireAuth,
  requireSuperAdmin,
  resolveWorkspaceContext,
  requireWorkspaceWrite,
  type AuthRequest,
} from "./auth.js";

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

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Trop de requêtes, réessayez dans 1 minute." },
  store: redisStore("rl:api:"),
  skip: (req) =>
    req.path === "/health" ||
    req.path === "/openapi.json" ||
    req.path === "/docs",
});

// Rate-limit all non-public routes before any DB-hitting middleware
app.use(apiRateLimit);

// Paths that don't require authentication or organization context.
// /openapi.json and /docs live in apps/tenant-api now but are proxied through
// here unauthenticated — tenant-api registers them before its own JWT check.
function isPublicPath(req: Request): boolean {
  return (
    req.path === "/openapi.json" ||
    req.path === "/docs" ||
    (req.path === "/settings/messages" && req.method === "GET")
  );
}

// Global auth — exempt public paths
app.use((req: AuthRequest, res, next) => {
  if (isPublicPath(req)) { next(); return; }
  requireAuth(req, res, next);
});

// Resolve the organization (and team memberships) the request operates in —
// used for workspace visibility, the write-permission check below, and the
// claims of the inter-service JWT forwarded to apps/tenant-api.
app.use(async (req: AuthRequest, res, next) => {
  if (isPublicPath(req)) { next(); return; }
  await resolveWorkspaceContext(req, res, next);
});

// Write operations (POST/PUT/DELETE) on workspace content are reserved for
// org owners/admins (platform super admins always pass); org members are
// read-only. Exempt /users and /settings/api-tokens (users manage their own
// tokens). This runs BEFORE the tenant-api proxy, so a read-only member's
// write request never reaches tenant-api.
app.use((req: AuthRequest, res, next) => {
  if (
    ["POST", "PUT", "DELETE"].includes(req.method) &&
    !req.path.startsWith("/users") &&
    !req.path.startsWith("/settings/api-tokens")
  ) {
    requireWorkspaceWrite(req, res, next);
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// User info endpoint — wraps the verified Keycloak access token's claims
// ---------------------------------------------------------------------------

app.get("/me", (req: AuthRequest, res: Response) => {
  res.json(req.user ?? null);
});

// ---------------------------------------------------------------------------
// Organization routes (current workspace) — members, invitations, teams
// ---------------------------------------------------------------------------

function parseOrgRole(value: unknown): OrgRoleName | null {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value) ? (value as OrgRoleName) : null;
}

app.get("/organizations/members", async (req: AuthRequest, res: Response) => {
  res.json(await listOrgMembersOut(req.workspace!.organizationId));
});

app.put("/organizations/members/:userId", async (req: AuthRequest, res: Response) => {
  const role = parseOrgRole((req.body as { role?: unknown }).role);
  if (!role) { res.status(422).json({ detail: `Le champ 'role' doit être l'un de : ${ORG_ROLES.join(", ")}.` }); return; }
  await updateOrgMemberRole(req.workspace!.organizationId, req.params["userId"] as string, role);
  res.json({ ok: true });
});

app.delete("/organizations/members/:userId", async (req: AuthRequest, res: Response) => {
  await removeOrgMemberById(req.workspace!.organizationId, req.params["userId"] as string);
  res.status(204).send();
});

app.get("/organizations/invitations", async (req: AuthRequest, res: Response) => {
  res.json(await listOrgInvitationsOut(req.workspace!.organizationId));
});

app.post("/organizations/invitations", async (req: AuthRequest, res: Response) => {
  const { email, role: roleInput } = req.body as { email?: unknown; role?: unknown };
  if (!email || typeof email !== "string" || !email.trim()) { res.status(422).json({ detail: "Le champ 'email' est requis." }); return; }
  const role = parseOrgRole(roleInput);
  if (!role) { res.status(422).json({ detail: `Le champ 'role' doit être l'un de : ${ORG_ROLES.join(", ")}.` }); return; }
  res.status(201).json(await createInvitation(req.workspace!.organizationId, email.trim(), role));
});

app.delete("/organizations/invitations/:invitationId", async (req: AuthRequest, res: Response) => {
  await cancelInvitation(req.workspace!.organizationId, req.params["invitationId"] as string);
  res.status(204).send();
});

app.get("/organizations/teams", async (req: AuthRequest, res: Response) => {
  res.json(await listTeams(req.workspace!.organizationId));
});

app.post("/organizations/teams", async (req: AuthRequest, res: Response) => {
  const { name } = req.body as { name?: unknown };
  if (!name || typeof name !== "string" || !name.trim()) { res.status(422).json({ detail: "Le champ 'name' est requis." }); return; }
  res.status(201).json(await createTeam(req.workspace!.organizationId, name.trim()));
});

app.put("/organizations/teams/:teamId", async (req: AuthRequest, res: Response) => {
  const { name } = req.body as { name?: unknown };
  if (!name || typeof name !== "string" || !name.trim()) { res.status(422).json({ detail: "Le champ 'name' est requis." }); return; }
  res.json(await updateTeam(req.workspace!.organizationId, req.params["teamId"] as string, name.trim()));
});

app.delete("/organizations/teams/:teamId", async (req: AuthRequest, res: Response) => {
  await removeTeam(req.workspace!.organizationId, req.params["teamId"] as string);
  res.status(204).send();
});

app.get("/organizations/teams/:teamId/members", async (req: AuthRequest, res: Response) => {
  res.json(await listTeamMembersOut(req.workspace!.organizationId, req.params["teamId"] as string));
});

app.post("/organizations/teams/:teamId/members", async (req: AuthRequest, res: Response) => {
  const { user_id } = req.body as { user_id?: unknown };
  if (!user_id || typeof user_id !== "string") { res.status(422).json({ detail: "Le champ 'user_id' est requis." }); return; }
  await addTeamMember(req.workspace!.organizationId, req.params["teamId"] as string, user_id);
  res.status(204).send();
});

app.delete("/organizations/teams/:teamId/members/:userId", async (req: AuthRequest, res: Response) => {
  await removeTeamMember(req.workspace!.organizationId, req.params["teamId"] as string, req.params["userId"] as string);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Users routes (platform admin only — provisioned via the Keycloak Admin API)
// ---------------------------------------------------------------------------

app.get("/users", requireSuperAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  res.json(await listUsers());
});

app.post("/users", requireSuperAdmin as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const { username, password, role } = req.body as { username?: unknown; password?: unknown; role?: unknown };
  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    res.status(422).json({ detail: "Les champs 'username' et 'password' sont requis." });
    return;
  }
  res.status(201).json(await createUserFn(username, password, typeof role === "string" ? role : "user"));
});

app.put("/users/:id", requireSuperAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { password, role } = req.body as { password?: unknown; role?: unknown };
  res.json(await updateUserById(req.params["id"] as string, {
    password: typeof password === "string" && password ? password : undefined,
    role: typeof role === "string" ? role : undefined,
  }));
});

app.delete("/users/:id", requireSuperAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  await deleteUserById(req.params["id"] as string);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Admin organizations routes (platform admin only)
// ---------------------------------------------------------------------------

app.get("/admin/organizations", requireSuperAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  res.json(await listAdminOrganizations());
});

app.put("/admin/organizations/:id", requireSuperAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled?: unknown };
  if (typeof enabled !== "boolean") {
    res.status(422).json({ detail: "Le champ 'enabled' (boolean) est requis." });
    return;
  }
  res.json(await setOrganizationEnabled(req.params["id"] as string, enabled));
});

app.get("/admin/neon/status", requireSuperAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  const config = getNeonApiConfig();
  if (config) {
    try {
      await getDefaultBranchId(config);
      res.json({ configured: true, reachable: true, provider: "neon" });
    } catch {
      res.json({ configured: true, reachable: false, provider: "neon" });
    }
    return;
  }
  if (canProvisionLocally()) {
    res.json({ configured: true, reachable: true, provider: "local" });
    return;
  }
  res.json({ configured: false, reachable: false, provider: "none" });
});

app.post("/admin/organizations", requireSuperAdmin as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const { name, slug, initial_owner_user_id } = req.body as { name?: unknown; slug?: unknown; initial_owner_user_id?: unknown };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  const trimmedName = name.trim();
  const trimmedSlug = typeof slug === "string" && slug.trim()
    ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    : trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const initialOwnerUserId = typeof initial_owner_user_id === "string" && initial_owner_user_id ? initial_owner_user_id : undefined;

  const neonConfig = getNeonApiConfig();
  if (neonConfig) {
    try {
      await getDefaultBranchId(neonConfig);
    } catch {
      res.status(503).json({ detail: "Neon inaccessible — impossible de créer l'organisation sans base de données dédiée." });
      return;
    }
  }

  const { org, generatedOwner } = await createOrganizationWithOwner(trimmedName, trimmedSlug, initialOwnerUserId);

  try {
    await provisionTenantDatabase(org.id);
  } catch (err) {
    await deleteOrganization(org.id).catch(() => {});
    if (generatedOwner) await deleteUserById(generatedOwner.userId).catch(() => {});
    res.status(503).json({ detail: `Échec du provisionnement de la base de données : ${(err as Error).message}` });
    return;
  }

  const all = await listAdminOrganizations();
  const updated = all.find(o => o.id === org.id);
  res.status(201).json({
    ...(updated ?? org),
    ...(generatedOwner ? { initial_owner: { username: generatedOwner.username, password: generatedOwner.password } } : {}),
  });
});

app.post("/admin/organizations/:id/verify-db", requireSuperAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const result = await verifyTenantDatabaseConnectivity(req.params["id"] as string);
  res.json(result);
});

app.post("/admin/organizations/:id/reprovision", requireSuperAdmin as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const id = req.params["id"] as string;
  try {
    await provisionTenantDatabase(id);
  } catch (err) {
    res.status(503).json({ detail: `Échec du reprovisionnement : ${(err as Error).message}` });
    return;
  }
  const all = await listAdminOrganizations();
  const org = all.find(o => o.id === id);
  if (!org) { res.status(404).json({ detail: "Organisation introuvable." }); return; }
  res.json(org);
});

// ---------------------------------------------------------------------------
// Redis status (admin only — read-only, config via REDIS_URL env var)
// ---------------------------------------------------------------------------

app.get("/settings/redis", requireSuperAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
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
// PostgreSQL status (admin only — read-only, config via DATABASE_URL env var)
// ---------------------------------------------------------------------------

app.get("/settings/postgres", requireSuperAdmin as express.RequestHandler, async (_req: Request, res: Response) => {
  const url = process.env["DATABASE_URL"];
  let host: string | null = null;
  let port: number | null = null;
  let database: string | null = null;
  if (url) {
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      port = parsed.port ? parseInt(parsed.port, 10) : 5432;
      database = parsed.pathname.replace(/^\//, "") || null;
    } catch { /* malformed URL */ }
  }

  try {
    const result = await controlDb.execute<{ version: string }>(sql`select version()`);
    res.json({ connected: true, host, port, database, version: result.rows[0]?.version ?? null });
  } catch {
    res.json({ connected: false, host, port, database, version: null });
  }
});

// ---------------------------------------------------------------------------
// API token routes (personal access tokens — any authenticated user)
// ---------------------------------------------------------------------------

app.get("/settings/api-tokens", requireAuth as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const cols = { id: apiTokens.id, name: apiTokens.name, userId: apiTokens.userId, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt, expiresAt: apiTokens.expiresAt };
  const rows = req.user?.role === "platform_admin"
    ? await controlDb.select(cols).from(apiTokens)
    : await controlDb.select(cols).from(apiTokens).where(eq(apiTokens.userId, req.user!.id));
  res.json(rows.map((r) => ({ id: r.id, name: r.name, user_id: r.userId, created_at: r.createdAt, last_used_at: r.lastUsedAt ?? null, expires_at: r.expiresAt ?? null })));
});

app.post("/settings/api-tokens", requireAuth as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const { name, expires_at } = req.body as { name?: unknown; expires_at?: unknown };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(422).json({ detail: "Le champ 'name' est requis." });
    return;
  }
  const expiresAt: number | undefined = (() => {
    if (expires_at === null || expires_at === undefined) return undefined;
    const v = typeof expires_at === "string" ? parseInt(expires_at, 10) : (typeof expires_at === "number" ? expires_at : NaN);
    return isNaN(v) ? undefined : v;
  })();
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const [row] = await controlDb.insert(apiTokens).values({ token, name: name.trim(), userId: req.user!.id, organizationId: req.workspace!.organizationId, expiresAt })
    .returning({ id: apiTokens.id, name: apiTokens.name, userId: apiTokens.userId, createdAt: apiTokens.createdAt, expiresAt: apiTokens.expiresAt });
  res.status(201).json({ id: row!.id, name: row!.name, user_id: row!.userId, created_at: row!.createdAt, expires_at: row!.expiresAt ?? null, token });
});

app.delete("/settings/api-tokens/:id", requireAuth as express.RequestHandler, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(422).json({ detail: "ID invalide." }); return; }
  const [existing] = await controlDb.select({ userId: apiTokens.userId }).from(apiTokens).where(eq(apiTokens.id, id));
  if (!existing) { res.status(404).json({ detail: "Token introuvable." }); return; }
  if (req.user?.role !== "platform_admin" && existing.userId !== req.user?.id) {
    res.status(403).json({ detail: "Accès refusé." }); return;
  }
  await controlDb.delete(apiTokens).where(eq(apiTokens.id, id));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Site messages — login message + banner (read: public; write: admin only)
// ---------------------------------------------------------------------------

app.get("/settings/messages", async (_req: Request, res: Response) => {
  const defaults = { login_message: null, login_message_enabled: false, banner_message: null, banner_message_enabled: false };
  try {
    const [row] = await controlDb.select().from(siteSettings).where(eq(siteSettings.id, 1));
    if (!row) { res.json(defaults); return; }
    res.json({
      login_message:          row.loginMessage ?? null,
      login_message_enabled:  row.loginMessageEnabled,
      banner_message:         row.bannerMessage ?? null,
      banner_message_enabled: row.bannerMessageEnabled,
    });
  } catch {
    res.json(defaults);
  }
});

app.put("/settings/messages", requireSuperAdmin as express.RequestHandler, async (req: Request, res: Response) => {
  const { login_message, login_message_enabled, banner_message, banner_message_enabled } =
    req.body as Record<string, unknown>;
  const vals = {
    id:                   1 as const,
    loginMessage:         typeof login_message === "string" ? login_message || null : null,
    loginMessageEnabled:  Boolean(login_message_enabled),
    bannerMessage:        typeof banner_message === "string" ? banner_message || null : null,
    bannerMessageEnabled: Boolean(banner_message_enabled),
    updatedAt:            sql`extract(epoch from now())::int`,
  };
  await controlDb.insert(siteSettings).values(vals).onConflictDoUpdate({
    target: siteSettings.id,
    set: { loginMessage: vals.loginMessage, loginMessageEnabled: vals.loginMessageEnabled, bannerMessage: vals.bannerMessage, bannerMessageEnabled: vals.bannerMessageEnabled, updatedAt: vals.updatedAt },
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Reverse proxy to apps/tenant-api — everything else (workspaces, elements,
// relationships, views, property-definitions, export/import, openapi/docs).
// ---------------------------------------------------------------------------

const NON_FORWARDED_RESPONSE_HEADERS = new Set(["content-encoding", "transfer-encoding", "connection"]);

app.use(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const base = process.env["TENANT_API_URL"];
  if (!base) { next(new AppError("TENANT_API_URL non configuré.", 500)); return; }

  const headers = new Headers();
  // req.user/req.workspace are set together by requireAuth + resolveWorkspaceContext
  // above, skipped only for public paths (openapi/docs) — those forward with no token.
  if (req.user) {
    const tenantDb = await getTenantConnectionStringEncrypted(req.workspace!.organizationId);
    const token = signTenantToken({
      sub: req.user.id,
      username: req.user.username,
      platform_role: req.user.role,
      organization_id: req.workspace!.organizationId,
      org_role: req.workspace!.orgRole,
      team_ids: req.workspace!.teamIds,
      tenant_db: tenantDb,
    });
    headers.set("authorization", `Bearer ${token}`);
  }

  const contentType = req.headers["content-type"];
  if (contentType) headers.set("content-type", contentType);

  let body: BodyInit | undefined;
  let duplex: "half" | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    if (contentType?.startsWith("application/json")) {
      // express.json() already consumed the request stream and parsed req.body.
      body = JSON.stringify(req.body);
    } else {
      // Not application/json — express.json() left the stream untouched
      // (multipart uploads for /import, raw XML bodies, or no body at all).
      body = Readable.toWeb(req) as ReadableStream;
      duplex = "half";
    }
  }

  try {
    const init: RequestInit & { duplex?: "half" } = { method: req.method, headers, body, duplex };
    const upstream = await fetch(new URL(req.originalUrl, base), init);
    res.status(upstream.status);
    for (const [key, value] of upstream.headers) {
      if (!NON_FORWARDED_RESPONSE_HEADERS.has(key)) res.setHeader(key, value);
    }
    if (upstream.body) Readable.fromWeb(upstream.body as never).pipe(res);
    else res.end();
  } catch (err) { next(err); }
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
