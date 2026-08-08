import { get, post, put, del } from "./client"

export type OAuthProviderType =
  | "oidc"
  | "google"
  | "github"
  | "microsoft-entra-id"

export interface OAuthProviderOut {
  id: string
  provider_id: string
  type: OAuthProviderType
  name: string
  client_id: string
  issuer_url: string | null
  tenant_id: string | null
  enabled: boolean
  created_at: number
}

export interface OAuthProviderCreateIn {
  type: OAuthProviderType
  name: string
  client_id: string
  client_secret: string
  issuer_url?: string
  tenant_id?: string
  enabled?: boolean
}

export interface OAuthProviderUpdateIn {
  name?: string
  client_id?: string
  client_secret?: string
  issuer_url?: string | null
  tenant_id?: string | null
  enabled?: boolean
}

export const fetchProviders = () =>
  get<OAuthProviderOut[]>("/settings/providers")
export const createProvider = (body: OAuthProviderCreateIn) =>
  post<OAuthProviderOut>("/settings/providers", body)
export const updateProvider = (id: string, body: OAuthProviderUpdateIn) =>
  put<OAuthProviderOut>(`/settings/providers/${encodeURIComponent(id)}`, body)
export const deleteProvider = (id: string) =>
  del(`/settings/providers/${encodeURIComponent(id)}`)
