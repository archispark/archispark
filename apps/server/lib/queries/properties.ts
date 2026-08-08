import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchPropertyDefinitions,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
  type PropertyDefinitionCreateIn,
  type PropertyDefinitionUpdateIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function usePropertyDefinitions() {
  return useQuery({
    queryKey: queryKeys.propertyDefinitions(),
    queryFn: fetchPropertyDefinitions,
  })
}

export function useCreatePropertyDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PropertyDefinitionCreateIn) =>
      createPropertyDefinition(body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  })
}

export function useUpdatePropertyDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PropertyDefinitionUpdateIn
    }) => updatePropertyDefinition(id, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  })
}

export function useDeletePropertyDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePropertyDefinition(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  })
}
