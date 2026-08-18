import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchSiteMessages,
  updateSiteMessages,
  type SiteMessages,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useSiteMessages() {
  return useQuery({
    queryKey: queryKeys.siteMessages(),
    queryFn: fetchSiteMessages,
  })
}

export function useUpdateSiteMessages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SiteMessages) => updateSiteMessages(body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.siteMessages() }),
    onError: (e) => toast.error((e as Error).message),
  })
}
