import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchPlugins,
  fetchPlatformPlugins,
  fetchPlatformPlugin,
  setPlatformPluginEnabled,
} from "@/lib/api"
import { queryKeys } from "./keys"

/** Public — enabled plugins with their icons, for the icon picker. */
export function usePlugins() {
  return useQuery({
    queryKey: queryKeys.plugins(),
    queryFn: fetchPlugins,
  })
}

/** platform_admin — every discovered plugin, for the /platform/plugins table. */
export function usePlatformPlugins() {
  return useQuery({
    queryKey: queryKeys.platformPlugins(),
    queryFn: fetchPlatformPlugins,
  })
}

/** platform_admin — one plugin's content, for the /platform/plugins/[slug]
 *  detail view. */
export function usePlatformPlugin(slug: string) {
  return useQuery({
    queryKey: queryKeys.platformPlugin(slug),
    queryFn: () => fetchPlatformPlugin(slug),
    enabled: !!slug,
  })
}

export function useSetPlatformPluginEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      setPlatformPluginEnabled(slug, enabled),
    onSuccess: (_data, { slug }) => {
      qc.invalidateQueries({ queryKey: queryKeys.platformPlugins() })
      qc.invalidateQueries({ queryKey: queryKeys.platformPlugin(slug) })
      qc.invalidateQueries({ queryKey: queryKeys.plugins() })
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
