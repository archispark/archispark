import { get, post, put, del } from "./client"

export interface WorkspaceInfo {
  id: string
  name: string
  description?: string | null
  path?: string | null
  active: boolean
  organization_id: string
  created_by_id: string
}

export interface WorkspaceCreateIn {
  name: string
  path?: string
  description?: string | null
  organization_id?: string
}
export interface WorkspaceUpdateIn {
  name: string
  description?: string | null
}

export const fetchWorkspaces = () => get<WorkspaceInfo[]>("/workspaces")

export const createWorkspaceApi = (body: WorkspaceCreateIn) =>
  post<WorkspaceInfo>("/workspaces", body)
export const updateWorkspaceApi = (id: string, body: WorkspaceUpdateIn) =>
  put<WorkspaceInfo>(`/workspaces/${encodeURIComponent(id)}`, body)
export const deleteWorkspaceApi = (id: string) =>
  del(`/workspaces/${encodeURIComponent(id)}`)
export const activateWorkspaceApi = (id: string) =>
  post<WorkspaceInfo>(`/workspaces/${encodeURIComponent(id)}/activate`, {})
