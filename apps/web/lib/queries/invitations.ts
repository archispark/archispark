import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchOrganizationInvitations,
  createInvitationApi,
  revokeInvitationApi,
  resendInvitationApi,
  getInvitationPreviewApi,
  acceptInvitationApi,
  type OrgRole,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useOrganizationInvitations(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizationInvitations(orgId),
    queryFn: () => fetchOrganizationInvitations(orgId),
    enabled: !!orgId,
  })
}

export function useCreateInvitation(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRole }) =>
      createInvitationApi(orgId, email, role),
    onSuccess: (invitation) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizationInvitations(orgId),
      })
      toast.success(
        invitation.sent_at
          ? `Invitation envoyée à ${invitation.email}`
          : `Invitation créée pour ${invitation.email}, mais l'envoi a échoué — utilisez « Renvoyer ».`
      )
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRevokeInvitation(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) =>
      revokeInvitationApi(orgId, invitationId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizationInvitations(orgId),
      })
      toast.success("Invitation révoquée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useResendInvitation(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) =>
      resendInvitationApi(orgId, invitationId),
    onSuccess: (invitation) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizationInvitations(orgId),
      })
      toast.success(
        invitation.sent_at
          ? `Invitation renvoyée à ${invitation.email}`
          : `L'envoi à ${invitation.email} a de nouveau échoué.`
      )
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: queryKeys.invitationPreview(token),
    queryFn: () => getInvitationPreviewApi(token),
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) => acceptInvitationApi(token),
    onError: (e) => toast.error((e as Error).message),
  })
}
