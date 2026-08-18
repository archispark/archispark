import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchPlatformOrganizations,
  createPlatformOrganizationApi,
  fetchPlatformOrganization,
  updatePlatformOrganizationApi,
  setPlatformOrganizationEnabled,
  deletePlatformOrganizationApi,
  addPlatformOrganizationMember,
  removePlatformOrganizationMember,
  fetchPlatformUsers,
  createPlatformUserApi,
  fetchPlatformUser,
  updatePlatformUserApi,
  addPlatformUserOrganization,
  removePlatformUserOrganization,
  type PlatformOrganizationCreateIn,
  type PlatformOrganizationUpdateIn,
  type PlatformOrganizationMemberAddIn,
  type PlatformUserCreateIn,
  type PlatformUserUpdateIn,
  type PlatformUserOrganizationAddIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: queryKeys.platformOrganizations(),
    queryFn: fetchPlatformOrganizations,
  })
}

export function useCreatePlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PlatformOrganizationCreateIn) =>
      createPlatformOrganizationApi(body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() }),
    onError: (e) => toast.error((e as Error).message),
  })
}

/** platform_admin — a single organization plus its member list. */
export function usePlatformOrganization(id: string) {
  return useQuery({
    queryKey: queryKeys.platformOrganization(id),
    queryFn: () => fetchPlatformOrganization(id),
    enabled: !!id,
  })
}

export function useUpdatePlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: string
      changes: PlatformOrganizationUpdateIn
    }) => updatePlatformOrganizationApi(id, changes),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() })
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganization(id) })
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useSetPlatformOrganizationEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setPlatformOrganizationEnabled(id, enabled),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() })
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganization(id) })
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useAddPlatformOrganizationMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PlatformOrganizationMemberAddIn
    }) => addPlatformOrganizationMember(id, body),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganization(id) }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRemovePlatformOrganizationMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      removePlatformOrganizationMember(id, userId),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganization(id) }),
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

/** platform_admin — local accounts only, see platform-users-store.ts. */
export function usePlatformUsers() {
  return useQuery({
    queryKey: queryKeys.platformUsers(),
    queryFn: fetchPlatformUsers,
  })
}

export function useCreatePlatformUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PlatformUserCreateIn) => createPlatformUserApi(body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.platformUsers() }),
    onError: (e) => toast.error((e as Error).message),
  })
}

/** platform_admin — a single local account plus its organization memberships. */
export function usePlatformUser(id: string) {
  return useQuery({
    queryKey: queryKeys.platformUser(id),
    queryFn: () => fetchPlatformUser(id),
    enabled: !!id,
  })
}

export function useUpdatePlatformUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: string
      changes: PlatformUserUpdateIn
    }) => updatePlatformUserApi(id, changes),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.platformUsers() })
      qc.invalidateQueries({ queryKey: queryKeys.platformUser(id) })
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useAddPlatformUserOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PlatformUserOrganizationAddIn
    }) => addPlatformUserOrganization(id, body),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: queryKeys.platformUser(id) }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRemovePlatformUserOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, orgId }: { id: string; orgId: string }) =>
      removePlatformUserOrganization(id, orgId),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: queryKeys.platformUser(id) }),
    onError: (e) => toast.error((e as Error).message),
  })
}
