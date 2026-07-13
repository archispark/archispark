import { getKeycloakConfig } from "./config.js"
import { getAdminToken } from "./admin-token.js"

export interface KeycloakUserRepresentation {
  id?: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled?: boolean
  emailVerified?: boolean
  createdTimestamp?: number
  attributes?: Record<string, string[]>
}

export interface KeycloakRoleRepresentation {
  id?: string
  name: string
  description?: string
  composite?: boolean
  clientRole?: boolean
  containerId?: string
}

function adminBaseUrl(): string {
  const { url, realm } = getKeycloakConfig()
  return `${url}/admin/realms/${realm}`
}

async function adminRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAdminToken()
  return fetch(`${adminBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
  })
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await adminRequest(path)
  if (!res.ok) {
    throw new Error(
      `Keycloak admin request failed: GET ${path} -> ${res.status}`
    )
  }
  return (await res.json()) as T
}

/** POSTs a JSON body and returns the id of the created resource (last path segment of the Location header). */
async function adminPostForLocation(
  path: string,
  body: unknown
): Promise<string> {
  const res = await adminRequest(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(
      `Keycloak admin request failed: POST ${path} -> ${res.status}`
    )
  }
  const location = res.headers.get("location")
  if (!location) {
    throw new Error(
      `Keycloak admin response missing Location header for POST ${path}`
    )
  }
  return location.substring(location.lastIndexOf("/") + 1)
}

async function adminPut(path: string, body?: unknown): Promise<void> {
  const res = await adminRequest(path, {
    method: "PUT",
    headers:
      body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(
      `Keycloak admin request failed: PUT ${path} -> ${res.status}`
    )
  }
}

async function adminPostNoContent(path: string, body: unknown): Promise<void> {
  const res = await adminRequest(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(
      `Keycloak admin request failed: POST ${path} -> ${res.status}`
    )
  }
}

/** Returns the user with this exact username, or null if none exists. */
export async function findUserByUsername(
  username: string
): Promise<KeycloakUserRepresentation | null> {
  const users = await adminGet<KeycloakUserRepresentation[]>(
    `/users?username=${encodeURIComponent(username)}&exact=true`
  )
  return users.find((u) => u.username === username) ?? null
}

/** Returns the user with this id, or null if it doesn't exist (404). */
export async function getKeycloakUser(
  userId: string
): Promise<KeycloakUserRepresentation | null> {
  const res = await adminRequest(`/users/${userId}`)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(
      `Keycloak admin request failed: GET /users/${userId} -> ${res.status}`
    )
  }
  return (await res.json()) as KeycloakUserRepresentation
}

/** Creates a user and returns its generated id. */
export function createKeycloakUser(
  data: KeycloakUserRepresentation
): Promise<string> {
  return adminPostForLocation("/users", data)
}

export function updateKeycloakUser(
  userId: string,
  data: Partial<KeycloakUserRepresentation>
): Promise<void> {
  return adminPut(`/users/${userId}`, data)
}

export function setUserPassword(
  userId: string,
  password: string,
  temporary = false
): Promise<void> {
  return adminPut(`/users/${userId}/reset-password`, {
    type: "password",
    value: password,
    temporary,
  })
}

export function getUserRealmRoles(
  userId: string
): Promise<KeycloakRoleRepresentation[]> {
  return adminGet<KeycloakRoleRepresentation[]>(
    `/users/${userId}/role-mappings/realm`
  )
}

function getRealmRole(roleName: string): Promise<KeycloakRoleRepresentation> {
  return adminGet<KeycloakRoleRepresentation>(`/roles/${roleName}`)
}

export async function assignRealmRole(
  userId: string,
  roleName: string
): Promise<void> {
  const role = await getRealmRole(roleName)
  await adminPostNoContent(`/users/${userId}/role-mappings/realm`, [role])
}
