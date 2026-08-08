import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchOrganizations,
  createOrganizationApi,
  renameOrganizationApi,
  deleteOrganizationApi,
  activateOrganizationApi,
  fetchOrganizationMembers,
  addOrganizationMemberApi,
  updateOrganizationMemberRoleApi,
  removeOrganizationMemberApi,
  type OrgRole,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations(),
    queryFn: fetchOrganizations,
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createOrganizationApi(name),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations() })
      toast.success(`Organisation « ${org.name} » créée`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRenameOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameOrganizationApi(id, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.organizations() }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrganizationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations() })
      toast.success("Organisation supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useActivateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activateOrganizationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations() })
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useOrganizationMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizationMembers(orgId),
    queryFn: () => fetchOrganizationMembers(orgId),
    enabled: !!orgId,
  })
}

export function useAddOrganizationMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ username, role }: { username: string; role: OrgRole }) =>
      addOrganizationMemberApi(orgId, username, role),
    onSuccess: (member) => {
      qc.invalidateQueries({ queryKey: queryKeys.organizationMembers(orgId) })
      toast.success(`« ${member.username} » ajouté à l'organisation`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateOrganizationMemberRole(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      updateOrganizationMemberRoleApi(orgId, userId, role),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.organizationMembers(orgId) }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRemoveOrganizationMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeOrganizationMemberApi(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizationMembers(orgId) })
      toast.success("Membre retiré")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
