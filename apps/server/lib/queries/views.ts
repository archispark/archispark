import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchViews,
  fetchView,
  fetchViewpoints,
  createView,
  updateView,
  deleteView,
  type ViewCreateIn,
  type ViewUpdateIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useViews() {
  return useQuery({ queryKey: queryKeys.views(), queryFn: fetchViews })
}

export function useView(id: string) {
  return useQuery({
    queryKey: queryKeys.view(id),
    queryFn: () => fetchView(id),
    enabled: !!id,
  })
}

export function useViewpoints() {
  return useQuery({
    queryKey: queryKeys.viewpoints(),
    queryFn: fetchViewpoints,
    staleTime: Infinity,
  })
}

export function useCreateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ViewCreateIn) => createView(body),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: queryKeys.views() })
      toast.success(`Vue « ${v.name} » créée`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ViewUpdateIn }) =>
      updateView(id, body),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: queryKeys.views() })
      toast.success(`Vue « ${v.name} » mise à jour`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteView(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.views() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success("Vue supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
