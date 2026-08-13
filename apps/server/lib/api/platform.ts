import { get, post, put, del } from "./client"

export interface PlatformOrganizationOut {
  id: string
  slug: string
  name: string
  is_personal: boolean
  enabled: boolean
  created_at: number
}

export const fetchPlatformOrganizations = () =>
  get<PlatformOrganizationOut[]>("/platform/organizations")
export const setPlatformOrganizationEnabled = (id: string, enabled: boolean) =>
  put<PlatformOrganizationOut>(
    `/platform/organizations/${encodeURIComponent(id)}`,
    { enabled }
  )
export const deletePlatformOrganizationApi = (id: string) =>
  del(`/platform/organizations/${encodeURIComponent(id)}`)

/** platform_admin admin mode — entering an organization's actual content (see access.ts). */
export const enterPlatformOrganization = (id: string) =>
  post<PlatformOrganizationOut>(
    `/platform/organizations/${encodeURIComponent(id)}/enter`,
    {}
  )
export const fetchActivePlatformOrganization = () =>
  get<{ organization: PlatformOrganizationOut | null }>(
    "/platform/organizations/active"
  )
export const exitPlatformOrganizationApi = () =>
  del("/platform/organizations/active")
