import { get, post, put, del } from "./client"

export type OrgRole = "owner" | "editor" | "viewer"

export interface OrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  role: OrgRole
  active: boolean
}

export interface OrganizationMemberOut {
  user_id: string
  username: string
  role: OrgRole
  created_at: number
}

export const fetchOrganizations = () => get<OrganizationOut[]>("/organizations")

export const renameOrganizationApi = (id: string, name: string) =>
  put<OrganizationOut>(`/organizations/${encodeURIComponent(id)}`, { name })
export const activateOrganizationApi = (id: string) =>
  post<OrganizationOut>(`/organizations/${encodeURIComponent(id)}/activate`, {})

export const fetchOrganizationMembers = (orgId: string) =>
  get<OrganizationMemberOut[]>(
    `/organizations/${encodeURIComponent(orgId)}/members`
  )
export const addOrganizationMemberApi = (
  orgId: string,
  username: string,
  role: OrgRole
) =>
  post<OrganizationMemberOut>(
    `/organizations/${encodeURIComponent(orgId)}/members`,
    { username, role }
  )
export const updateOrganizationMemberRoleApi = (
  orgId: string,
  userId: string,
  role: OrgRole
) =>
  put<OrganizationMemberOut>(
    `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
    { role }
  )
export const removeOrganizationMemberApi = (orgId: string, userId: string) =>
  del(
    `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`
  )
