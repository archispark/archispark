import type { OrgRoleName } from "@workspace/auth";

export interface ModelInfo {
  identifier: string;
  name: string;
  documentation: string | null;
  version: string | null;
  element_count: number;
  relationship_count: number;
  view_count: number;
  property_definition_count: number;
  workspace_id: string | null;
  workspace_name: string | null;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  description?: string | null;
  path?: string | null;
  active: boolean;
  organization_id: string;
  team_ids: string[];
}

export interface Property {
  property_definition_ref: string;
  value: string;
}

export interface ElementOut {
  identifier: string;
  name: string;
  type: string;
  documentation: string | null;
  properties: Property[];
}

export interface RelationshipOut {
  identifier: string;
  name: string | null;
  type: string;
  source: string;
  source_name: string | null;
  target: string;
  target_name: string | null;
  documentation: string | null;
  properties: Property[];
}

export interface ViewOut {
  identifier: string;
  name: string;
  documentation: string | null;
  viewpoint: string | null;
  node_count: number;
  connection_count: number;
  ok_count: number;
  conflict_count: number;
}

export interface ViewDetail extends ViewOut {
  nodes: NodeOut[];
  connections: ConnectionOut[];
}

export interface NodeOut {
  identifier: string;
  name?: string | null;
  element_ref?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  children: NodeOut[];
}

export type EdgeSide = "top" | "right" | "bottom" | "left";

export interface ConnectionOut {
  identifier: string;
  name?: string | null;
  relationship_ref?: string | null;
  source?: string | null;
  target?: string | null;
  source_side?: EdgeSide | null;
  target_side?: EdgeSide | null;
}

const BASE = "/api";

export interface CurrentUser {
  id: string;
  username: string;
  role: string;
}

async function get<T>(path: string, headers: HeadersInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const fetchModel = () => get<ModelInfo>("/");
export const fetchElementTypes = () => get<string[]>("/elements/types");
export const fetchViewpoints = () => get<string[]>("/viewpoints");

export async function fetchElements(
  type?: string | null,
  name?: string | null
): Promise<ElementOut[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const qs = params.toString();
  return get(`/elements${qs ? `?${qs}` : ""}`);
}

export const fetchElement = (id: string) => get<ElementOut>(`/elements/${encodeURIComponent(id)}`);
export const fetchElementRelationships = (id: string) => get<RelationshipOut[]>(`/elements/${encodeURIComponent(id)}/relationships`);
export const fetchElementViews = (id: string) => get<ViewOut[]>(`/elements/${encodeURIComponent(id)}/views`);
export const fetchElementsInViews = () => get<string[]>("/elements/in-views");

export const fetchRelationship = (id: string) => get<RelationshipOut>(`/relationships/${encodeURIComponent(id)}`);
export const fetchRelationshipViews = (id: string) => get<ViewOut[]>(`/relationships/${encodeURIComponent(id)}/views`);
export const fetchRelationshipTypes = () => get<string[]>("/relationships/types");

export async function fetchRelationships(
  type?: string | null,
  name?: string | null
): Promise<RelationshipOut[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const qs = params.toString();
  return get(`/relationships${qs ? `?${qs}` : ""}`);
}

export const fetchViews = () => get<ViewOut[]>("/views");
export const fetchView = (id: string) => get<ViewDetail>(`/views/${encodeURIComponent(id)}`);

export function viewImageUrl(id: string): string {
  return `${BASE}/views/${encodeURIComponent(id)}/image?format=svg`;
}

// --- Mutations ---

async function post<T>(path: string, body: unknown, headers: HeadersInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export interface ElementCreateIn {
  name: string;
  type: string;
  documentation?: string | null;
  properties?: Property[];
}

export interface RelationshipCreateIn {
  name?: string | null;
  type: string;
  source: string;
  target: string;
  documentation?: string | null;
  properties?: Property[];
}

export interface ViewCreateIn {
  name: string;
  viewpoint?: string | null;
  documentation?: string | null;
}

async function put<T>(path: string, body: unknown, headers: HeadersInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function del(path: string, headers: HeadersInit = {}): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include", headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
}

export interface ElementUpdateIn {
  name?: string;
  type?: string;
  documentation?: string | null;
  properties?: Property[];
}

export interface RelationshipUpdateIn {
  name?: string | null;
  type?: string;
  source?: string;
  target?: string;
  documentation?: string | null;
  properties?: Property[];
}

export interface ViewUpdateIn {
  name?: string;
  viewpoint?: string | null;
  documentation?: string | null;
}

export const createElement = (body: ElementCreateIn) => post<ElementOut>("/elements", body);
export const updateElement = (id: string, body: ElementUpdateIn) => put<ElementOut>(`/elements/${encodeURIComponent(id)}`, body);
export const deleteElement = (id: string) => del(`/elements/${encodeURIComponent(id)}`);

export const createRelationship = (body: RelationshipCreateIn) => post<RelationshipOut>("/relationships", body);
export const updateRelationship = (id: string, body: RelationshipUpdateIn) => put<RelationshipOut>(`/relationships/${encodeURIComponent(id)}`, body);
export const deleteRelationship = (id: string) => del(`/relationships/${encodeURIComponent(id)}`);

export const createView = (body: ViewCreateIn) => post<ViewOut>("/views", body);
export const updateView = (id: string, body: ViewUpdateIn) => put<ViewOut>(`/views/${encodeURIComponent(id)}`, body);
export const deleteView = (id: string) => del(`/views/${encodeURIComponent(id)}`);

export const saveModel = () => post<{ saved: boolean; path: string }>("/save", {});

export interface NodeCreateIn {
  element_id: string;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
}

export interface NodeUpdateIn {
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  name?: string | null;
}

export interface ConnectionCreateIn {
  relationship_id?: string | null;
  source: string;
  target: string;
  name?: string | null;
  source_side?: EdgeSide | null;
  target_side?: EdgeSide | null;
}

export interface ConnectionUpdateIn {
  name?: string | null;
  source?: string;
  target?: string;
  source_side?: EdgeSide | null;
  target_side?: EdgeSide | null;
}

export const createViewNode = (viewId: string, body: NodeCreateIn) =>
  post<NodeOut>(`/views/${encodeURIComponent(viewId)}/nodes`, body);

export const updateViewNode = (viewId: string, nodeId: string, body: NodeUpdateIn) =>
  put<NodeOut>(`/views/${encodeURIComponent(viewId)}/nodes/${encodeURIComponent(nodeId)}`, body);

export const deleteViewNode = (viewId: string, nodeId: string) =>
  del(`/views/${encodeURIComponent(viewId)}/nodes/${encodeURIComponent(nodeId)}`);

export const createViewConnection = (viewId: string, body: ConnectionCreateIn) =>
  post<ConnectionOut>(`/views/${encodeURIComponent(viewId)}/connections`, body);

export const updateViewConnection = (viewId: string, connId: string, body: ConnectionUpdateIn) =>
  put<ConnectionOut>(`/views/${encodeURIComponent(viewId)}/connections/${encodeURIComponent(connId)}`, body);

export const deleteViewConnection = (viewId: string, connId: string) =>
  del(`/views/${encodeURIComponent(viewId)}/connections/${encodeURIComponent(connId)}`);

export const exportModelUrl = `${BASE}/export`;

// --- Auth ---

export interface UserOut {
  id: string;
  username: string;
  role: string;
  created_at: string;
}


export const fetchUsers = () => get<UserOut[]>("/users");

export interface UserCreateIn { username: string; password: string; role?: string; }
export interface UserUpdateIn { password?: string; role?: string; }

export const createUser = (body: UserCreateIn) => post<UserOut>("/users", body);
export const updateUserApi = (id: string, body: UserUpdateIn) => put<UserOut>(`/users/${encodeURIComponent(id)}`, body);
export const deleteUserApi = (id: string) => del(`/users/${encodeURIComponent(id)}`);

export async function importModel(file: File): Promise<ModelInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/import`, { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export interface PropertyDefinitionOut {
  identifier: string;
  name: string;
  type: string;
}

export interface PropertyDefinitionCreateIn {
  name: string;
  type?: string;
}

export interface PropertyDefinitionUpdateIn {
  name?: string;
  type?: string;
}

export const fetchPropertyDefinitions = () => get<PropertyDefinitionOut[]>("/property-definitions");
export const createPropertyDefinition = (body: PropertyDefinitionCreateIn) => post<PropertyDefinitionOut>("/property-definitions", body);
export const updatePropertyDefinition = (id: string, body: PropertyDefinitionUpdateIn) => put<PropertyDefinitionOut>(`/property-definitions/${encodeURIComponent(id)}`, body);
export const deletePropertyDefinition = (id: string) => del(`/property-definitions/${encodeURIComponent(id)}`);

// --- OAuth Providers ---

export type OAuthProviderType = "oidc" | "google" | "github" | "microsoft-entra-id";

export interface OAuthProviderOut {
  id: string;
  provider_id: string;
  type: OAuthProviderType;
  name: string;
  client_id: string;
  issuer_url: string | null;
  tenant_id: string | null;
  enabled: boolean;
  created_at: number;
}

export interface OAuthProviderCreateIn {
  type: OAuthProviderType;
  name: string;
  client_id: string;
  client_secret: string;
  issuer_url?: string;
  tenant_id?: string;
  enabled?: boolean;
}

export interface OAuthProviderUpdateIn {
  name?: string;
  client_id?: string;
  client_secret?: string;
  issuer_url?: string | null;
  tenant_id?: string | null;
  enabled?: boolean;
}

export const fetchProviders = () => get<OAuthProviderOut[]>("/settings/providers");
export const createProvider = (body: OAuthProviderCreateIn) => post<OAuthProviderOut>("/settings/providers", body);
export const updateProvider = (id: string, body: OAuthProviderUpdateIn) =>
  put<OAuthProviderOut>(`/settings/providers/${encodeURIComponent(id)}`, body);
export const deleteProvider = (id: string) => del(`/settings/providers/${encodeURIComponent(id)}`);

// --- PostgreSQL ---

export interface PostgresStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
  database: string | null;
  version: string | null;
}

export const fetchPostgresStatus = () => get<PostgresStatus>("/settings/postgres");

// --- API Tokens ---

export interface ApiTokenOut {
  id: number;
  name: string;
  user_id: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
}

export interface ApiTokenCreatedOut extends ApiTokenOut {
  token: string;
}

export const fetchApiTokens = () => get<ApiTokenOut[]>("/settings/api-tokens");
export const createApiToken = (name: string, expiresAt?: number) =>
  post<ApiTokenCreatedOut>("/settings/api-tokens", { name, expires_at: expiresAt ?? null });
export const deleteApiToken = (id: number) => del(`/settings/api-tokens/${id}`);

// --- Site messages ---

export interface SiteMessages {
  login_message: string | null;
  login_message_enabled: boolean;
  banner_message: string | null;
  banner_message_enabled: boolean;
}

export const fetchSiteMessages = () => get<SiteMessages>("/settings/messages");
export const updateSiteMessages = (body: SiteMessages) => put<{ ok: boolean }>("/settings/messages", body);

// --- Workspaces ---

export const fetchWorkspaces = () => get<WorkspaceInfo[]>("/workspaces");

export interface WorkspaceCreateIn { name: string; path?: string; description?: string | null; team_ids?: string[]; }
export interface WorkspaceUpdateIn { name: string; team_ids?: string[]; }

export const createWorkspaceApi = (body: WorkspaceCreateIn) => post<WorkspaceInfo>("/workspaces", body);
export const updateWorkspaceApi = (id: string, body: WorkspaceUpdateIn) => put<WorkspaceInfo>(`/workspaces/${encodeURIComponent(id)}`, body);
export const deleteWorkspaceApi = (id: string) => del(`/workspaces/${encodeURIComponent(id)}`);
export const activateWorkspaceApi = (id: string) => post<WorkspaceInfo>(`/workspaces/${encodeURIComponent(id)}/activate`, {});

// --- Organizations (current workspace: members, invitations, teams) ---

function orgHeaders(orgId: string): HeadersInit {
  return { "X-Org-Id": orgId };
}

export interface OrgMemberOut {
  user_id: string;
  username: string;
  email: string | null;
  role: OrgRoleName | null;
}

export interface OrgInvitationOut {
  id: string;
  email: string;
  roles: string[];
  created_at: string | null;
}

export interface OrgTeamOut {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
}

export interface OrgTeamMemberOut {
  user_id: string;
  username: string;
  email: string | null;
}

export const fetchOrgMembers = (orgId: string) =>
  get<OrgMemberOut[]>("/organizations/members", orgHeaders(orgId));

export const updateOrgMemberRole = (orgId: string, userId: string, role: OrgRoleName) =>
  put<{ ok: boolean }>(`/organizations/members/${encodeURIComponent(userId)}`, { role }, orgHeaders(orgId));

export const removeOrgMember = (orgId: string, userId: string) =>
  del(`/organizations/members/${encodeURIComponent(userId)}`, orgHeaders(orgId));

export const fetchOrgInvitations = (orgId: string) =>
  get<OrgInvitationOut[]>("/organizations/invitations", orgHeaders(orgId));

export const createOrgInvitation = (orgId: string, email: string, role: OrgRoleName) =>
  post<OrgInvitationOut>("/organizations/invitations", { email, role }, orgHeaders(orgId));

export const cancelOrgInvitation = (orgId: string, invitationId: string) =>
  del(`/organizations/invitations/${encodeURIComponent(invitationId)}`, orgHeaders(orgId));

export const fetchOrgTeams = (orgId: string) =>
  get<OrgTeamOut[]>("/organizations/teams", orgHeaders(orgId));

export const createOrgTeam = (orgId: string, name: string) =>
  post<OrgTeamOut>("/organizations/teams", { name }, orgHeaders(orgId));

export const updateOrgTeam = (orgId: string, teamId: string, name: string) =>
  put<OrgTeamOut>(`/organizations/teams/${encodeURIComponent(teamId)}`, { name }, orgHeaders(orgId));

export const removeOrgTeam = (orgId: string, teamId: string) =>
  del(`/organizations/teams/${encodeURIComponent(teamId)}`, orgHeaders(orgId));

export const fetchOrgTeamMembers = (orgId: string, teamId: string) =>
  get<OrgTeamMemberOut[]>(`/organizations/teams/${encodeURIComponent(teamId)}/members`, orgHeaders(orgId));

/** POST returns 204 with no body — can't use the generic `post<T>` helper, which always calls `.json()`. */
export async function addOrgTeamMember(orgId: string, teamId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/organizations/teams/${encodeURIComponent(teamId)}/members`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...orgHeaders(orgId) },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
}

export const removeOrgTeamMember = (orgId: string, teamId: string, userId: string) =>
  del(`/organizations/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, orgHeaders(orgId));
