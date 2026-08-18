"use client"

import { useParams } from "next/navigation"
import { Ban, Play } from "lucide-react"
import { useT } from "@/lib/i18n"
import { usePlatformPlugin, useSetPlatformPluginEnabled } from "@/lib/queries"
import { PluginContentView } from "@/components/plugin-content-view"

/**
 * platform_admin-only — one plugin's content, previewed regardless of its
 * enabled state (see app/api/platform/plugins/[slug]/icons/[iconSlug]/
 * route.ts), with the same enable/disable toggle as the list page.
 */
export default function PlatformPluginDetailPage() {
  const params = useParams<{ slug: string }>()!
  const slug = decodeURIComponent(params.slug)
  const { t } = useT()
  const { data: plugin, isLoading } = usePlatformPlugin(slug)
  const setEnabled = useSetPlatformPluginEnabled()

  if (isLoading) {
    return (
      <div className="p-7 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!plugin) {
    return (
      <div className="max-w-3xl space-y-4 p-7">
        <p className="text-sm text-muted-foreground">
          {t("platform.plugins.plugin_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {plugin.name}
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
              v{plugin.version}
            </span>
          </h1>
          <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
            {plugin.slug}
          </p>
          {plugin.description && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {plugin.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-[11px] font-medium ${plugin.enabled ? "text-primary" : "text-destructive"}`}
          >
            {plugin.enabled
              ? t("platform.status_enabled")
              : t("platform.status_suspended")}
          </span>
          <button
            type="button"
            onClick={() =>
              setEnabled.mutate({
                slug: plugin.slug,
                enabled: !plugin.enabled,
              })
            }
            disabled={setEnabled.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {plugin.enabled ? (
              <>
                <Ban className="size-3.5" />
                {t("platform.plugins.disable_btn")}
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                {t("platform.plugins.enable_btn")}
              </>
            )}
          </button>
        </div>
      </div>

      <PluginContentView plugin={plugin} />
    </div>
  )
}
