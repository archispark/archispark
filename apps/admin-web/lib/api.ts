const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

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

// --- Users ---

export interface UserOut {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface UserCreateIn { username: string; password: string; role?: string; }
export interface UserUpdateIn { password?: string; role?: string; }

export const fetchUsers = () => get<UserOut[]>("/users");
export const createUser = (body: UserCreateIn) => post<UserOut>("/users", body);
export const updateUserApi = (id: string, body: UserUpdateIn) => put<UserOut>(`/users/${encodeURIComponent(id)}`, body);
export const deleteUserApi = (id: string) => del(`/users/${encodeURIComponent(id)}`);

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

// --- Admin: organizations (platform-wide, includes tenant DB status) ---

export type TenantStatus = "pending" | "provisioning" | "active" | "error" | null;

export interface AdminOrganizationOut {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  created_at: string;
  tenant_status: TenantStatus;
}

export const fetchAdminOrganizations = () => get<AdminOrganizationOut[]>("/admin/organizations");
export const setOrganizationEnabledApi = (id: string, enabled: boolean) =>
  put<AdminOrganizationOut>(`/admin/organizations/${encodeURIComponent(id)}`, { enabled });

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

// --- PostgreSQL ---

export interface PostgresStatus {
  connected: boolean;
  host: string | null;
  port: number | null;
  database: string | null;
  version: string | null;
}

export const fetchPostgresStatus = () => get<PostgresStatus>("/settings/postgres");

// --- Site messages ---

export interface SiteMessages {
  login_message: string | null;
  login_message_enabled: boolean;
  banner_message: string | null;
  banner_message_enabled: boolean;
}

export const fetchSiteMessages = () => get<SiteMessages>("/settings/messages");
export const updateSiteMessages = (body: SiteMessages) => put<{ ok: boolean }>("/settings/messages", body);
