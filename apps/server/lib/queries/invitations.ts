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
  type InvitationDeliveryMode,
} from "@/lib/api"
import { queryKeys } from "./keys"

function invitationSuccessMessage(
  invitation: {
    email: string
    sent_at: number | null
    accept_url?: string
    delivery_kind?: "manual" | "invitation" | "onboarding"
  },
  resent = false
): string {
  if (invitation.delivery_kind === "onboarding") {
    return resent
      ? `E-mail de finalisation du compte renvoyé à ${invitation.email}`
      : `Compte préparé et e-mail de finalisation envoyé à ${invitation.email}`
  }
  if (invitation.accept_url && invitation.sent_at) {
    return resent
      ? `Invitation renvoyée à ${invitation.email} et lien régénéré`
      : `Invitation envoyée à ${invitation.email} et lien prêt à copier`
  }
  if (invitation.accept_url) {
    return resent
      ? `Lien d’invitation régénéré pour ${invitation.email}`
      : `Lien d’invitation créé pour ${invitation.email}`
  }
  if (invitation.sent_at) {
    return resent
      ? `Invitation renvoyée à ${invitation.email}`
      : `Invitation envoyée à ${invitation.email}`
  }
  return resent
    ? `L’envoi à ${invitation.email} a de nouveau échoué.`
    : `Invitation créée pour ${invitation.email}, mais l’envoi a échoué — utilisez « Renvoyer ».`
}

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
    mutationFn: ({
      email,
      role,
      deliveryMode,
    }: {
      email: string
      role: OrgRole
      deliveryMode: InvitationDeliveryMode
    }) => createInvitationApi(orgId, email, role, deliveryMode),
    onSuccess: (invitation) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizationInvitations(orgId),
      })
      toast.success(invitationSuccessMessage(invitation))
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
    mutationFn: ({
      invitationId,
      deliveryMode,
    }: {
      invitationId: string
      deliveryMode: InvitationDeliveryMode
    }) => resendInvitationApi(orgId, invitationId, deliveryMode),
    onSuccess: (invitation) => {
      qc.invalidateQueries({
        queryKey: queryKeys.organizationInvitations(orgId),
      })
      toast.success(invitationSuccessMessage(invitation, true))
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
