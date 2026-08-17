"use client"

import { useMemo, useState } from "react"
import { usePlugins } from "@/lib/queries"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useT } from "@/lib/i18n"

export function ImagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { t } = useT()
  const { data: pluginsList, isLoading } = usePlugins()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selectedIcon = useMemo(() => {
    for (const plugin of pluginsList ?? []) {
      const icon = plugin.icons.find((i) => i.slug === value)
      if (icon) return icon
    }
    return null
  }, [pluginsList, value])

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pluginsList ?? []
    return (pluginsList ?? [])
      .map((plugin) => ({
        ...plugin,
        icons: plugin.icons.filter((i) => i.name.toLowerCase().includes(q)),
      }))
      .filter((plugin) => plugin.icons.length > 0)
  }, [pluginsList, search])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 max-w-[220px] justify-start gap-2"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {selectedIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selectedIcon.url} alt="" className="size-4 shrink-0" />
        ) : null}
        <span className="truncate">
          {selectedIcon ? selectedIcon.name : t("image_library.choose")}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("image_library.title")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("image_library.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <div className="max-h-80 space-y-4 overflow-y-auto">
            {isLoading && (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            )}
            {!isLoading && filteredPlugins.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("image_library.empty")}
              </p>
            )}
            {filteredPlugins.map((plugin) => (
              <div key={plugin.slug}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {plugin.name}
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {plugin.icons.map((icon) => (
                    <button
                      key={icon.slug}
                      type="button"
                      title={icon.name}
                      onClick={() => {
                        onChange(icon.slug)
                        setOpen(false)
                      }}
                      className="flex aspect-square items-center justify-center rounded-md border border-border p-1.5 hover:bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={icon.url}
                        alt={icon.name}
                        className="size-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
