import { get, post, put, del, BASE } from "./client"

export interface ViewOut {
  identifier: string
  name: string
  documentation: string | null
  viewpoint: string | null
  node_count: number
  connection_count: number
  ok_count: number
  conflict_count: number
}

export interface ViewDetail extends ViewOut {
  nodes: NodeOut[]
  connections: ConnectionOut[]
}

export interface NodeOut {
  identifier: string
  name?: string | null
  element_ref?: string | null
  x?: number | null
  y?: number | null
  w?: number | null
  h?: number | null
  children: NodeOut[]
}

export type EdgeSide = "top" | "right" | "bottom" | "left"

export interface ConnectionOut {
  identifier: string
  name?: string | null
  relationship_ref?: string | null
  source?: string | null
  target?: string | null
  source_side?: EdgeSide | null
  target_side?: EdgeSide | null
}

export interface ViewCreateIn {
  name: string
  viewpoint?: string | null
  documentation?: string | null
}

export interface ViewUpdateIn {
  name?: string
  viewpoint?: string | null
  documentation?: string | null
}

export interface NodeCreateIn {
  element_id: string
  x?: number | null
  y?: number | null
  w?: number | null
  h?: number | null
}

export interface NodeUpdateIn {
  x?: number | null
  y?: number | null
  w?: number | null
  h?: number | null
  name?: string | null
}

export interface ConnectionCreateIn {
  relationship_id?: string | null
  source: string
  target: string
  name?: string | null
  source_side?: EdgeSide | null
  target_side?: EdgeSide | null
}

export interface ConnectionUpdateIn {
  name?: string | null
  source?: string
  target?: string
  source_side?: EdgeSide | null
  target_side?: EdgeSide | null
}

export const fetchViewpoints = () => get<string[]>("/viewpoints")
export const fetchViews = () => get<ViewOut[]>("/views")
export const fetchView = (id: string) =>
  get<ViewDetail>(`/views/${encodeURIComponent(id)}`)

export function viewImageUrl(id: string): string {
  return `${BASE}/views/${encodeURIComponent(id)}/image?format=svg`
}

export const createView = (body: ViewCreateIn) => post<ViewOut>("/views", body)
export const updateView = (id: string, body: ViewUpdateIn) =>
  put<ViewOut>(`/views/${encodeURIComponent(id)}`, body)
export const deleteView = (id: string) =>
  del(`/views/${encodeURIComponent(id)}`)

export const createViewNode = (viewId: string, body: NodeCreateIn) =>
  post<NodeOut>(`/views/${encodeURIComponent(viewId)}/nodes`, body)

export const updateViewNode = (
  viewId: string,
  nodeId: string,
  body: NodeUpdateIn
) =>
  put<NodeOut>(
    `/views/${encodeURIComponent(viewId)}/nodes/${encodeURIComponent(nodeId)}`,
    body
  )

export const deleteViewNode = (viewId: string, nodeId: string) =>
  del(
    `/views/${encodeURIComponent(viewId)}/nodes/${encodeURIComponent(nodeId)}`
  )

export const createViewConnection = (
  viewId: string,
  body: ConnectionCreateIn
) =>
  post<ConnectionOut>(`/views/${encodeURIComponent(viewId)}/connections`, body)

export const updateViewConnection = (
  viewId: string,
  connId: string,
  body: ConnectionUpdateIn
) =>
  put<ConnectionOut>(
    `/views/${encodeURIComponent(viewId)}/connections/${encodeURIComponent(connId)}`,
    body
  )

export const deleteViewConnection = (viewId: string, connId: string) =>
  del(
    `/views/${encodeURIComponent(viewId)}/connections/${encodeURIComponent(connId)}`
  )
