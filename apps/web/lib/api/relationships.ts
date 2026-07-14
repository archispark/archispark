import { get, post, put, del, type Property } from "./client"
import type { ViewOut } from "./views"

export interface RelationshipOut {
  identifier: string
  name: string | null
  type: string
  source: string
  source_name: string | null
  target: string
  target_name: string | null
  documentation: string | null
  properties: Property[]
}

export interface RelationshipCreateIn {
  name?: string | null
  type: string
  source: string
  target: string
  documentation?: string | null
  properties?: Property[]
}

export interface RelationshipUpdateIn {
  name?: string | null
  type?: string
  source?: string
  target?: string
  documentation?: string | null
  properties?: Property[]
}

export const fetchRelationshipTypes = () =>
  get<string[]>("/relationships/types")

export async function fetchRelationships(
  type?: string | null,
  name?: string | null
): Promise<RelationshipOut[]> {
  const params = new URLSearchParams()
  if (type) params.set("type", type)
  if (name) params.set("name", name)
  const qs = params.toString()
  return get(`/relationships${qs ? `?${qs}` : ""}`)
}

export const fetchRelationship = (id: string) =>
  get<RelationshipOut>(`/relationships/${encodeURIComponent(id)}`)
export const fetchRelationshipViews = (id: string) =>
  get<ViewOut[]>(`/relationships/${encodeURIComponent(id)}/views`)

export const createRelationship = (body: RelationshipCreateIn) =>
  post<RelationshipOut>("/relationships", body)
export const updateRelationship = (id: string, body: RelationshipUpdateIn) =>
  put<RelationshipOut>(`/relationships/${encodeURIComponent(id)}`, body)
export const deleteRelationship = (id: string) =>
  del(`/relationships/${encodeURIComponent(id)}`)
