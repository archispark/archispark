import { getKeycloakConfig } from "./config.js";
import { getAdminToken } from "./admin-token.js";

/** Organization role names used by ArchiSpark (mutually exclusive). */
export type OrgRoleName = "owner" | "admin" | "member";
export const ORG_ROLES: readonly OrgRoleName[] = ["owner", "admin", "member"];

export interface OrganizationRepresentation {
  id?: string;
  name: string;
  displayName?: string;
  url?: string;
  realm?: string;
  domains?: string[];
  attributes?: Record<string, string[]>;
}

export interface OrgRoleRepresentation {
  id?: string;
  name: string;
  description?: string;
}

export interface OrgMemberRepresentation {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

export interface InvitationRepresentation {
  id: string;
  email: string;
  createdAt?: string;
  inviterId?: string;
  invitationUrl?: string;
  organizationId?: string;
  roles?: string[];
  attributes?: Record<string, string[]>;
}

export interface CreateInvitationInput {
  email: string;
  roles: OrgRoleName[];
}

function orgsBaseUrl(): string {
  const { url, realm } = getKeycloakConfig();
  return `${url}/realms/${realm}/orgs`;
}

async function orgsRequest(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAdminToken();
  return fetch(`${orgsBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  });
}

async function orgsGet<T>(path: string): Promise<T> {
  const res = await orgsRequest(path);
  if (!res.ok) {
    throw new Error(`Keycloak orgs request failed: GET ${path} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

/** POSTs a JSON body and returns the id of the created resource (last path segment of the Location header). */
async function orgsPostForLocation(path: string, body: unknown): Promise<string> {
  const res = await orgsRequest(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Keycloak orgs request failed: POST ${path} -> ${res.status}`);
  }
  const location = res.headers.get("location");
  if (!location) {
    throw new Error(`Keycloak orgs response missing Location header for POST ${path}`);
  }
  return location.substring(location.lastIndexOf("/") + 1);
}

async function orgsPut(path: string, body?: unknown): Promise<void> {
  const res = await orgsRequest(path, {
    method: "PUT",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Keycloak orgs request failed: PUT ${path} -> ${res.status}`);
  }
}

async function orgsDelete(path: string, opts?: { allow404?: boolean }): Promise<void> {
  const res = await orgsRequest(path, { method: "DELETE" });
  if (!res.ok && !(opts?.allow404 && res.status === 404)) {
    throw new Error(`Keycloak orgs request failed: DELETE ${path} -> ${res.status}`);
  }
}

/** Lists all organizations in the realm (requires `view-organizations`). */
export function listOrganizations(): Promise<OrganizationRepresentation[]> {
  return orgsGet<OrganizationRepresentation[]>("");
}

export function getOrganization(orgId: string): Promise<OrganizationRepresentation> {
  return orgsGet<OrganizationRepresentation>(`/${orgId}`);
}

/** Creates an organization and returns its generated id. */
export function createOrganization(data: OrganizationRepresentation): Promise<string> {
  return orgsPostForLocation("", data);
}

export async function updateOrganization(orgId: string, data: OrganizationRepresentation): Promise<void> {
  await orgsPut(`/${orgId}`, data);
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await orgsDelete(`/${orgId}`);
}

export function listOrgMembers(orgId: string): Promise<OrgMemberRepresentation[]> {
  return orgsGet<OrgMemberRepresentation[]>(`/${orgId}/members`);
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  await orgsPut(`/${orgId}/members/${userId}`);
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  await orgsDelete(`/${orgId}/members/${userId}`);
}

export function listOrgRoles(orgId: string): Promise<OrgRoleRepresentation[]> {
  return orgsGet<OrgRoleRepresentation[]>(`/${orgId}/roles`);
}

export async function createOrgRole(orgId: string, name: string, description?: string): Promise<void> {
  const res = await orgsRequest(`/${orgId}/roles`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  // 409 = role already exists, treat as success for idempotency.
  if (!res.ok && res.status !== 409) {
    throw new Error(`Keycloak orgs request failed: POST /${orgId}/roles -> ${res.status}`);
  }
}

/** Idempotently creates the `owner`/`admin`/`member` org roles if missing. */
export async function ensureDefaultOrgRoles(orgId: string): Promise<void> {
  const existing = await listOrgRoles(orgId);
  const existingNames = new Set(existing.map((r) => r.name));
  for (const role of ORG_ROLES) {
    if (!existingNames.has(role)) {
      await createOrgRole(orgId, role);
    }
  }
}

export function listOrgRoleUsers(orgId: string, roleName: string): Promise<OrgMemberRepresentation[]> {
  return orgsGet<OrgMemberRepresentation[]>(`/${orgId}/roles/${roleName}/users`);
}

export async function grantOrgRole(orgId: string, roleName: string, userId: string): Promise<void> {
  await orgsPut(`/${orgId}/roles/${roleName}/users/${userId}`);
}

export async function revokeOrgRole(orgId: string, roleName: string, userId: string): Promise<void> {
  await orgsDelete(`/${orgId}/roles/${roleName}/users/${userId}`, { allow404: true });
}

export async function userHasOrgRole(orgId: string, roleName: string, userId: string): Promise<boolean> {
  const res = await orgsRequest(`/${orgId}/roles/${roleName}/users/${userId}`);
  return res.status === 204;
}

/** Grants the target role and revokes the other two (our org roles are mutually exclusive). */
export async function setOrgMemberRoles(orgId: string, userId: string, role: OrgRoleName): Promise<void> {
  await grantOrgRole(orgId, role, userId);
  for (const other of ORG_ROLES) {
    if (other !== role) {
      await revokeOrgRole(orgId, other, userId);
    }
  }
}

/** Resolves a member's ArchiSpark org role by checking owner/admin/member in order. */
export async function getOrgMemberRole(orgId: string, userId: string): Promise<OrgRoleName | null> {
  for (const role of ORG_ROLES) {
    if (await userHasOrgRole(orgId, role, userId)) {
      return role;
    }
  }
  return null;
}

export function createOrgInvitation(orgId: string, input: CreateInvitationInput): Promise<string> {
  return orgsPostForLocation(`/${orgId}/invitations`, {
    email: input.email,
    roles: input.roles,
    send: false,
    redirectUri: "",
  });
}

export function listOrgInvitations(orgId: string): Promise<InvitationRepresentation[]> {
  return orgsGet<InvitationRepresentation[]>(`/${orgId}/invitations`);
}

export async function cancelOrgInvitation(orgId: string, invitationId: string): Promise<void> {
  await orgsDelete(`/${orgId}/invitations/${invitationId}`);
}
