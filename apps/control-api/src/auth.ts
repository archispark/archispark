import { randomUUID, randomBytes, scrypt } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import {
  controlDb,
  users as usersTable,
  accounts,
  apiTokens,
  organizationSettings,
  teams as teamsTable,
  teamMembers as teamMembersTable,
  tenantDatabases as tenantDatabasesTable,
} from "@workspace/db";
import { getAuth } from "./better-auth.js";
import { fromNodeHeaders } from "better-auth/node";
import {
  verifyAccessToken,
  type KeycloakClaims,
  ORG_ROLES,
  type OrgRoleName,
  type OrganizationRepresentation,
  listOrganizations,
  getOrganization,
  createOrganization,
  deleteOrganization as deleteKeycloakOrganization,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  listOrgRoleUsers,
  ensureDefaultOrgRoles,
  setOrgMemberRoles,
  getOrgMemberRole,
  createOrgInvitation,
  listOrgInvitations,
  cancelOrgInvitation,
  listRealmUsers,
  findUserByUsername,
  getKeycloakUser,
  createKeycloakUser,
  deleteKeycloakUser,
  setUserPassword,
  getUserRealmRoles,
  assignRealmRole,
  unassignRealmRole,
  listRealmRoleUsers,
  type KeycloakUserRepresentation,
} from "@workspace/auth";
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
  orgRole: OrgRoleName;
  teamIds: string[];
}

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
  /** Set by requireAuth for Bearer-token requests (api_tokens row). */
  tokenContext?: { organizationId: string; workspaceId: number | null };
  /** Set by requireAuth for session requests (Better Auth session's active org). */
  sessionActiveOrgId?: string | null;
  /** Set by requireAuth from a verified Keycloak token's `organizations` claim. */
  orgClaims?: Record<string, { name: string; roles: string[] }> | null;
  /** Set by resolveWorkspaceContext. */
  workspace?: WorkspaceContext;
}

// ---------------------------------------------------------------------------
// Bootstrap: seed default users + a default Phasetwo organization
// ---------------------------------------------------------------------------

// Fixed Keycloak `sub` UUIDs for the demo accounts, matching the `id` fields
// pinned in .docker/keycloak/realm-export.json. Bridges Keycloak-issued JWTs
// to these existing control-db users (Stage 2 of the Better Auth -> Keycloak
// migration), and identifies them as Phasetwo organization members.
const DEMO_KEYCLOAK_SUBS: Record<string, string> = {
  admin:   "c8a1f6c0-0000-4000-8000-000000000001",
  user:    "c8a1f6c0-0000-4000-8000-000000000002",
  contrib: "c8a1f6c0-0000-4000-8000-000000000003",
  archi:   "c8a1f6c0-0000-4000-8000-000000000004",
};

/** Demo org roles for each seed user, mirroring the pre-migration `members` seed. */
const DEMO_ORG_ROLES: Record<string, OrgRoleName> = {
  admin:   "owner",
  archi:   "owner",
  contrib: "admin",
  user:    "member",
};

export async function initUsers(): Promise<void> {
  // All tables (model + Better Auth) are created by runMigrations()
  // from the drizzle-pg/ folder before this runs.
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
    await controlDb.update(usersTable).set({ username, role, keycloakSub: DEMO_KEYCLOAK_SUBS[username] ?? null }).where(eq(usersTable.id, userId!));
  };

  const adminPwd   = process.env["SEED_ADMIN_PASSWORD"]   || "admin";
  const userPwd    = process.env["SEED_USER_PASSWORD"]    || "user";
  const contribPwd = process.env["SEED_CONTRIB_PASSWORD"] || "contrib";
  const archiPwd   = process.env["SEED_ARCHI_PASSWORD"]   || "archi";
  await seedUser("admin",   adminPwd,   "platform_admin");
  await seedUser("user",    userPwd,    "user");
  await seedUser("contrib", contribPwd, "user");
  await seedUser("archi",   archiPwd,   "user");
  if (!process.env["SEED_ADMIN_PASSWORD"]) {
    console.warn("[auth] SEED_ADMIN_PASSWORD not set — using default 'admin'. Set it in production!");
  }

  console.log("[auth] Better Auth users ready.");
}

/**
 * Ensures at least one Phasetwo organization exists (creating a "Default" one
 * for fresh installs) and that the demo users belong to it with their usual
 * roles. Called once at startup, after `initUsers()`.
 */
export async function initOrganizations(): Promise<void> {
  const orgs = await listOrganizations();
  let orgId: string;
  if (orgs.length === 0) {
    orgId = await createOrganization({ name: "Default", attributes: { slug: ["default"] } });
  } else {
    orgId = orgs[0]!.id!;
  }
  await ensureDefaultOrgRoles(orgId);
  await ensureOrgSettings(orgId);

  for (const [username, sub] of Object.entries(DEMO_KEYCLOAK_SUBS)) {
    await addOrgMember(orgId, sub).catch(() => {});
    await setOrgMemberRoles(orgId, sub, DEMO_ORG_ROLES[username]!);
  }

  console.log("[auth] Organizations ready.");
}

// ---------------------------------------------------------------------------
// User helpers — platform users are provisioned via the Keycloak Admin API.
// (The demo accounts seeded by initUsers() above keep their bridged
// usersTable rows for Better Auth sign-in; that is unrelated to this CRUD.)
// ---------------------------------------------------------------------------

const PLATFORM_ADMIN_ROLE = "platform_admin";

function userOut(u: KeycloakUserRepresentation, isPlatformAdmin: boolean): UserOut {
  return {
    id: u.id!,
    username: u.username,
    role: isPlatformAdmin ? "platform_admin" : "user",
    created_at: new Date(u.createdTimestamp ?? Date.now()).toISOString(),
  };
}

export async function listUsers(): Promise<UserOut[]> {
  const [users, admins] = await Promise.all([listRealmUsers(), listRealmRoleUsers(PLATFORM_ADMIN_ROLE)]);
  const adminIds = new Set(admins.map((u) => u.id));
  return users
    .filter((u) => !u.username.startsWith("service-account-"))
    .map((u) => userOut(u, adminIds.has(u.id)));
}

export async function createUser(username: string, password: string, role: string = "user"): Promise<UserOut> {
  const existing = await findUserByUsername(username);
  if (existing) throw new ValidationError(`Le nom d'utilisateur '${username}' est déjà pris.`);

  const userId = await createKeycloakUser({
    username,
    email: `${username}@archispark.internal`,
    enabled: true,
    emailVerified: true,
  });
  await setUserPassword(userId, password, false);

  const isPlatformAdmin = role === "platform_admin";
  if (isPlatformAdmin) await assignRealmRole(userId, PLATFORM_ADMIN_ROLE);

  const user = await getKeycloakUser(userId);
  if (!user) throw new ValidationError("Utilisateur introuvable après création.");
  return userOut(user, isPlatformAdmin);
}

export async function updateUserById(id: string, updates: { password?: string; role?: string }): Promise<UserOut> {
  const existing = await getKeycloakUser(id);
  if (!existing) throw new NotFoundError(`Utilisateur '${id}' introuvable.`);

  if (updates.password) {
    await setUserPassword(id, updates.password, false);
  }

  let isPlatformAdmin = (await getUserRealmRoles(id)).some((r) => r.name === PLATFORM_ADMIN_ROLE);
  if (updates.role !== undefined) {
    const wantsAdmin = updates.role === "platform_admin";
    if (wantsAdmin && !isPlatformAdmin) {
      await assignRealmRole(id, PLATFORM_ADMIN_ROLE);
      isPlatformAdmin = true;
    } else if (!wantsAdmin && isPlatformAdmin) {
      await unassignRealmRole(id, PLATFORM_ADMIN_ROLE);
      isPlatformAdmin = false;
    }
  }

  const user = await getKeycloakUser(id);
  return userOut(user!, isPlatformAdmin);
}

export async function deleteUserById(id: string): Promise<void> {
  const deleted = await deleteKeycloakUser(id);
  if (!deleted) throw new NotFoundError(`Utilisateur '${id}' introuvable.`);
}

// ---------------------------------------------------------------------------
// Admin: organizations management (platform admin only)
// ---------------------------------------------------------------------------

export interface AdminOrganizationOut {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  created_at: string;
  tenant_status: "pending" | "provisioning" | "active" | "error" | null;
  last_error: string | null;
  /** Only present in the response to `POST /admin/organizations` when no `initial_owner_user_id` was given — shown once. */
  initial_owner?: { username: string; password: string };
}

function orgSlug(org: OrganizationRepresentation): string {
  return org.attributes?.["slug"]?.[0] ?? org.id!;
}

/** Inserts a default `organizationSettings` row if missing (lazy backfill for orgs created before Phase 4 or directly in Keycloak), then returns it. */
async function ensureOrgSettings(orgId: string): Promise<typeof organizationSettings.$inferSelect> {
  await controlDb.insert(organizationSettings).values({ organizationId: orgId }).onConflictDoNothing();
  const [row] = await controlDb.select().from(organizationSettings).where(eq(organizationSettings.organizationId, orgId));
  return row!;
}

async function toAdminOrganizationOut(org: OrganizationRepresentation): Promise<AdminOrganizationOut> {
  const settings = await ensureOrgSettings(org.id!);
  const [tenant] = await controlDb.select({ status: tenantDatabasesTable.status, lastError: tenantDatabasesTable.lastError })
    .from(tenantDatabasesTable).where(eq(tenantDatabasesTable.organizationId, org.id!));
  return {
    id: org.id!,
    name: org.name,
    slug: orgSlug(org),
    enabled: settings.enabled,
    created_at: settings.createdAt.toISOString(),
    tenant_status: tenant?.status ?? null,
    last_error: tenant?.lastError ?? null,
  };
}

async function checkSlugAvailable(slug: string): Promise<void> {
  const orgs = await listOrganizations();
  if (orgs.some((o) => orgSlug(o) === slug)) throw new ValidationError(`Le slug '${slug}' est déjà utilisé.`);
}

export async function listAdminOrganizations(): Promise<AdminOrganizationOut[]> {
  const orgs = await listOrganizations();
  const result = await Promise.all(orgs.map(toAdminOrganizationOut));
  result.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return result;
}

export async function setOrganizationEnabled(id: string, enabled: boolean): Promise<AdminOrganizationOut> {
  let org: OrganizationRepresentation;
  try {
    org = await getOrganization(id);
  } catch {
    throw new NotFoundError(`Organisation '${id}' introuvable.`);
  }
  await ensureOrgSettings(id);
  await controlDb.update(organizationSettings).set({ enabled }).where(eq(organizationSettings.organizationId, id));
  return toAdminOrganizationOut(org);
}

export async function createAdminOrganization(name: string, slug: string, ownerUserId: string): Promise<AdminOrganizationOut> {
  await checkSlugAvailable(slug);

  const orgId = await createOrganization({ name, attributes: { slug: [slug] } });
  await ensureDefaultOrgRoles(orgId);
  await ensureOrgSettings(orgId);

  await addOrgMember(orgId, ownerUserId);
  await setOrgMemberRoles(orgId, ownerUserId, "owner");

  const org = await getOrganization(orgId);
  return toAdminOrganizationOut(org);
}

export interface CreateOrganizationResult {
  org: AdminOrganizationOut;
  /** Set when no `initialOwnerUserId` was given: a freshly generated owner account, returned once. */
  generatedOwner?: { userId: string; username: string; password: string };
}

/**
 * Creates an organization and assigns its initial owner — the platform admin
 * creating it never becomes a member, matching the rule that platform admins
 * have no access to tenant data. If `initialOwnerUserId` references an
 * existing platform user, that user becomes owner; otherwise a fresh
 * `admin-<slug>` account with a random password is created and returned once
 * via `generatedOwner` for the platform admin to hand to the customer.
 */
export async function createOrganizationWithOwner(
  name: string,
  slug: string,
  initialOwnerUserId?: string,
): Promise<CreateOrganizationResult> {
  await checkSlugAvailable(slug);

  let ownerUserId: string;
  let generatedOwner: { userId: string; username: string; password: string } | undefined;

  if (initialOwnerUserId) {
    const owner = await getKeycloakUser(initialOwnerUserId);
    if (!owner) throw new ValidationError(`Utilisateur '${initialOwnerUserId}' introuvable.`);
    ownerUserId = owner.id!;
  } else {
    const username = `admin-${slug}`;
    const password = randomBytes(9).toString("base64url");
    const created = await createUser(username, password, "user");
    ownerUserId = created.id;
    generatedOwner = { userId: created.id, username, password };
  }

  const org = await createAdminOrganization(name, slug, ownerUserId);
  return { org, generatedOwner };
}

export async function deleteOrganization(id: string): Promise<void> {
  await deleteKeycloakOrganization(id);
  await controlDb.delete(organizationSettings).where(eq(organizationSettings.organizationId, id));
  await controlDb.delete(tenantDatabasesTable).where(eq(tenantDatabasesTable.organizationId, id));
  await controlDb.delete(apiTokens).where(eq(apiTokens.organizationId, id));
  // teamMembers rows cascade via the team table's FK.
  await controlDb.delete(teamsTable).where(eq(teamsTable.organizationId, id));
}

// ---------------------------------------------------------------------------
// Organization-scoped: members, invitations, teams (current workspace)
// ---------------------------------------------------------------------------

export interface OrgMemberOut {
  user_id: string;
  username: string;
  email: string | null;
  role: OrgRoleName | null;
}

export async function listOrgMembersOut(organizationId: string): Promise<OrgMemberOut[]> {
  const [members, ...roleUserLists] = await Promise.all([
    listOrgMembers(organizationId),
    ...ORG_ROLES.map((role) => listOrgRoleUsers(organizationId, role)),
  ]);
  const roleByUserId = new Map<string, OrgRoleName>();
  ORG_ROLES.forEach((role, i) => {
    for (const u of roleUserLists[i]!) if (!roleByUserId.has(u.id)) roleByUserId.set(u.id, role);
  });
  return members!.map((m) => ({
    user_id: m.id,
    username: m.username,
    email: m.email ?? null,
    role: roleByUserId.get(m.id) ?? null,
  }));
}

export async function updateOrgMemberRole(organizationId: string, userId: string, role: OrgRoleName): Promise<void> {
  if (!ORG_ROLES.includes(role)) throw new ValidationError(`Rôle invalide : '${role}'.`);
  await setOrgMemberRoles(organizationId, userId, role);
}

export async function removeOrgMemberById(organizationId: string, userId: string): Promise<void> {
  await removeOrgMember(organizationId, userId);
}

export interface OrgInvitationOut {
  id: string;
  email: string;
  roles: string[];
  created_at: string | null;
}

export async function listOrgInvitationsOut(organizationId: string): Promise<OrgInvitationOut[]> {
  const invitations = await listOrgInvitations(organizationId);
  return invitations.map((i) => ({ id: i.id, email: i.email, roles: i.roles ?? [], created_at: i.createdAt ?? null }));
}

export async function createInvitation(organizationId: string, email: string, role: OrgRoleName): Promise<OrgInvitationOut> {
  if (!ORG_ROLES.includes(role)) throw new ValidationError(`Rôle invalide : '${role}'.`);
  const id = await createOrgInvitation(organizationId, { email, roles: [role] });
  return { id, email, roles: [role], created_at: new Date().toISOString() };
}

export async function cancelInvitation(organizationId: string, invitationId: string): Promise<void> {
  await cancelOrgInvitation(organizationId, invitationId);
}

export interface TeamOut {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
}

function teamOut(r: typeof teamsTable.$inferSelect): TeamOut {
  return { id: r.id, name: r.name, organization_id: r.organizationId, created_at: r.createdAt.toISOString() };
}

export async function listTeams(organizationId: string): Promise<TeamOut[]> {
  const rows = await controlDb.select().from(teamsTable).where(eq(teamsTable.organizationId, organizationId));
  return rows.map(teamOut);
}

export async function createTeam(organizationId: string, name: string): Promise<TeamOut> {
  const [row] = await controlDb.insert(teamsTable).values({ id: randomUUID(), name, organizationId, createdAt: new Date() }).returning();
  return teamOut(row!);
}

async function requireTeam(organizationId: string, teamId: string): Promise<typeof teamsTable.$inferSelect> {
  const [team] = await controlDb.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.organizationId, organizationId)));
  if (!team) throw new NotFoundError(`Équipe '${teamId}' introuvable.`);
  return team;
}

export async function updateTeam(organizationId: string, teamId: string, name: string): Promise<TeamOut> {
  await requireTeam(organizationId, teamId);
  await controlDb.update(teamsTable).set({ name, updatedAt: new Date() }).where(eq(teamsTable.id, teamId));
  const [row] = await controlDb.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  return teamOut(row!);
}

export async function removeTeam(organizationId: string, teamId: string): Promise<void> {
  await requireTeam(organizationId, teamId);
  await controlDb.delete(teamsTable).where(eq(teamsTable.id, teamId));
}

export interface TeamMemberOut {
  user_id: string;
  username: string;
  email: string | null;
}

export async function listTeamMembersOut(organizationId: string, teamId: string): Promise<TeamMemberOut[]> {
  await requireTeam(organizationId, teamId);
  const [rows, orgMembers] = await Promise.all([
    controlDb.select({ userId: teamMembersTable.userId }).from(teamMembersTable).where(eq(teamMembersTable.teamId, teamId)),
    listOrgMembers(organizationId),
  ]);
  const byId = new Map(orgMembers.map((m) => [m.id, m]));
  return rows.map((r) => {
    const m = byId.get(r.userId);
    return { user_id: r.userId, username: m?.username ?? r.userId, email: m?.email ?? null };
  });
}

export async function addTeamMember(organizationId: string, teamId: string, userId: string): Promise<void> {
  await requireTeam(organizationId, teamId);
  const [existing] = await controlDb.select({ id: teamMembersTable.id }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
  if (existing) return;
  await controlDb.insert(teamMembersTable).values({ id: randomUUID(), teamId, userId, createdAt: new Date() });
}

export async function removeTeamMember(organizationId: string, teamId: string, userId: string): Promise<void> {
  await requireTeam(organizationId, teamId);
  await controlDb.delete(teamMembersTable).where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
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

  let result: TokenUser;
  const [dbUser] = await controlDb.select().from(usersTable).where(eq(usersTable.id, row.userId));
  if (dbUser) {
    result = { id: dbUser.id, username: dbUser.username, role: dbUser.role, organizationId: row.organizationId, workspaceId: row.workspaceId };
  } else {
    // No bridged control-db row — the token belongs to a Keycloak-native user
    // (created via the Keycloak Admin API, Phase 5).
    const kcUser = await getKeycloakUser(row.userId);
    if (!kcUser) return null;
    const roles = await getUserRealmRoles(row.userId);
    const role = roles.some((r) => r.name === PLATFORM_ADMIN_ROLE) ? "platform_admin" : "user";
    result = { id: kcUser.id!, username: kcUser.username, role, organizationId: row.organizationId, workspaceId: row.workspaceId };
  }

  controlDb.update(apiTokens).set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(apiTokens.id, row.id)).catch(() => {});
  return result;
}

// ---------------------------------------------------------------------------
// Membership helpers
// ---------------------------------------------------------------------------

/**
 * Org role + team memberships for a user within a given organization, or null
 * if not a member. `orgClaims` (the JWT `organizations` claim, when available)
 * is used as a fast path to avoid a Phasetwo API round trip; otherwise the
 * role is resolved via `@workspace/auth`'s `getOrgMemberRole` using the user's
 * Keycloak `sub` (falling back to `userId` itself if it isn't a known
 * control-db user — i.e. already a raw Keycloak `sub`).
 */
export async function getMembershipContext(
  userId: string,
  organizationId: string,
  orgClaims?: Record<string, { name: string; roles: string[] }> | null,
): Promise<WorkspaceContext | null> {
  const [user] = await controlDb.select({ keycloakSub: usersTable.keycloakSub }).from(usersTable).where(eq(usersTable.id, userId));
  const keycloakSub = user?.keycloakSub ?? userId;

  let orgRole: OrgRoleName | null;
  const claimRoles = orgClaims?.[organizationId]?.roles;
  if (claimRoles) {
    orgRole = ORG_ROLES.find((r) => claimRoles.includes(r)) ?? null;
  } else {
    orgRole = await getOrgMemberRole(organizationId, keycloakSub);
  }
  if (!orgRole) return null;

  const teamRows = await controlDb.select({ teamId: teamMembersTable.teamId })
    .from(teamMembersTable)
    .innerJoin(teamsTable, eq(teamsTable.id, teamMembersTable.teamId))
    .where(and(eq(teamMembersTable.userId, keycloakSub), eq(teamsTable.organizationId, organizationId)));

  return { organizationId, orgRole, teamIds: teamRows.map((r) => r.teamId) };
}

/** Returns the id of the first known Phasetwo organization, or null if none exist. */
async function resolveDefaultOrganizationId(): Promise<string | null> {
  const [first] = await listOrganizations();
  return first?.id ?? null;
}

// ---------------------------------------------------------------------------
// Middleware — uses Better Auth session (httpOnly cookie) or API Bearer token
// ---------------------------------------------------------------------------

interface SessionResult {
  user: { id: string; name: string; email?: string | null; [k: string]: unknown };
  session: { activeOrganizationId?: string | null; [k: string]: unknown };
}

/**
 * Bridges `claims.sub` to an existing control-db user (Stage 2 of the Better
 * Auth -> Keycloak migration), so downstream org/role resolution works
 * exactly as it does for Better Auth sessions.
 */
async function resolveKeycloakUser(claims: KeycloakClaims): Promise<{ id: string; username: string; role: string }> {
  const [dbUser] = await controlDb
    .select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.keycloakSub, claims.sub))
    .limit(1);
  if (dbUser) return dbUser;
  return {
    id: claims.sub,
    username: claims.preferred_username ?? claims.sub,
    role: claims.realm_access?.roles?.includes("platform_admin") ? "platform_admin" : "user",
  };
}

/** Reads a single cookie value from a raw `Cookie` request header. */
function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    lookupApiToken(token)
      .then(async (tokenUser) => {
        if (tokenUser) {
          req.user = { id: tokenUser.id, username: tokenUser.username, role: tokenUser.role };
          req.tokenContext = { organizationId: tokenUser.organizationId, workspaceId: tokenUser.workspaceId };
          next();
          return;
        }
        // Not a personal API token — try a Keycloak-issued access token.
        const claims = await verifyAccessToken(token);
        if (!claims) { res.status(401).json({ detail: "Token invalide." }); return; }
        req.user = await resolveKeycloakUser(claims);
        req.orgClaims = claims.organizations ?? null;
        req.sessionActiveOrgId = null;
        next();
      })
      .catch(() => { res.status(401).json({ detail: "Erreur d'authentification." }); });
    return;
  }
  getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) })
    .then(async (session: SessionResult | null) => {
      if (session?.user) {
        req.user = {
          id: session.user.id,
          username: (session.user as unknown as { username?: string }).username ?? session.user.name,
          role: (session.user as unknown as { role?: string }).role ?? "user",
        };
        req.sessionActiveOrgId = session.session?.activeOrganizationId ?? null;
        next();
        return;
      }
      // No Better Auth session — fall back to a Keycloak access_token cookie
      // (Stage 3 of the Better Auth -> Keycloak migration).
      const cookieToken = getCookieValue(req.headers["cookie"], "access_token");
      const claims = cookieToken ? await verifyAccessToken(cookieToken) : null;
      if (!claims) {
        res.status(401).json({ detail: "Non authentifié." });
        return;
      }
      req.user = await resolveKeycloakUser(claims);
      req.orgClaims = claims.organizations ?? null;
      req.sessionActiveOrgId = null;
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
 * operates in, attaching it to `req.workspace`. The organization id comes
 * from the API token, an `X-Org-Id` header (org switcher; must be one of the
 * JWT's `organizations` claim keys), the active-org session cookie, or — for
 * recognized local platform users with none of those (Better Auth sessions,
 * or a Keycloak token with no organization membership claim) — the first
 * Phasetwo organization.
 */
export async function resolveWorkspaceContext(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ detail: "Non authentifié." }); return; }

  let organizationId = req.tokenContext?.organizationId ?? null;

  if (!organizationId) {
    const headerOrgId = req.headers["x-org-id"];
    if (typeof headerOrgId === "string" && req.orgClaims && headerOrgId in req.orgClaims) {
      organizationId = headerOrgId;
    }
  }

  organizationId ??= req.sessionActiveOrgId ?? null;

  if (!organizationId && req.orgClaims) {
    organizationId = Object.keys(req.orgClaims)[0] ?? null;
  }
  if (!organizationId) {
    const [dbUser] = await controlDb.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    if (dbUser) organizationId = await resolveDefaultOrganizationId();
  }

  if (!organizationId) {
    res.status(403).json({ detail: "Aucune organisation associée à cet utilisateur." });
    return;
  }

  const ctx = await getMembershipContext(req.user.id, organizationId, req.orgClaims);
  if (!ctx) {
    res.status(403).json({ detail: "Accès à cette organisation refusé." });
    return;
  }

  if (req.user.role !== "platform_admin") {
    const [settings] = await controlDb.select({ enabled: organizationSettings.enabled })
      .from(organizationSettings).where(eq(organizationSettings.organizationId, organizationId));
    if (settings && !settings.enabled) {
      res.status(403).json({ detail: "Cette organisation a été désactivée par un administrateur de la plateforme." });
      return;
    }
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
