import { get, post, put, del } from "./client"
import type {
  DashboardDefinition,
  DashboardRevision,
  PanelResult,
  PanelVisualizationMetadata,
} from "@/lib/dashboards/contracts"

export interface DashboardAdministrationEntry {
  revision: DashboardRevision
  isSystem: boolean
  deletedAt: string | null
}

export interface ExploreGraphNode {
  id: string
  name: string
  type: string
}

export interface ExploreGraphEdge {
  id: string
  source: string
  target: string
  type: string
}

export interface ExploreQueryResult {
  rows: Record<string, unknown>[]
  nodes: ExploreGraphNode[]
  edges: ExploreGraphEdge[]
  truncated: boolean
  durationMs: number
}

export const fetchDashboards = () => get<DashboardRevision[]>("/dashboards")
export const fetchDashboard = (id: string) =>
  get<DashboardRevision & { isSystem: boolean }>(`/dashboards/${encodeURIComponent(id)}`)
export const fetchDashboardsForAdministration = () =>
  get<DashboardAdministrationEntry[]>("/dashboards/admin")

export const createDashboard = (definition: unknown) => post<DashboardRevision>("/dashboards", definition)
export const updateDashboard = (id: string, definition: unknown) =>
  put<DashboardRevision>(`/dashboards/${encodeURIComponent(id)}`, definition)
export const deleteDashboard = (id: string) => del(`/dashboards/${encodeURIComponent(id)}`)

export const fetchPanelVisualizations = () =>
  get<{ visualizations: PanelVisualizationMetadata[] }>("/panel-visualizations")

export const fetchPanelResult = (
  dashboardId: string,
  panelInstanceId: string,
  parameters: Record<string, string> = {}
) => {
  const query = new URLSearchParams(parameters).toString()
  return get<PanelResult>(
    `/dashboards/${encodeURIComponent(dashboardId)}/panels/${encodeURIComponent(panelInstanceId)}${query ? `?${query}` : ""}`
  )
}

export const runExploreQuery = (query: string, parameters: Record<string, unknown>) =>
  post<ExploreQueryResult>("/explore", { query, parameters })

export type { DashboardDefinition, DashboardRevision, PanelResult }
