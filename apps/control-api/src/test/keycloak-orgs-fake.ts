/**
 * In-memory fake of Phasetwo's Keycloak Organizations REST API
 * (`@workspace/auth`'s `orgs.ts`), used by `test-setup.ts` to mock
 * `@workspace/auth` for the whole control-api test suite — there is no real
 * Keycloak instance in the test environment.
 *
 * State is module-level and persists across `it()`s within a single test
 * file (mirroring how the PGlite-backed `controlDb` behaves), but is fresh
 * per test file thanks to Vitest's per-file module isolation.
 */
import { randomUUID } from "node:crypto";
import type {
  OrgRoleName,
  OrganizationRepresentation,
  OrgRoleRepresentation,
  OrgMemberRepresentation,
  InvitationRepresentation,
  CreateInvitationInput,
} from "@workspace/auth";
import { getKeycloakUser } from "./keycloak-users-fake.js";

// Mirrors @workspace/auth's ORG_ROLES — defined locally (not imported) to
// avoid a circular import when this module is itself used to build a
// `vi.mock("@workspace/auth", ...)` factory.
const ORG_ROLES: readonly OrgRoleName[] = ["owner", "admin", "member"];

interface FakeOrg {
  id: string;
  name: string;
  displayName?: string;
  url?: string;
  domains?: string[];
  attributes?: Record<string, string[]>;
  /** userId (Keycloak sub) -> set of granted org role names */
  members: Map<string, Set<string>>;
  roles: Set<string>;
  invitations: Map<string, InvitationRepresentation>;
}

const orgs = new Map<string, FakeOrg>();

/** Clears all fake organizations/members/invitations. Exposed for tests. */
export function resetOrgsFake(): void {
  orgs.clear();
}

function requireOrg(orgId: string, method: string, path: string): FakeOrg {
  const org = orgs.get(orgId);
  if (!org) throw new Error(`Keycloak orgs request failed: ${method} ${path} -> 404`);
  return org;
}

function toRepresentation(org: FakeOrg): OrganizationRepresentation {
  return {
    id: org.id,
    name: org.name,
    displayName: org.displayName,
    url: org.url,
    domains: org.domains ?? [],
    attributes: org.attributes,
  };
}

export function listOrganizations(): Promise<OrganizationRepresentation[]> {
  return Promise.resolve([...orgs.values()].map(toRepresentation));
}

export function getOrganization(orgId: string): Promise<OrganizationRepresentation> {
  return Promise.resolve(toRepresentation(requireOrg(orgId, "GET", `/${orgId}`)));
}

export function createOrganization(data: OrganizationRepresentation): Promise<string> {
  const id = data.id ?? randomUUID();
  orgs.set(id, {
    id,
    name: data.name,
    displayName: data.displayName,
    url: data.url,
    domains: data.domains,
    attributes: data.attributes,
    members: new Map(),
    roles: new Set(),
    invitations: new Map(),
  });
  return Promise.resolve(id);
}

export function updateOrganization(orgId: string, data: OrganizationRepresentation): Promise<void> {
  const org = requireOrg(orgId, "PUT", `/${orgId}`);
  org.name = data.name;
  org.displayName = data.displayName;
  org.url = data.url;
  org.domains = data.domains;
  org.attributes = data.attributes;
  return Promise.resolve();
}

export function deleteOrganization(orgId: string): Promise<void> {
  orgs.delete(orgId);
  return Promise.resolve();
}

async function memberRepresentation(userId: string): Promise<OrgMemberRepresentation> {
  const user = await getKeycloakUser(userId);
  return { id: userId, username: user?.username ?? userId, email: user?.email ?? undefined };
}

export async function listOrgMembers(orgId: string): Promise<OrgMemberRepresentation[]> {
  const org = requireOrg(orgId, "GET", `/${orgId}/members`);
  return Promise.all([...org.members.keys()].map(memberRepresentation));
}

export function addOrgMember(orgId: string, userId: string): Promise<void> {
  const org = requireOrg(orgId, "PUT", `/${orgId}/members/${userId}`);
  if (!org.members.has(userId)) org.members.set(userId, new Set());
  return Promise.resolve();
}

export function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const org = requireOrg(orgId, "DELETE", `/${orgId}/members/${userId}`);
  org.members.delete(userId);
  return Promise.resolve();
}

export function listOrgRoles(orgId: string): Promise<OrgRoleRepresentation[]> {
  const org = requireOrg(orgId, "GET", `/${orgId}/roles`);
  return Promise.resolve([...org.roles].map((name) => ({ name })));
}

export function createOrgRole(orgId: string, name: string, _description?: string): Promise<void> {
  const org = requireOrg(orgId, "POST", `/${orgId}/roles`);
  org.roles.add(name);
  return Promise.resolve();
}

export async function ensureDefaultOrgRoles(orgId: string): Promise<void> {
  const org = requireOrg(orgId, "GET", `/${orgId}/roles`);
  for (const role of ORG_ROLES) org.roles.add(role);
}

export function listOrgRoleUsers(orgId: string, roleName: string): Promise<OrgMemberRepresentation[]> {
  const org = requireOrg(orgId, "GET", `/${orgId}/roles/${roleName}/users`);
  const userIds = [...org.members.entries()].filter(([, roles]) => roles.has(roleName)).map(([id]) => id);
  return Promise.all(userIds.map(memberRepresentation));
}

export function grantOrgRole(orgId: string, roleName: string, userId: string): Promise<void> {
  const org = requireOrg(orgId, "PUT", `/${orgId}/roles/${roleName}/users/${userId}`);
  org.roles.add(roleName);
  let memberRoles = org.members.get(userId);
  if (!memberRoles) { memberRoles = new Set(); org.members.set(userId, memberRoles); }
  memberRoles.add(roleName);
  return Promise.resolve();
}

export function revokeOrgRole(orgId: string, roleName: string, userId: string): Promise<void> {
  const org = orgs.get(orgId);
  org?.members.get(userId)?.delete(roleName);
  return Promise.resolve();
}

export function userHasOrgRole(orgId: string, roleName: string, userId: string): Promise<boolean> {
  const org = requireOrg(orgId, "GET", `/${orgId}/roles/${roleName}/users/${userId}`);
  return Promise.resolve(org.members.get(userId)?.has(roleName) ?? false);
}

export async function setOrgMemberRoles(orgId: string, userId: string, role: OrgRoleName): Promise<void> {
  await grantOrgRole(orgId, role, userId);
  for (const other of ORG_ROLES) {
    if (other !== role) await revokeOrgRole(orgId, other, userId);
  }
}

export async function getOrgMemberRole(orgId: string, userId: string): Promise<OrgRoleName | null> {
  for (const role of ORG_ROLES) {
    if (await userHasOrgRole(orgId, role, userId)) return role;
  }
  return null;
}

export function createOrgInvitation(orgId: string, input: CreateInvitationInput): Promise<string> {
  const org = requireOrg(orgId, "POST", `/${orgId}/invitations`);
  const id = randomUUID();
  org.invitations.set(id, {
    id, email: input.email, roles: input.roles, createdAt: new Date().toISOString(), organizationId: orgId,
  });
  return Promise.resolve(id);
}

export function listOrgInvitations(orgId: string): Promise<InvitationRepresentation[]> {
  const org = requireOrg(orgId, "GET", `/${orgId}/invitations`);
  return Promise.resolve([...org.invitations.values()]);
}

export function cancelOrgInvitation(orgId: string, invitationId: string): Promise<void> {
  const org = requireOrg(orgId, "DELETE", `/${orgId}/invitations/${invitationId}`);
  org.invitations.delete(invitationId);
  return Promise.resolve();
}

/** Spread into a `vi.mock("@workspace/auth", ...)` factory's return value. */
export const fakeOrgsApi = {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  listOrgRoles,
  createOrgRole,
  ensureDefaultOrgRoles,
  listOrgRoleUsers,
  grantOrgRole,
  revokeOrgRole,
  userHasOrgRole,
  setOrgMemberRoles,
  getOrgMemberRole,
  createOrgInvitation,
  listOrgInvitations,
  cancelOrgInvitation,
};
