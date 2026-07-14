import { BASE, get, post } from "./client"

export interface ModelInfo {
  identifier: string
  name: string
  documentation: string | null
  version: string | null
  element_count: number
  relationship_count: number
  view_count: number
  property_definition_count: number
  workspace_id: string | null
  workspace_name: string | null
}

export const fetchModel = () => get<ModelInfo>("/")

export const saveModel = () =>
  post<{ saved: boolean; path: string }>("/save", {})

export const exportModelUrl = `${BASE}/export`

export async function importModel(file: File): Promise<ModelInfo> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE}/import`, {
    method: "POST",
    credentials: "include",
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
  return res.json()
}
