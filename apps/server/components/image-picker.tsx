"use client"

import { useMemo, useState } from "react"
import { useImagePacks } from "@/lib/queries"
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
  const { data: packs, isLoading } = useImagePacks()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selectedItem = useMemo(() => {
    for (const pack of packs ?? []) {
      const item = pack.items.find((i) => `img-${i.identifier}` === value)
      if (item) return item
    }
    return null
  }, [packs, value])

  const filteredPacks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return packs ?? []
    return (packs ?? [])
      .map((pack) => ({
        ...pack,
        items: pack.items.filter((i) => i.name.toLowerCase().includes(q)),
      }))
      .filter((pack) => pack.items.length > 0)
  }, [packs, search])

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
        {selectedItem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selectedItem.resolved_url} alt="" className="size-4 shrink-0" />
        ) : null}
        <span className="truncate">
          {selectedItem ? selectedItem.name : t("image_library.choose")}
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
            {!isLoading && filteredPacks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("image_library.empty")}
              </p>
            )}
            {filteredPacks.map((pack) => (
              <div key={pack.identifier}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {pack.name}
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {pack.items.map((item) => (
                    <button
                      key={item.identifier}
                      type="button"
                      title={item.name}
                      onClick={() => {
                        onChange(`img-${item.identifier}`)
                        setOpen(false)
                      }}
                      className="flex aspect-square items-center justify-center rounded-md border border-border p-1.5 hover:bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.resolved_url}
                        alt={item.name}
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
