"use client"

import { Puzzle } from "lucide-react"
import { useT } from "@/lib/i18n"
import { usePlatformPlugins } from "@/lib/queries"
import { usePlatformPluginColumns } from "@/components/platform-plugin-columns"
import { DataTable } from "@/components/data-table"

/**
 * platform_admin-only view — plugins discovered at build time from
 * plugins/<slug>/ (see apps/server/scripts/generate-plugin-registry.ts),
 * enabled/disabled here without a rebuild (see lib/plugins/service.ts).
 * Installing a *new* plugin means adding a plugins/<slug>/ folder and
 * deploying, not something done from this page.
 */
export default function PlatformPluginsPage() {
  const { t } = useT()
  const { data: pluginsList = [], isLoading } = usePlatformPlugins()
  const columns = usePlatformPluginColumns()

  return (
    <div className="max-w-4xl p-7">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Puzzle className="size-5 text-primary" />
          {t("platform.plugins.title")}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t("platform.plugins.desc")}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={pluginsList}
        loading={isLoading}
        searchable
        searchPlaceholder={t("common.search_by_name")}
      />
    </div>
  )
}
