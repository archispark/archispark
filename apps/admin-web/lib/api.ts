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

// --- Admin: organizations (platform-wide, includes tenant DB status) ---

export type TenantStatus = "pending" | "provisioning" | "active" | "error" | null;

export interface AdminOrganizationOut {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  created_at: string;
  tenant_status: TenantStatus;
  last_error: string | null;
}

export interface GeneratedOwner {
  username: string;
  password: string;
}

export interface AdminOrganizationCreateOut extends AdminOrganizationOut {
  /** Only present once, in the response to creation, when no `initial_owner_user_id` was given. */
  initial_owner?: GeneratedOwner;
}

export interface NeonStatus {
  configured: boolean;
  reachable: boolean;
  provider: "neon" | "local" | "none";
}

export interface VerifyDbResult {
  connected: boolean;
  latency_ms: number;
  version?: string;
}

export interface AdminOrganizationCreateIn {
  name: string;
  slug: string;
  /** Existing platform user to make owner of the new organization. If omitted, a fresh "admin-<slug>" account is generated and returned once as `initial_owner`. */
  initial_owner_user_id?: string;
}

export const fetchAdminOrganizations = () => get<AdminOrganizationOut[]>("/admin/organizations");
export const setOrganizationEnabledApi = (id: string, enabled: boolean) =>
  put<AdminOrganizationOut>(`/admin/organizations/${encodeURIComponent(id)}`, { enabled });
export const fetchNeonStatus = () => get<NeonStatus>("/admin/neon/status");
export const createAdminOrganization = (body: AdminOrganizationCreateIn) =>
  post<AdminOrganizationCreateOut>("/admin/organizations", body);
export const verifyOrganizationDb = (id: string) =>
  post<VerifyDbResult>(`/admin/organizations/${encodeURIComponent(id)}/verify-db`, {});
export const reprovisionOrganization = (id: string) =>
  post<AdminOrganizationOut>(`/admin/organizations/${encodeURIComponent(id)}/reprovision`, {});

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
