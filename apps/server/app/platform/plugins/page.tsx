"use client"

import { Puzzle } from "lucide-react"
import { useT } from "@/lib/i18n"

/** platform_admin-only — placeholder until the plugin system ships. */
export default function PlatformPluginsPage() {
  const { t } = useT()

  return (
    <div className="max-w-3xl p-7">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Puzzle className="size-5 text-primary" />
          {t("platform.plugins.title")}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t("platform.plugins.desc")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <Puzzle className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          {t("platform.plugins.coming_soon_title")}
        </p>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          {t("platform.plugins.coming_soon_desc")}
        </p>
      </div>
    </div>
  )
}
