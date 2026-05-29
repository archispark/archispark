import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, sqlite, users as usersTable, roles as rolesTable, roleLayerPermissions as rolePermsTable, userRoles as userRolesTable } from "@workspace/db";
import { auth } from "./better-auth.js";
import { fromNodeHeaders } from "better-auth/node";

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

function parsePermissions(raw: string): LayerPermissions {
  if (!raw) return [];
  return raw.split(",").filter((p): p is PermissionFlag => (PERMISSION_FLAGS as readonly string[]).includes(p));
}

function serializePermissions(perms: LayerPermissions): string {
  return [...new Set(perms)].filter((p) => (PERMISSION_FLAGS as readonly string[]).includes(p)).join(",");
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
  // Better Auth tables (not in Drizzle migrations — created at runtime)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      username TEXT NOT NULL,
      display_username TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      banned INTEGER,
      ban_reason TEXT,
      ban_expires INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_username_uniq ON "user"(username);

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS session_token_uniq ON session(token);

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  // RBAC tables (not managed by Drizzle migrations)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      is_system   INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS roles_name_uniq ON roles(name);
    CREATE TABLE IF NOT EXISTS role_layer_permissions (
      role_id    TEXT NOT NULL,
      layer      TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (role_id, layer),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      role_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (role_id, user_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
  `);
  try { sqlite.exec(`ALTER TABLE roles ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }

  const now = Math.floor(Date.now() / 1000);

  // Seed system RBAC roles
  const existingAdmin = db.select().from(rolesTable).where(eq(rolesTable.name, "admin")).get();
  if (!existingAdmin) {
    const adminRoleId = randomUUID();
    db.insert(rolesTable).values({ id: adminRoleId, name: "admin", description: "Accès complet à toutes les couches.", isSystem: true, createdAt: now }).run();
    for (const layer of ARCHIMATE_LAYERS) {
      db.insert(rolePermsTable).values({ roleId: adminRoleId, layer, permission: serializePermissions(ALL_PERMISSIONS) }).run();
    }
  }
  const existingUser = db.select().from(rolesTable).where(eq(rolesTable.name, "user")).get();
  if (!existingUser) {
    const userRoleId = randomUUID();
    db.insert(rolesTable).values({ id: userRoleId, name: "user", description: "Lecture seule sur toutes les couches.", isSystem: true, createdAt: now }).run();
    for (const layer of ARCHIMATE_LAYERS) {
      db.insert(rolePermsTable).values({ roleId: userRoleId, layer, permission: serializePermissions(READ_ONLY_PERMISSIONS) }).run();
    }
  }

  // Idempotent migration: ensure system roles have entries for ALL current layers
  for (const [roleName, defaultPerms] of [["admin", ALL_PERMISSIONS], ["user", READ_ONLY_PERMISSIONS]] as const) {
    const sysRole = db.select().from(rolesTable).where(eq(rolesTable.name, roleName)).get();
    if (!sysRole) continue;
    for (const layer of ARCHIMATE_LAYERS) {
      const exists = db.select({ roleId: rolePermsTable.roleId }).from(rolePermsTable)
        .where(and(eq(rolePermsTable.roleId, sysRole.id), eq(rolePermsTable.layer, layer)))
        .get();
      if (!exists) {
        db.insert(rolePermsTable).values({ roleId: sysRole.id, layer, permission: serializePermissions(defaultPerms) }).run();
      }
    }
  }

  // Seed default users if missing (sequential to avoid UNIQUE race, idempotent per username)
  const seedUser = async (username: string, password: string, role: "admin" | "user") => {
    const existing = db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).get();
    if (existing) {
      // Ensure user is assigned to matching RBAC role even if previously seeded without it
      const rbacRole = db.select().from(rolesTable).where(eq(rolesTable.name, role)).get();
      if (rbacRole) {
        const linked = db.select().from(userRolesTable)
          .where(and(eq(userRolesTable.roleId, rbacRole.id), eq(userRolesTable.userId, existing.id)))
          .get();
        if (!linked) db.insert(userRolesTable).values({ roleId: rbacRole.id, userId: existing.id }).run();
      }
      return;
    }
    const res = await auth.api.signUpEmail({
      body: { email: `${username}@archispark.internal`, password, name: username, username } as never,
    }).catch(() => null);
    if (!res?.user) return;
    db.update(usersTable).set({ username, role }).where(eq(usersTable.id, res.user.id)).run();
    // Assign to matching RBAC role
    const rbacRole = db.select().from(rolesTable).where(eq(rolesTable.name, role)).get();
    if (rbacRole) {
      db.insert(userRolesTable).values({ roleId: rbacRole.id, userId: res.user.id }).run();
    }
  };

  await seedUser("admin", "admin", "admin");
  await seedUser("user",  "user",  "user");
  console.log("[auth] Better Auth users ready — admin/admin · user/user");
}

// ---------------------------------------------------------------------------
// User helpers (thin wrappers — Better Auth owns user CRUD via API)
// ---------------------------------------------------------------------------

function rowToOut(r: typeof usersTable.$inferSelect): UserOut {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    created_at: (r.createdAt instanceof Date ? r.createdAt : new Date((r.createdAt as number) * 1000)).toISOString(),
  };
}

export function listUsers(): UserOut[] {
  return db.select().from(usersTable).all().map(rowToOut);
}

// ---------------------------------------------------------------------------
// Middleware — uses Better Auth session (httpOnly cookie)
// ---------------------------------------------------------------------------

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session) => {
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

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ detail: "Accès réservé aux administrateurs." });
      return;
    }
    next();
  });
}

function userHasPermission(userId: string, baRole: string, resource: string, flag: PermissionFlag): boolean {
  if (baRole === "admin") return true;
  const roleRows = db.select({ roleId: userRolesTable.roleId })
    .from(userRolesTable).where(eq(userRolesTable.userId, userId)).all();
  for (const { roleId } of roleRows) {
    const perm = db.select().from(rolePermsTable)
      .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, resource))).get();
    if (perm && parsePermissions(perm.permission).includes(flag)) return true;
  }
  return false;
}

export function requirePermission(resource: string, flag: PermissionFlag) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ detail: "Non authentifié." }); return; }
    if (!userHasPermission(req.user.id, req.user.role, resource, flag)) {
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

function rolePermissions(roleId: string): Record<ArchiLayer, LayerPermissions> {
  const rows = db.select().from(rolePermsTable).where(eq(rolePermsTable.roleId, roleId)).all();
  const result = emptyPermissions();
  for (const r of rows) {
    if ((ARCHIMATE_LAYERS as readonly string[]).includes(r.layer)) {
      result[r.layer as ArchiLayer] = parsePermissions(r.permission);
    }
  }
  return result;
}

function roleUsers(roleId: string): string[] {
  return db.select({ userId: userRolesTable.userId }).from(userRolesTable).where(eq(userRolesTable.roleId, roleId)).all().map((r) => r.userId);
}

function roleOut(r: typeof rolesTable.$inferSelect): RoleOut {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    is_system: Boolean(r.isSystem),
    created_at: new Date(r.createdAt * 1000).toISOString(),
    permissions: rolePermissions(r.id),
    user_ids: roleUsers(r.id),
  };
}

export function listRoles(): RoleOut[] {
  return db.select().from(rolesTable).all().map(roleOut);
}

export function getRole(roleId: string): RoleOut {
  const r = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!r) throw new Error(`Rôle '${roleId}' introuvable.`);
  return roleOut(r);
}

export function createRole(name: string, description?: string | null, permissions?: Partial<Record<ArchiLayer, LayerPermissions>>): RoleOut {
  if (!name?.trim()) throw new Error("Le nom du rôle est requis.");
  const existing = db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, name.trim())).get();
  if (existing) throw new Error("Ce nom de rôle est déjà pris.");
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db.insert(rolesTable).values({ id, name: name.trim(), description: description ?? null, isSystem: false, createdAt: now }).run();
  if (permissions) setRolePermissions(id, permissions);
  return getRole(id);
}

export function updateRole(roleId: string, updates: { name?: string; description?: string | null; permissions?: Partial<Record<ArchiLayer, LayerPermissions>> }): RoleOut {
  const r = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!r) throw new Error(`Rôle '${roleId}' introuvable.`);
  const patch: Partial<typeof rolesTable.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.description !== undefined) patch.description = updates.description;
  if (Object.keys(patch).length > 0) {
    db.update(rolesTable).set(patch).where(eq(rolesTable.id, roleId)).run();
  }
  if (updates.permissions) setRolePermissions(roleId, updates.permissions);
  return getRole(roleId);
}

export function deleteRole(roleId: string): void {
  const role = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  if (role.isSystem) throw new Error("Les rôles système ne peuvent pas être supprimés.");
  db.delete(rolesTable).where(eq(rolesTable.id, roleId)).run();
}

export function setRolePermissions(roleId: string, perms: Partial<Record<ArchiLayer, LayerPermissions>>): void {
  for (const [layer, flags] of Object.entries(perms)) {
    if (!flags) continue;
    if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) continue;
    const serialized = serializePermissions(flags);
    const exists = db.select().from(rolePermsTable)
      .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)))
      .get();
    if (exists) {
      db.update(rolePermsTable).set({ permission: serialized })
        .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)))
        .run();
    } else {
      db.insert(rolePermsTable).values({ roleId, layer, permission: serialized }).run();
    }
  }
}

export function getRoleLayerPermission(roleId: string, layer: string): LayerPermissions {
  if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) throw new Error(`Layer invalide: ${layer}`);
  const role = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  const row = db.select().from(rolePermsTable)
    .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)))
    .get();
  return parsePermissions(row?.permission ?? "");
}

export function setRoleLayerPermission(roleId: string, layer: string, permissions: LayerPermissions): LayerPermissions {
  if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) throw new Error(`Layer invalide: ${layer}`);
  if (!["none", "read", "write", "admin"].includes(permissions as unknown as string) && !Array.isArray(permissions)) throw new Error("Permissions invalides.");
  const role = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  if (role.isSystem) throw new Error("Les permissions des rôles système ne peuvent pas être modifiées.");
  const serialized = serializePermissions(permissions);
  const exists = db.select().from(rolePermsTable)
    .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)))
    .get();
  if (exists) {
    db.update(rolePermsTable).set({ permission: serialized })
      .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)))
      .run();
  } else {
    db.insert(rolePermsTable).values({ roleId, layer, permission: serialized }).run();
  }
  return permissions;
}

export function removeRoleLayerPermission(roleId: string, layer: string): void {
  if (!(ARCHIMATE_LAYERS as readonly string[]).includes(layer)) throw new Error(`Layer invalide: ${layer}`);
  const role = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  db.delete(rolePermsTable)
    .where(and(eq(rolePermsTable.roleId, roleId), eq(rolePermsTable.layer, layer)))
    .run();
}

export function assignUserToRole(roleId: string, userId: string): void {
  const role = db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).get();
  if (!role) throw new Error(`Rôle '${roleId}' introuvable.`);
  const user = db.select().from(usersTable).where(eq(usersTable.id, userId)).get();
  if (!user) throw new Error(`Utilisateur '${userId}' introuvable.`);
  const exists = db.select().from(userRolesTable)
    .where(and(eq(userRolesTable.roleId, roleId), eq(userRolesTable.userId, userId)))
    .get();
  if (exists) return;
  db.insert(userRolesTable).values({ roleId, userId }).run();
}

export function unassignUserFromRole(roleId: string, userId: string): void {
  const deleted = db.delete(userRolesTable)
    .where(and(eq(userRolesTable.roleId, roleId), eq(userRolesTable.userId, userId)))
    .returning({ roleId: userRolesTable.roleId }).get();
  if (!deleted) throw new Error("Association introuvable.");
}

export function listRolesForUser(userId: string): RoleOut[] {
  const rows = db.select({ roleId: userRolesTable.roleId }).from(userRolesTable).where(eq(userRolesTable.userId, userId)).all();
  return rows.map((r) => getRole(r.roleId));
}
