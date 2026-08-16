export const BASE = "/api"

export interface CurrentUser {
  id: string
  username: string
  role: string
}

export interface Property {
  property_definition_ref: string
  value: string
}

// Shared across all callers so concurrent 401s (e.g. several hooks mounting
// at once after the 15min access token expires) trigger a single refresh
// instead of each racing its own: the local refresh token is single-use, and
// the server treats a second presentation of an already-rotated one as theft
// — revoking the whole session. See local-auth-tokens.ts rotateRefreshToken.
let refreshInFlight: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

/** Replays one API request after silently renewing an expired session cookie. */
async function fetchWithSessionRefresh(
  path: string,
  init: RequestInit
): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, init)
  if (response.status !== 401) return response

  const refreshed = await refreshSession()
  if (!refreshed) return response

  return fetch(`${BASE}${path}`, init)
}

export async function get<T>(
  path: string,
  headers: HeadersInit = {}
): Promise<T> {
  const res = await fetchWithSessionRefresh(path, { credentials: "include", headers })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function post<T>(
  path: string,
  body: unknown,
  headers: HeadersInit = {}
): Promise<T> {
  const res = await fetchWithSessionRefresh(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
  return res.json()
}

export async function put<T>(
  path: string,
  body: unknown,
  headers: HeadersInit = {}
): Promise<T> {
  const res = await fetchWithSessionRefresh(path, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
  return res.json()
}

export async function del(
  path: string,
  headers: HeadersInit = {}
): Promise<void> {
  const res = await fetchWithSessionRefresh(path, {
    method: "DELETE",
    credentials: "include",
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
}
