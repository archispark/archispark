import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchWorkspaces,
  createWorkspaceApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
  activateWorkspaceApi,
  type WorkspaceCreateIn,
  type WorkspaceUpdateIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces(),
    queryFn: fetchWorkspaces,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: WorkspaceCreateIn) => createWorkspaceApi(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces() }),
  })
}

export function useActivateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activateWorkspaceApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WorkspaceUpdateIn }) =>
      updateWorkspaceApi(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkspaceApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
  })
}
