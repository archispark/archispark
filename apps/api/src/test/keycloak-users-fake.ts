/**
 * In-memory fake of the Keycloak Admin REST API's Users/Roles endpoints
 * (`@workspace/auth`'s `admin-users.ts`), used by `test-setup.ts` to mock
 * `@workspace/auth` for the whole api test suite — there is no real
 * Keycloak instance in the test environment.
 *
 * State is module-level and persists across `it()`s within a single test
 * file (mirroring how the PGlite-backed `db` behaves), but is fresh
 * per test file thanks to Vitest's per-file module isolation.
 */
import { randomUUID } from "node:crypto";
import type { KeycloakUserRepresentation, KeycloakRoleRepresentation } from "@workspace/auth";

interface FakeUser extends KeycloakUserRepresentation {
  id: string;
  realmRoles: Set<string>;
}

const users = new Map<string, FakeUser>();

// Mirrors apps/api/src/auth.ts's DEMO_KEYCLOAK_SUBS — defined locally
// (not imported) to avoid a circular import when this module is itself used
// to build a `vi.mock("@workspace/auth", ...)` factory.
const DEMO_KEYCLOAK_SUBS: Record<string, string> = {
  admin:   "c8a1f6c0-0000-4000-8000-000000000001",
  user:    "c8a1f6c0-0000-4000-8000-000000000002",
  contrib: "c8a1f6c0-0000-4000-8000-000000000003",
  archi:   "c8a1f6c0-0000-4000-8000-000000000004",
};

/** Clears all fake users. Exposed for tests. */
export function resetUsersFake(): void {
  users.clear();
}

/** Pre-seeds the 4 demo accounts with their fixed ids (matching .docker/keycloak/realm-export.json); "admin" gets the platform_admin realm role. */
export function seedDemoKeycloakUsers(): void {
  for (const [username, id] of Object.entries(DEMO_KEYCLOAK_SUBS)) {
    if (users.has(id)) continue;
    users.set(id, {
      id,
      username,
      email: `${username}@archispark.internal`,
      enabled: true,
      emailVerified: true,
      createdTimestamp: Date.now(),
      realmRoles: new Set(username === "admin" ? ["platform_admin"] : []),
    });
  }
}

function toRepresentation(u: FakeUser): KeycloakUserRepresentation {
  const { realmRoles: _realmRoles, ...rest } = u;
  return { ...rest };
}

function requireUser(userId: string, method: string, path: string): FakeUser {
  const user = users.get(userId);
  if (!user) throw new Error(`Keycloak admin request failed: ${method} ${path} -> 404`);
  return user;
}

export function listRealmUsers(): Promise<KeycloakUserRepresentation[]> {
  return Promise.resolve([...users.values()].map(toRepresentation));
}

export function findUserByUsername(username: string): Promise<KeycloakUserRepresentation | null> {
  const found = [...users.values()].find((u) => u.username === username);
  return Promise.resolve(found ? toRepresentation(found) : null);
}

export function getKeycloakUser(userId: string): Promise<KeycloakUserRepresentation | null> {
  const found = users.get(userId);
  return Promise.resolve(found ? toRepresentation(found) : null);
}

export function createKeycloakUser(data: KeycloakUserRepresentation): Promise<string> {
  const id = data.id ?? randomUUID();
  users.set(id, { ...data, id, createdTimestamp: data.createdTimestamp ?? Date.now(), realmRoles: new Set() });
  return Promise.resolve(id);
}

export function updateKeycloakUser(userId: string, data: Partial<KeycloakUserRepresentation>): Promise<void> {
  const user = requireUser(userId, "PUT", `/users/${userId}`);
  Object.assign(user, data);
  return Promise.resolve();
}

export function deleteKeycloakUser(userId: string): Promise<boolean> {
  return Promise.resolve(users.delete(userId));
}

export function setUserPassword(userId: string, _password: string, _temporary = false): Promise<void> {
  requireUser(userId, "PUT", `/users/${userId}/reset-password`);
  return Promise.resolve();
}

export function getUserRealmRoles(userId: string): Promise<KeycloakRoleRepresentation[]> {
  const user = requireUser(userId, "GET", `/users/${userId}/role-mappings/realm`);
  return Promise.resolve([...user.realmRoles].map((name) => ({ name })));
}

export function assignRealmRole(userId: string, roleName: string): Promise<void> {
  const user = requireUser(userId, "POST", `/users/${userId}/role-mappings/realm`);
  user.realmRoles.add(roleName);
  return Promise.resolve();
}

export function unassignRealmRole(userId: string, roleName: string): Promise<void> {
  const user = requireUser(userId, "DELETE", `/users/${userId}/role-mappings/realm`);
  user.realmRoles.delete(roleName);
  return Promise.resolve();
}

export function listRealmRoleUsers(roleName: string): Promise<KeycloakUserRepresentation[]> {
  return Promise.resolve([...users.values()].filter((u) => u.realmRoles.has(roleName)).map(toRepresentation));
}

/** Spread into a `vi.mock("@workspace/auth", ...)` factory's return value. */
export const fakeUsersApi = {
  listRealmUsers,
  findUserByUsername,
  getKeycloakUser,
  createKeycloakUser,
  updateKeycloakUser,
  deleteKeycloakUser,
  setUserPassword,
  getUserRealmRoles,
  assignRealmRole,
  unassignRealmRole,
  listRealmRoleUsers,
};
