import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchRelationship,
  fetchRelationshipViews,
  fetchRelationships,
  fetchRelationshipTypes,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  type RelationshipCreateIn,
  type RelationshipUpdateIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useRelationship(id: string) {
  return useQuery({
    queryKey: queryKeys.relationship(id),
    queryFn: () => fetchRelationship(id),
    enabled: !!id,
  })
}

export function useRelationshipViews(id: string) {
  return useQuery({
    queryKey: queryKeys.relationshipViews(id),
    queryFn: () => fetchRelationshipViews(id),
    enabled: !!id,
  })
}

export function useRelationships(type?: string | null, name?: string | null) {
  return useQuery({
    queryKey: queryKeys.relationships(type, name),
    queryFn: () => fetchRelationships(type, name),
  })
}

export function useRelationshipTypes() {
  return useQuery({
    queryKey: queryKeys.relationshipTypes(),
    queryFn: fetchRelationshipTypes,
    staleTime: Infinity,
  })
}

export function useCreateRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RelationshipCreateIn) => createRelationship(body),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: ["elementRelationships"] })
      toast.success(`Relation ${r.type} créée`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RelationshipUpdateIn }) =>
      updateRelationship(id, body),
    onSuccess: (r, { id }) => {
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: ["elementRelationships"] })
      qc.invalidateQueries({ queryKey: queryKeys.relationship(id) })
      toast.success(`Relation ${r.type} mise à jour`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRelationship(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: ["elementRelationships"] })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success("Relation supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
