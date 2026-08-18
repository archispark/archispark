import { get, post, del } from "./client"
import type { OrgRole } from "./organizations"

export type InvitationDeliveryMode = "email" | "manual" | "both"

export interface OrganizationInvitationOut {
  id: string
  email: string
  role: OrgRole
  created_at: number
  expires_at: number
  sent_at: number | null
  expired: boolean
  accept_url?: string
  delivery_kind?: "manual" | "invitation" | "onboarding"
}

export interface InvitationPreviewOut {
  organization_name: string
  role: OrgRole
  email: string
}

export interface AcceptInvitationOut {
  organization_id: string
  role: OrgRole
}

export const fetchOrganizationInvitations = (orgId: string) =>
  get<OrganizationInvitationOut[]>(
    `/organizations/${encodeURIComponent(orgId)}/invitations`
  )
export const createInvitationApi = (
  orgId: string,
  email: string,
  role: OrgRole,
  deliveryMode: InvitationDeliveryMode
) =>
  post<OrganizationInvitationOut>(
    `/organizations/${encodeURIComponent(orgId)}/invitations`,
    { email, role, delivery_mode: deliveryMode }
  )
export const revokeInvitationApi = (orgId: string, invitationId: string) =>
  del(
    `/organizations/${encodeURIComponent(orgId)}/invitations/${encodeURIComponent(invitationId)}`
  )
export const resendInvitationApi = (
  orgId: string,
  invitationId: string,
  deliveryMode: InvitationDeliveryMode
) =>
  post<OrganizationInvitationOut>(
    `/organizations/${encodeURIComponent(orgId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
    { delivery_mode: deliveryMode }
  )
export const getInvitationPreviewApi = (token: string) =>
  get<InvitationPreviewOut>(`/invitations/${encodeURIComponent(token)}`)
export const acceptInvitationApi = (token: string) =>
  post<AcceptInvitationOut>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    {}
  )
