import { get, put } from "./client"

export interface SiteMessages {
  login_message: string | null
  login_message_enabled: boolean
  banner_message: string | null
  banner_message_enabled: boolean
}

export const fetchSiteMessages = () => get<SiteMessages>("/settings/messages")
export const updateSiteMessages = (body: SiteMessages) =>
  put<{ ok: boolean }>("/settings/messages", body)
