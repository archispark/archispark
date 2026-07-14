import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchElements,
  fetchElement,
  fetchElementTypes,
  fetchElementRelationships,
  fetchElementViews,
  fetchElementsInViews,
  createElement,
  updateElement,
  deleteElement,
  type ElementCreateIn,
  type ElementUpdateIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useElements(type?: string | null, name?: string | null) {
  return useQuery({
    queryKey: queryKeys.elements(type, name),
    queryFn: () => fetchElements(type, name),
  })
}

export function useElement(id: string) {
  return useQuery({
    queryKey: queryKeys.element(id),
    queryFn: () => fetchElement(id),
    enabled: !!id,
  })
}

export function useElementRelationships(id: string) {
  return useQuery({
    queryKey: queryKeys.elementRelationships(id),
    queryFn: () => fetchElementRelationships(id),
    enabled: !!id,
  })
}

export function useElementViews(id: string) {
  return useQuery({
    queryKey: queryKeys.elementViews(id),
    queryFn: () => fetchElementViews(id),
    enabled: !!id,
  })
}

export function useElementsInViews() {
  return useQuery({
    queryKey: queryKeys.elementsInViews(),
    queryFn: fetchElementsInViews,
  })
}

export function useElementTypes() {
  return useQuery({
    queryKey: queryKeys.elementTypes(),
    queryFn: fetchElementTypes,
    staleTime: Infinity,
  })
}

export function useCreateElement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ElementCreateIn) => createElement(body),
    onSuccess: (el) => {
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success(`Élément « ${el.name} » créé`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateElement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ElementUpdateIn }) =>
      updateElement(id, body),
    onSuccess: (el, { id }) => {
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: queryKeys.element(id) })
      toast.success(`Élément « ${el.name} » mis à jour`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteElement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteElement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success("Élément supprimé")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
