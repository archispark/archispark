import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchDashboards,
  fetchDashboard,
  fetchDashboardsForAdministration,
  fetchPanelVisualizations,
  fetchPanelResult,
  runExploreQuery,
  createDashboard,
  updateDashboard,
  deleteDashboard,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useDashboards() {
  return useQuery({ queryKey: queryKeys.dashboards(), queryFn: fetchDashboards })
}

export function useDashboard(id: string) {
  return useQuery({ queryKey: queryKeys.dashboard(id), queryFn: () => fetchDashboard(id), enabled: !!id })
}

export function useDashboardsForAdministration() {
  return useQuery({ queryKey: queryKeys.dashboardsAdmin(), queryFn: fetchDashboardsForAdministration })
}

export function usePanelVisualizations() {
  return useQuery({ queryKey: queryKeys.panelVisualizations(), queryFn: fetchPanelVisualizations })
}

export function usePanelResult(dashboardId: string, panelInstanceId: string, parameters: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.panelResult(dashboardId, panelInstanceId, parameters),
    queryFn: () => fetchPanelResult(dashboardId, panelInstanceId, parameters),
  })
}

export function useRunExploreQuery() {
  return useMutation({
    mutationFn: ({ query, parameters }: { query: string; parameters: Record<string, unknown> }) =>
      runExploreQuery(query, parameters),
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (definition: unknown) => createDashboard(definition),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards() })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardsAdmin() })
    },
  })
}

export function useUpdateDashboard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (definition: unknown) => updateDashboard(id, definition),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards() })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(id) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardsAdmin() })
    },
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDashboard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards() })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardsAdmin() })
    },
  })
}
