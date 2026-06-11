import { randomUUID, randomBytes, scrypt } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import {
  controlDb,
  users as usersTable,
  accounts,
  apiTokens,
  organizations as organizationsTable,
  members as membersTable,
  teams as teamsTable,
  teamMembers as teamMembersTable,
} from "@workspace/db";
import { getAuth } from "./better-auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { NotFoundError, ValidationError } from "./errors.js";

// Same scrypt parameters as @better-auth/utils/password
function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }, (err, key) => {
      if (err) reject(err); else resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserOut {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

/** Resolved organization membership for the current request (attached by resolveWorkspaceContext). */
export interface WorkspaceContext {
  organizationId: string;
  orgRole: string; // "owner" | "admin" | "member"
  teamIds: string[];
}

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
  /** Set by requireAuth for Bearer-token requests (api_tokens row). */
  tokenContext?: { organizationId: string; workspaceId: number | null };
  /** Set by requireAuth for session requests (Better Auth org plugin). */
  sessionActiveOrgId?: string | null;
  /** Set by resolveWorkspaceContext. */
  workspace?: WorkspaceContext;
}

// ---------------------------------------------------------------------------
// Bootstrap: seed default users + a default organization for fresh installs
// ---------------------------------------------------------------------------

export async function initUsers(): Promise<void> {
  // All tables (model + Better Auth) are created by runMigrations()
  // from the drizzle-pg/ folder before this runs.
  const now = new Date();

  // Seed default users
  const seedUser = async (username: string, password: string, role: "platform_admin" | "user") => {
    const [existing] = await controlDb.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
    let userId: string | null = existing?.id ?? null;
    if (!userId) {
      const res = await getAuth().api.signUpEmail({
        body: { email: `${username}@archispark.internal`, password, name: username, username } as never,
      }).catch((err: unknown) => { console.error(`[auth] signUpEmail failed for '${username}':`, err); return null; });
      if (!res?.user) return;
      userId = res.user.id;
    } else {
      // Always sync the password so SEED_*_PASSWORD changes take effect on restart
      const hash = await hashPassword(password);
      await controlDb.update(accounts).set({ password: hash }).where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
    }
    await controlDb.update(usersTable).set({ username, role }).where(eq(usersTable.id, userId!));
    return userId!;
  };

  const adminPwd = process.env["SEED_ADMIN_PASSWORD"] || "admin";
  const userPwd  = process.env["SEED_USER_PASSWORD"]  || "user";
  const adminId = await seedUser("admin", adminPwd, "platform_admin");
  const userId  = await seedUser("user",  userPwd,  "user");
  if (!process.env["SEED_ADMIN_PASSWORD"]) {
    console.warn("[auth] SEED_ADMIN_PASSWORD not set — using default 'admin'. Set it in production!");
  }

  // Ensure at least one organization exists, and that the seed users belong to it.
  const [anyOrg] = await controlDb.select({ id: organizationsTable.id }).from(organizationsTable).orderBy(organizationsTable.createdAt).limit(1);
  let orgId = anyOrg?.id;
  if (!orgId) {
    orgId = "default-org";
    await controlDb.insert(organizationsTable).values({ id: orgId, name: "Default", slug: "default", createdAt: now }).onConflictDoNothing();
  }
  if (adminId) {
    await controlDb.insert(membersTable).values({ id: randomUUID(), organizationId: orgId, userId: adminId, role: "owner", createdAt: now }).onConflictDoNothing();
  }
  if (userId) {
    await controlDb.insert(membersTable).values({ id: randomUUID(), organizationId: orgId, userId, role: "member", createdAt: now }).onConflictDoNothing();
  }

  console.log("[auth] Better Auth users ready.");
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

function rowToOut(r: typeof usersTable.$inferSelect): UserOut {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    created_at: (r.createdAt instanceof Date ? r.createdAt : new Date((r.createdAt as number) * 1000)).toISOString(),
  };
}

export async function listUsers(): Promise<UserOut[]> {
  const rows = await controlDb.select().from(usersTable);
  return rows.map(rowToOut);
}

/**
 * Create a platform user. When `organizationId` is given, the new user is
 * also added as a member of that organization (owner if `role === "platform_admin"`,
 * member otherwise) so they can immediately access its workspaces.
 */
export async function createUser(username: string, password: string, role: string = "user", organizationId?: string): Promise<UserOut> {
  const [existing] = await controlDb.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existing) throw new ValidationError(`Le nom d'utilisateur '${username}' est déjà pris.`);
  const res = await getAuth().api.signUpEmail({
    body: { email: `${username}@archispark.internal`, password, name: username, username } as never,
  /* v8 ignore next */ }).catch(() => null);
  if (!res?.user) throw new ValidationError("Impossible de créer l'utilisateur.");
  const validRole: "platform_admin" | "user" = role === "platform_admin" ? "platform_admin" : "user";
  await controlDb.update(usersTable).set({ username, role: validRole }).where(eq(usersTable.id, res.user.id));
  if (organizationId) {
    await controlDb.insert(membersTable).values({
      id: randomUUID(),
      organizationId,
      userId: res.user.id,
      role: validRole === "platform_admin" ? "owner" : "member",
      createdAt: new Date(),
    }).onConflictDoNothing();
  }
  const [user] = await controlDb.select().from(usersTable).where(eq(usersTable.id, res.user.id));
  if (!user) throw new ValidationError("Utilisateur introuvable après création.");
  return rowToOut(user);
}

export async function updateUserById(id: string, updates: { password?: string; role?: string }): Promise<UserOut> {
  const [existing] = await controlDb.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) throw new NotFoundError(`Utilisateur '${id}' introuvable.`);
  const now = new Date();
  if (updates.role !== undefined) {
    const validRole: "platform_admin" | "user" = updates.role === "platform_admin" ? "platform_admin" : "user";
    await controlDb.update(usersTable).set({ role: validRole, updatedAt: now }).where(eq(usersTable.id, id));
  }
  if (updates.password) {
    const hash = await hashPassword(updates.password);
    await controlDb.update(accounts).set({ password: hash, updatedAt: now })
      .where(and(eq(accounts.userId, id), eq(accounts.providerId, "credential")));
  }
  const [user] = await controlDb.select().from(usersTable).where(eq(usersTable.id, id));
  return rowToOut(user!);
}

export async function deleteUserById(id: string): Promise<void> {
  const [existing] = await controlDb.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id));
  if (!existing) throw new NotFoundError(`Utilisateur '${id}' introuvable.`);
  await controlDb.delete(usersTable).where(eq(usersTable.id, id));
}

// ---------------------------------------------------------------------------
// API token lookup (used by REST middleware and MCP server)
// ---------------------------------------------------------------------------

export interface TokenUser {
  id: string;
  username: string;
  role: string;
  organizationId: string;
  workspaceId: number | null;
}

export async function lookupApiToken(token: string): Promise<TokenUser | null> {
  const [row] = await controlDb.select({
    id: apiTokens.id,
    userId: apiTokens.userId,
    expiresAt: apiTokens.expiresAt,
    organizationId: apiTokens.organizationId,
    workspaceId: apiTokens.workspaceId,
  }).from(apiTokens).where(eq(apiTokens.token, token));
  if (!row) return null;
  if (row.expiresAt !== null && row.expiresAt < Math.floor(Date.now() / 1000)) return null;
  const [user] = await controlDb.select().from(usersTable).where(eq(usersTable.id, row.userId));
  if (!user) return null;
  controlDb.update(apiTokens).set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(apiTokens.id, row.id)).catch(() => {});
  return { id: user.id, username: user.username, role: user.role, organizationId: row.organizationId, workspaceId: row.workspaceId };
}

// ---------------------------------------------------------------------------
// Membership helpers
// ---------------------------------------------------------------------------

/** Org role + team memberships for a user within a given organization, or null if not a member. */
export async function getMembershipContext(userId: string, organizationId: string): Promise<WorkspaceContext | null> {
  const [member] = await controlDb.select({ role: membersTable.role }).from(membersTable)
    .where(and(eq(membersTable.organizationId, organizationId), eq(membersTable.userId, userId)));
  if (!member) return null;
  const teamRows = await controlDb.select({ teamId: teamMembersTable.teamId })
    .from(teamMembersTable)
    .innerJoin(teamsTable, eq(teamsTable.id, teamMembersTable.teamId))
    .where(and(eq(teamMembersTable.userId, userId), eq(teamsTable.organizationId, organizationId)));
  return { organizationId, orgRole: member.role, teamIds: teamRows.map((r) => r.teamId) };
}

// ---------------------------------------------------------------------------
// Middleware — uses Better Auth session (httpOnly cookie) or API Bearer token
// ---------------------------------------------------------------------------

interface SessionResult {
  user: { id: string; name: string; email?: string | null; [k: string]: unknown };
  session: { activeOrganizationId?: string | null; [k: string]: unknown };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    lookupApiToken(authHeader.slice(7).trim())
      .then((tokenUser) => {
        if (!tokenUser) { res.status(401).json({ detail: "Token invalide." }); return; }
        req.user = { id: tokenUser.id, username: tokenUser.username, role: tokenUser.role };
        req.tokenContext = { organizationId: tokenUser.organizationId, workspaceId: tokenUser.workspaceId };
        next();
      })
      .catch(() => { res.status(401).json({ detail: "Erreur d'authentification." }); });
    return;
  }
  getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session: SessionResult | null) => {
      if (!session?.user) {
        res.status(401).json({ detail: "Non authentifié." });
        return;
      }
      req.user = {
        id: session.user.id,
        username: (session.user as unknown as { username?: string }).username ?? session.user.name,
        role: (session.user as unknown as { role?: string }).role ?? "user",
      };
      req.sessionActiveOrgId = session.session?.activeOrganizationId ?? null;
      next();
    })
    .catch(() => {
      res.status(401).json({ detail: "Session invalide." });
    });
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "platform_admin") {
      res.status(403).json({ detail: "Accès réservé aux administrateurs." });
      return;
    }
    next();
  });
}

/**
 * Resolves the organization (and team memberships) the current request
 * operates in, attaching it to `req.workspace`. The active organization comes
 * from the API token, the session's active organization, or — failing that —
 * the user's first organization membership.
 */
export async function resolveWorkspaceContext(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ detail: "Non authentifié." }); return; }

  let organizationId = req.tokenContext?.organizationId ?? req.sessionActiveOrgId ?? null;

  if (!organizationId) {
    const [m] = await controlDb.select({ organizationId: membersTable.organizationId }).from(membersTable)
      .where(eq(membersTable.userId, req.user.id)).limit(1);
    organizationId = m?.organizationId ?? null;
  }

  if (!organizationId) {
    res.status(403).json({ detail: "Aucune organisation associée à cet utilisateur." });
    return;
  }

  const ctx = await getMembershipContext(req.user.id, organizationId);
  if (!ctx) {
    res.status(403).json({ detail: "Accès à cette organisation refusé." });
    return;
  }

  req.workspace = ctx;
  next();
}

/** Blocks write requests for org members (read-only). Super admins always pass. */
export function requireWorkspaceWrite(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role === "platform_admin") { next(); return; }
  if (req.workspace?.orgRole === "member") {
    res.status(403).json({ detail: "Accès en lecture seule : modification réservée aux administrateurs et propriétaires de l'organisation." });
    return;
  }
  next();
}
