import { get, put, del } from "./client"

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
