import { get, post, del } from "./client"

export interface ApiTokenOut {
  id: number
  name: string
  user_id: string
  created_at: number
  last_used_at: number | null
  expires_at: number | null
  // Absent when viewed by a platform_admin (isolation from organization data).
  organization_id?: string
  workspace_id?: string | null
}

export interface ApiTokenCreatedOut extends ApiTokenOut {
  token: string
}

export const fetchApiTokens = () => get<ApiTokenOut[]>("/settings/api-tokens")
export const createApiToken = (
  name: string,
  organizationId: string,
  workspaceId?: string | null,
  expiresAt?: number
) =>
  post<ApiTokenCreatedOut>("/settings/api-tokens", {
    name,
    organization_id: organizationId,
    workspace_id: workspaceId ?? null,
    expires_at: expiresAt ?? null,
  })
export const deleteApiToken = (id: number) => del(`/settings/api-tokens/${id}`)
