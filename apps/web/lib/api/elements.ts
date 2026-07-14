import { get, post, put, del, type Property } from "./client"
import type { RelationshipOut } from "./relationships"
import type { ViewOut } from "./views"

export interface ElementOut {
  identifier: string
  name: string
  type: string
  documentation: string | null
  properties: Property[]
}

export interface ElementCreateIn {
  name: string
  type: string
  documentation?: string | null
  properties?: Property[]
}

export interface ElementUpdateIn {
  name?: string
  type?: string
  documentation?: string | null
  properties?: Property[]
}

export const fetchElementTypes = () => get<string[]>("/elements/types")

export async function fetchElements(
  type?: string | null,
  name?: string | null
): Promise<ElementOut[]> {
  const params = new URLSearchParams()
  if (type) params.set("type", type)
  if (name) params.set("name", name)
  const qs = params.toString()
  return get(`/elements${qs ? `?${qs}` : ""}`)
}

export const fetchElement = (id: string) =>
  get<ElementOut>(`/elements/${encodeURIComponent(id)}`)
export const fetchElementRelationships = (id: string) =>
  get<RelationshipOut[]>(`/elements/${encodeURIComponent(id)}/relationships`)
export const fetchElementViews = (id: string) =>
  get<ViewOut[]>(`/elements/${encodeURIComponent(id)}/views`)
export const fetchElementsInViews = () => get<string[]>("/elements/in-views")

export const createElement = (body: ElementCreateIn) =>
  post<ElementOut>("/elements", body)
export const updateElement = (id: string, body: ElementUpdateIn) =>
  put<ElementOut>(`/elements/${encodeURIComponent(id)}`, body)
export const deleteElement = (id: string) =>
  del(`/elements/${encodeURIComponent(id)}`)
