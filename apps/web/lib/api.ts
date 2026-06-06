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
  path: string;
  active: boolean;
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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include" });
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
export type LayerRole = string; // legacy alias

export interface RoleCatalog {
  layers: readonly string[];
  flags: readonly string[];
}

export interface RoleOut {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  permissions: Record<ArchiLayer, LayerPermissions>;
  user_ids: string[];
}

export interface RoleCreateIn {
  name: string;
  description?: string | null;
  permissions?: Partial<Record<ArchiLayer, LayerPermissions>>;
}

export interface RoleUpdateIn {
  name?: string;
  description?: string | null;
  permissions?: Partial<Record<ArchiLayer, LayerPermissions>>;
}

export const fetchRoleCatalog = () => get<RoleCatalog>("/roles/catalog");
export const fetchRoles = () => get<RoleOut[]>("/roles");
export const fetchRole = (roleId: string) => get<RoleOut>(`/roles/${encodeURIComponent(roleId)}`);
export const createRole = (body: RoleCreateIn) => post<RoleOut>("/roles", body);
export const updateRole = (roleId: string, body: RoleUpdateIn) => put<RoleOut>(`/roles/${encodeURIComponent(roleId)}`, body);
export const deleteRole = (roleId: string) => del(`/roles/${encodeURIComponent(roleId)}`);

export async function assignUserToRole(roleId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/roles/${encodeURIComponent(roleId)}/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
}

export const unassignUserFromRole = (roleId: string, userId: string) =>
  del(`/roles/${encodeURIComponent(roleId)}/users/${encodeURIComponent(userId)}`);

export const fetchUserRoles = (userId: string) =>
  get<RoleOut[]>(`/users/${encodeURIComponent(userId)}/roles`);

export interface LayerPermissionOut {
  layer: string;
  permissions: LayerPermissions;
}

export const fetchRoleLayers = (roleId: string) =>
  get<Record<ArchiLayer, LayerPermissions>>(`/roles/${encodeURIComponent(roleId)}/layers`);

export const fetchRoleLayer = (roleId: string, layer: string) =>
  get<LayerPermissionOut>(`/roles/${encodeURIComponent(roleId)}/layers/${encodeURIComponent(layer)}`);

export const setRoleLayer = (roleId: string, layer: string, permissions: LayerPermissions) =>
  put<LayerPermissionOut>(`/roles/${encodeURIComponent(roleId)}/layers/${encodeURIComponent(layer)}`, { permissions });

export const removeRoleLayer = (roleId: string, layer: string) =>
  del(`/roles/${encodeURIComponent(roleId)}/layers/${encodeURIComponent(layer)}`);

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

// --- Redis ---

export interface RedisStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
}

export const fetchRedisStatus = () => get<RedisStatus>("/settings/redis");

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

// --- Workspaces ---

export const fetchWorkspaces = () => get<WorkspaceInfo[]>("/workspaces");

export interface WorkspaceCreateIn { name: string; path?: string; }
export interface WorkspaceUpdateIn { name: string; }

export const createWorkspaceApi = (body: WorkspaceCreateIn) => post<WorkspaceInfo>("/workspaces", body);
export const updateWorkspaceApi = (id: string, body: WorkspaceUpdateIn) => put<WorkspaceInfo>(`/workspaces/${encodeURIComponent(id)}`, body);
export const deleteWorkspaceApi = (id: string) => del(`/workspaces/${encodeURIComponent(id)}`);
export const activateWorkspaceApi = (id: string) => post<WorkspaceInfo>(`/workspaces/${encodeURIComponent(id)}/activate`, {});
