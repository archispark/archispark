import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchPlatformOrganizations,
  setPlatformOrganizationEnabled,
  deletePlatformOrganizationApi,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: queryKeys.platformOrganizations(),
    queryFn: fetchPlatformOrganizations,
  })
}

export function useSetPlatformOrganizationEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setPlatformOrganizationEnabled(id, enabled),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeletePlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePlatformOrganizationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() })
      toast.success("Organisation supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
