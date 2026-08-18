import { get, post, put, del } from "./client"

export interface PlatformOrganizationOut {
  id: string
  slug: string
  name: string
  description: string | null
  is_personal: boolean
  enabled: boolean
  created_at: number
}

export interface PlatformOrganizationMemberOut {
  id: string
  username: string
  email: string
  display_name: string | null
  role: string
}

export interface PlatformOrganizationDetailOut extends PlatformOrganizationOut {
  members: PlatformOrganizationMemberOut[]
}

export interface PlatformOrganizationCreateIn {
  name: string
  description?: string | null
}

export interface PlatformOrganizationUpdateIn {
  enabled?: boolean
  name?: string
  description?: string | null
}

export interface PlatformOrganizationMemberAddIn {
  user_id: string
  role: string
}

export const fetchPlatformOrganizations = () =>
  get<PlatformOrganizationOut[]>("/platform/organizations")
export const createPlatformOrganizationApi = (
  body: PlatformOrganizationCreateIn
) => post<PlatformOrganizationOut>("/platform/organizations", body)
export const fetchPlatformOrganization = (id: string) =>
  get<PlatformOrganizationDetailOut>(
    `/platform/organizations/${encodeURIComponent(id)}`
  )
export const updatePlatformOrganizationApi = (
  id: string,
  body: PlatformOrganizationUpdateIn
) =>
  put<PlatformOrganizationOut>(
    `/platform/organizations/${encodeURIComponent(id)}`,
    body
  )
export const setPlatformOrganizationEnabled = (id: string, enabled: boolean) =>
  updatePlatformOrganizationApi(id, { enabled })
export const deletePlatformOrganizationApi = (id: string) =>
  del(`/platform/organizations/${encodeURIComponent(id)}`)
export const addPlatformOrganizationMember = (
  id: string,
  body: PlatformOrganizationMemberAddIn
) =>
  post<PlatformOrganizationMemberOut>(
    `/platform/organizations/${encodeURIComponent(id)}/members`,
    body
  )
export const removePlatformOrganizationMember = (id: string, userId: string) =>
  del(
    `/platform/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`
  )

export interface PlatformUserOut {
  id: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  role: string
  enabled: boolean
  must_change_password: boolean
  created_at: number
  last_login_at: number | null
}

export interface PlatformUserOrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  role: string
}

export interface PlatformUserDetailOut extends PlatformUserOut {
  organizations: PlatformUserOrganizationOut[]
}

export interface PlatformUserUpdateIn {
  role?: string
  enabled?: boolean
  first_name?: string | null
  last_name?: string | null
  email?: string
  password?: string
}

export interface PlatformUserOrganizationAddIn {
  organization_id: string
  role: string
}

export interface PlatformUserCreateIn {
  username: string
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
  role?: string
}

export const fetchPlatformUsers = () =>
  get<PlatformUserOut[]>("/platform/users")
export const createPlatformUserApi = (body: PlatformUserCreateIn) =>
  post<PlatformUserOut>("/platform/users", body)
export const fetchPlatformUser = (id: string) =>
  get<PlatformUserDetailOut>(`/platform/users/${encodeURIComponent(id)}`)
export const updatePlatformUserApi = (id: string, body: PlatformUserUpdateIn) =>
  put<PlatformUserOut>(`/platform/users/${encodeURIComponent(id)}`, body)

export const addPlatformUserOrganization = (
  id: string,
  body: PlatformUserOrganizationAddIn
) =>
  post<PlatformUserOrganizationOut>(
    `/platform/users/${encodeURIComponent(id)}/organizations`,
    body
  )
export const removePlatformUserOrganization = (id: string, orgId: string) =>
  del(
    `/platform/users/${encodeURIComponent(id)}/organizations/${encodeURIComponent(orgId)}`
  )
