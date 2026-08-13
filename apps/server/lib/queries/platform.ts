import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchPlatformOrganizations,
  setPlatformOrganizationEnabled,
  deletePlatformOrganizationApi,
  enterPlatformOrganization,
  fetchActivePlatformOrganization,
  exitPlatformOrganizationApi,
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

/**
 * platform_admin admin mode — which organization's content is currently
 * entered (see access.ts). `enabled` guards the request: the route 403s for
 * anyone who isn't platform_admin, so callers pass isPlatformAdmin here
 * rather than firing it for every session.
 */
export function useActivePlatformOrganization(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.platformActiveOrganization(),
    queryFn: fetchActivePlatformOrganization,
    enabled,
  })
}

export function useEnterPlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => enterPlatformOrganization(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.platformActiveOrganization(),
      }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useExitPlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: exitPlatformOrganizationApi,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.platformActiveOrganization(),
      }),
    onError: (e) => toast.error((e as Error).message),
  })
}
