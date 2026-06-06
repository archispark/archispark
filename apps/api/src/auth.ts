import { randomUUID, randomBytes, scrypt } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, users as usersTable, accounts, roles as rolesTable, roleLayerPermissions as rolePermsTable, userRoles as userRolesTable, apiTokens } from "@workspace/db";
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
// ArchiMate layer/permission constants
// ---------------------------------------------------------------------------

export const ARCHIMATE_LAYERS = [
  "Strategy",
  "Business",
  "Application",
  "Technology",
  "Motivation",
  "Physical",
  "Implementation",
  "Composite",
  "Relations",
  "Views",
] as const;
export type ArchiLayer = typeof ARCHIMATE_LAYERS[number];

export const PERMISSION_FLAGS = ["read", "create", "update", "delete"] as const;
export type PermissionFlag = typeof PERMISSION_FLAGS[number];
export type LayerPermissions = PermissionFlag[];

export const ALL_PERMISSIONS: LayerPermissions = ["read", "create", "update", "delete"];
export const READ_ONLY_PERMISSIONS: LayerPermissions = ["read"];
export const NO_PERMISSIONS: LayerPermissions = [];
export type LayerRole = string;

// Bit flag mapping: read=1, create=2, update=4, delete=8
const PERM_BIT: Record<PermissionFlag, number> = { read: 1, create: 2, update: 4, delete: 8 };

export function parsePermissions(bits: number): LayerPermissions {
  return PERMISSION_FLAGS.filter((f) => (bits & PERM_BIT[f]) !== 0);
}

export function serializePermissions(perms: LayerPermissions): number {
  return [...new Set(perms)].reduce((acc, f) => acc | (PERM_BIT[f] ?? 0), 0);
}

export function permissionHasFlag(bits: number, flag: PermissionFlag): boolean {
  return (bits & PERM_BIT[flag]) !== 0;
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

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
}

// ---------------------------------------------------------------------------
// Bootstrap: RBAC tables + default system roles + seed users
// ---------------------------------------------------------------------------

export async function initUsers(): Promise<void> {
  // All tables (model, RBAC, Better Auth) are created by runMigrations()
  // from the drizzle-pg/ folder before this runs.
  const now = Math.floor(Date.now() / 1000);

  // Seed system RBAC roles (idempotent via onConflictDoNothing)
  const adminRoleId = randomUUID();
  await db.insert(rolesTable).values({ id: adminRoleId, name: "admin", description: "Accès complet à toutes les couches.", isSystem: true, createdAt: now }).onConflictDoNothing();
  const [adminRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "admin"));

  const userRoleId = randomUUID();
  await db.insert(rolesTable).values({ id: userRoleId, name: "user", description: "Lecture seule sur toutes les couches.", isSystem: true, createdAt: now }).onConflictDoNothing();
  const [userRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "user"));

  // Ensure all layers have permissions for both system roles (upsert: add missing, preserve existing)
  for (const layer of ARCHIMATE_LAYERS) {
    if (adminRole) {
      await db.insert(rolePermsTable).values({ roleId: adminRole.id, layer, permission: serializePermissions(ALL_PERMISSIONS) }).onConflictDoNothing();
    }
    if (userRole) {
      await db.insert(rolePermsTable).values({ roleId: userRole.id, layer, permission: serializePermissions(READ_ONLY_PERMISSIONS) }).onConflictDoNothing();
    }
  }

  // Seed default users
  const seedUser = async (username: string, password: string, role: "admin" | "user") => {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
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
      await db.update(accounts).set({ password: hash }).where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
    }
    await db.update(usersTable).set({ username, role }).where(eq(usersTable.id, userId!));
    const [rbacRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, role));
    if (rbacRole) {
      await db.insert(userRolesTable).values({ roleId: rbacRole.id, userId: userId! }).onConflictDoNothing();
    }
  };

  const adminPwd = process.env["SEED_ADMIN_PASSWORD"] || "admin";
  const userPwd  = process.env["SEED_USER_PASSWORD"]  || "user";
  await seedUser("admin", adminPwd, "admin");
  await seedUser("user",  userPwd,  "user");
  if (!process.env["SEED_ADMIN_PASSWORD"]) {
    console.warn("[auth] SEED_ADMIN_PASSWORD not set — using default 'admin'. Set it in production!");
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
  const rows = await db.select().from(usersTable);
  return rows.map(rowToOut);
}

export async function createUser(username: string, password: string, role: string = "user"): Promise<UserOut> {
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existing) throw new ValidationError(`Le nom d'utilisateur '${username}' est déjà pris.`);
  const res = await getAuth().api.signUpEmail({
    body: { email: `${username}@archispark.internal`, password, name: username, username } as never,
  /* v8 ignore next */ }).catch(() => null);
  if (!res?.user) throw new ValidationError("Impossible de créer l'utilisateur.");
  const validRole: "admin" | "user" = role === "admin" ? "admin" : "user";
  await db.update(usersTable).set({ username, role: validRole }).where(eq(usersTable.id, res.user.id));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, res.user.id));
  if (!user) throw new ValidationError("Utilisateur introuvable après création.");
  return rowToOut(user);
}

export async function updateUserById(id: string, updates: { password?: string; role?: string }): Promise<UserOut> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) throw new NotFoundError(`Utilisateur '${id}' introuvable.`);
  const now = new Date();
  if (updates.role !== undefined) {
    const validRole: "admin" | "user" = updates.role === "admin" ? "admin" : "user";
    await db.update(usersTable).set({ role: validRole, updatedAt: now }).where(eq(usersTable.id, id));
  }
  if (updates.password) {
    const hash = await hashPassword(updates.password);
    await db.update(accounts).set({ password: hash, updatedAt: now })
      .where(and(eq(accounts.userId, id), eq(accounts.providerId, "credential")));
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return rowToOut(user!);
}

export async function deleteUserById(id: string): Promise<void> {
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id));
  if (!existing) throw new NotFoundError(`Utilisateur '${id}' introuvable.`);
  await db.delete(usersTable).where(eq(usersTable.id, id));
}

// ---------------------------------------------------------------------------
// API token lookup (used by REST middleware and MCP server)
// ---------------------------------------------------------------------------

export interface TokenUser { id: string; username: string; role: string }

export async function lookupApiToken(token: string): Promise<TokenUser | null> {
  const [row] = await db.select({ id: apiTokens.id, userId: apiTokens.userId, expiresAt: apiTokens.expiresAt })
    .from(apiTokens).where(eq(apiTokens.token, token));
  if (!row) return null;
  if (row.expiresAt !== null && row.expiresAt < Math.floor(Date.now() / 1000)) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, row.userId));
  if (!user) return null;
  db.update(apiTokens).set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(apiTokens.id, row.id)).catch(() => {});
  return { id: user.id, username: user.username, role: user.role };
}

// ---------------------------------------------------------------------------
// Middleware — uses Better Auth session (httpOnly cookie) or API Bearer token
// ---------------------------------------------------------------------------

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    lookupApiToken(authHeader.slice(7).trim())
      .then((tokenUser) => {
        if (!tokenUser) { res.status(401).json({ detail: "Token invalide." }); return; }
        req.user = tokenUser;
        next();
      })
      .catch(() => { res.status(401).json({ detail: "Erreur d'authentification." }); });
    return;
  }
  getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session: { user: { id: string; name: string; email?: string | null; [k: string]: unknown } } | null) => {
      if (!session?.user) {
        res.status(401).json({ detail: "Non authentifié." });
        return;
      }
      req.user = {
        id: session.user.id,
        username: (session.user as unknown as { username?: string }).username ?? session.user.name,
        role: (session.user as unknown as { role?: string }).role ?? "user",
      };
      next();
    })
    .catch(() => {
      res.status(401).json({ detail: "Session invalide." });
    });
}

export { userHasPermission };

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ detail: "Accès réservé aux administrateurs." });
      return;
    }
    next();
  });
}

async function userHasPermission(userId: string, baRole: string, resource: string, flag: PermissionFlag): Promise<boolean> {
  if (baRole === "admin") return true;
  const rows = await db
    .select({ permission: rolePermsTable.permission })
    .from(userRolesTable)
    .innerJoin(rolePermsTable, and(eq(rolePermsTable.roleId, userRolesTable.roleId), eq(rolePermsTable.layer, resource)))
    .where(eq(userRolesTable.userId, userId));
  return rows.some(({ permission }) => permissionHasFlag(permission, flag));
}

export function requirePermission(resource: string, flag: PermissionFlag) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ detail: "Non authentifié." }); return; }
    /* v8 ignore next 4 */
    if (!(await userHasPermission(req.user.id, req.user.role, resource, flag))) {
      console.warn(`[security] permission denied user=${req.user.id} role=${req.user.role} layer=${resource} flag=${flag} path=${req.path}`);
      res.status(403).json({ detail: `Permission '${flag}' requise sur '${resource}'.` });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// RBAC roles (ArchiMate layer permissions)
// ---------------------------------------------------------------------------

export interface RoleOut {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  permissions: Record<ArchiLayer, LayerPermissions>;
  user_ids: string[];
}

function emptyPermissions(): Record<ArchiLayer, LayerPermissions> {
  return Object.fromEntries(ARCHIMATE_LAYERS.map((l) => [l, [] as LayerPermissions])) as Record<ArchiLayer, LayerPermissions>;
}

async function rolePermissions(roleId: string): Promise<Record<ArchiLayer, LayerPermissions>> {
  const rows = await db.select().from(rolePermsTable).where(eq(rolePermsTable.roleId, roleId));
  const result = emptyPermissions();
  for (const r of rows) {
    if ((ARCHIMATE_LAYERS as readonly string[]).includes(r.layer)) {
      result[r.layer as ArchiLayer] = parsePermissions(r.permission);
    }
  }
  return result;
}

async function roleUsers(roleId: string): Promise<string[]> {
  const rows = await db.select({ userId: userRolesTable.userId }).from(userRolesTable).where(eq(userRolesTable.roleId, roleId));
  return rows.map((r) => r.userId);
}

function buildRoleOut(
  r: typeof rolesTable.$inferSelect,
  permMap: Map<string, Record<ArchiLayer, LayerPermissions>>,
  userMap: Map<string, string[]>,
): RoleOut {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    is_system: Boolean(r.isSystem),
    created_at: new Date(r.createdAt * 1000).toISOString(),
    permissions: permMap.get(r.id) ?? emptyPermissions(),
    user_ids: userMap.get(r.id) ?? [],
  };
}

async function roleOut(r: typeof rolesTable.$inferSelect): Promise<RoleOut> {
  const [perms, uids] = await Promise.all([rolePermissions(r.id), roleUsers(r.id)]);
  const permMap = new Map([[r.id, perms]]);
  const userMap = new Map([[r.id, uids]]);
  return buildRoleOut(r, permMap, userMap);
}

export async function listRoles(): Promise<RoleOut[]> {
  const rows = await db.select().from(rolesTable);
  if (rows.length === 0) return [];
  const roleIds = rows.map((r) => r.id);
  // Batch: 2 queries for all roles instead of 2N
  const [allPerms, allUsers] = await Promise.all([
    db.select().from(rolePermsTable).where(inArray(rolePermsTable.roleId, roleIds)),
    db.select({ roleId: userRolesTable.roleId, userId: userRolesTable.userId }).from(userRolesTable).where(inArray(userRolesTable.roleId, roleIds)),
  ]);
  const permMap = new Map<string, Record<ArchiLayer, LayerPermissions>>();
  for (const r of rows) permMap.set(r.id, emptyPermissions());
  for (const p of allPerms) {
    if ((ARCHIMATE_LAYERS as readonly string[]).includes(p.layer)) {
      permMap.get(p.roleId)![p.layer as ArchiLayer] = parsePermissions(p.permission);
    }
  }
  const userMap = new Map<string, string[]>();
  for (const r of rows) userMap.set(r.id, []);
  for (const u of allUsers) userMap.get(u.roleId)?.push(u.userId);
  return rows.map((r) => buildRoleOut(r, permMap, userMap));
}

export async function getRole(roleId: string): Promise<RoleOut> {
  const [r] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!r) throw new NotFoundError(`Rôle '${roleId}' introuvable.`);
  return roleOut(r);
}

export async function createRole(name: string, description?: string | null, permissions?: Partial<Record<ArchiLayer, LayerPermissions>>): Promise<RoleOut> {
  if (!name?.trim()) throw new Error("Le nom du rôle est requis.");
  const [existing] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, name.trim()));
  if (existing) throw new Error("Ce nom de rôle est déjà pris.");
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(rolesTable).values({ id, name: name.trim(), description: description ?? null, isSystem: false, createdAt: now });
  if (permissions) await setRolePermissions(id, permissions);
  return getRole(id);
}

export async function updateRole(roleId: string, updates: { name?: string; description?: string | null; permissions?: Partial<Record<ArchiLayer, LayerPermissions>> }): Promise<RoleOut> {
  const [r] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!r) throw new Error(`Rôle '${roleId}' introuvable.`);
  const patch: Partial<typeof rolesTable.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.description !== undefined) patch.description = updates.description;
  if (Object.keys(patch).length > 0) {
    await db.update(rolesTable).set(patch).where(eq(rolesTable.id, roleId));
  }
  if (updates.permissions) await setRolePermissions(roleId, updates.permissions);
  return getRole(roleId);
}

export async function deleteRole(roleId: string): Promise<void> {
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  if (role.isSystem) throw new Error("Les rôles système ne peuvent pas être supprimés.");
  await db.delete(rolesTable).where(eq(rolesTable.id, roleId));
}

export async function setRolePermissions(roleId: string, perms: Partial<Record<ArchiLayer, LayerPermissions>>): Promise<void> {
  for (const [layer, flags] of Object.entries(perms)) {
    if (!flags) continue;
    if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) continue;
    const serialized = serializePermissions(flags);
    await db.insert(rolePermsTable).values({ roleId, layer, permission: serialized })
      .onConflictDoUpdate({ target: [rolePermsTable.roleId, rolePermsTable.layer], set: { permission: serialized } });
  }
}

export async function getRoleLayerPermission(roleId: string, layer: string): Promise<LayerPermissions> {
  if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) throw new Error(`Layer invalide: ${layer}`);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  const [row] = await db.select().from(rolePermsTable)
    .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)));
  return parsePermissions(row?.permission ?? 0);
}

export async function setRoleLayerPermission(roleId: string, layer: string, permissions: LayerPermissions): Promise<LayerPermissions> {
  if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) throw new Error(`Layer invalide: ${layer}`);
  if (!["none", "read", "write", "admin"].includes(permissions as unknown as string) && !Array.isArray(permissions)) throw new Error("Permissions invalides.");
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  if (role.isSystem) throw new Error("Les permissions des rôles système ne peuvent pas être modifiées.");
  const serialized = serializePermissions(permissions);
  await db.insert(rolePermsTable).values({ roleId, layer, permission: serialized })
    .onConflictDoUpdate({ target: [rolePermsTable.roleId, rolePermsTable.layer], set: { permission: serialized } });
  return permissions;
}

export async function removeRoleLayerPermission(roleId: string, layer: string): Promise<void> {
  if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) throw new Error(`Layer invalide: ${layer}`);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  await db.delete(rolePermsTable)
    .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)));
}

export async function assignUserToRole(roleId: string, userId: string): Promise<void> {
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId));
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) throw new Error(`Utilisateur '${userId}' introuvable.`);
  await db.insert(userRolesTable).values({ roleId, userId }).onConflictDoNothing();
}

export async function unassignUserFromRole(roleId: string, userId: string): Promise<void> {
  const [deleted] = await db.delete(userRolesTable)
    .where(and(eq(userRolesTable.roleId, roleId), eq(userRolesTable.userId, userId)))
    .returning({ roleId: userRolesTable.roleId });
  if (!deleted) throw new Error("Association introuvable.");
}

export async function listRolesForUser(userId: string): Promise<RoleOut[]> {
  const rows = await db.select({ roleId: userRolesTable.roleId }).from(userRolesTable).where(eq(userRolesTable.userId, userId));
  return Promise.all(rows.map((r) => getRole(r.roleId)));
}
