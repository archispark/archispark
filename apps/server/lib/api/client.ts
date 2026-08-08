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

export async function get<T>(
  path: string,
  headers: HeadersInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", headers })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function post<T>(
  path: string,
  body: unknown,
  headers: HeadersInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
  const res = await fetch(`${BASE}${path}`, {
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
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
}
