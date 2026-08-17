"use client"

import { useMemo, useState } from "react"
import type { PlatformPluginDetailOut } from "@/lib/api"
import { Input } from "@workspace/ui/components/input"
import { useT } from "@/lib/i18n"

/**
 * Dispatches a plugin's content preview on its `type` — today only
 * "icon-pack" (plugin.json's only valid value, see
 * lib/plugins/schema.ts's PluginJsonSchema) renders anything, as a
 * searchable icon grid. `type` is kept as a discriminant for future plugin
 * kinds; anything else falls back to a placeholder rather than rendering
 * nothing silently.
 */
export function PluginContentView({
  plugin,
}: {
  plugin: PlatformPluginDetailOut
}) {
  const { t } = useT()
  if (plugin.type === "icon-pack") return <IconPackGrid plugin={plugin} />
  return (
    <p className="text-sm text-muted-foreground">
      {t("platform.plugins.unsupported_type", { type: plugin.type })}
    </p>
  )
}

function IconPackGrid({ plugin }: { plugin: PlatformPluginDetailOut }) {
  const { t } = useT()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plugin.icons
    return plugin.icons.filter(
      (icon) =>
        icon.name.toLowerCase().includes(q) ||
        icon.slug.toLowerCase().includes(q)
    )
  }, [plugin.icons, search])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder={t("image_library.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {t("platform.plugins.icon_count")}: {filtered.length}/
          {plugin.icons.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("image_library.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-8 gap-2">
          {filtered.map((icon) => (
            <div
              key={icon.slug}
              title={icon.name}
              className="flex flex-col items-center gap-1 rounded-md border border-border p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon.url} alt={icon.name} className="size-8" />
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {icon.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
