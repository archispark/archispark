"use client"

import { useRef, useState } from "react"
import { Plus, Trash2, Upload } from "lucide-react"
import { useT } from "@/lib/i18n"
import type { ImagePackOut } from "@/lib/api"
import {
  useImagePacks,
  useCreateImagePack,
  useDeleteImagePack,
  useUploadImagePackItems,
  useDeleteImagePackItem,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function PackRow({
  pack,
  onDeletePack,
}: {
  pack: ImagePackOut
  onDeletePack?: () => void
}) {
  const { t } = useT()
  const uploadItems = useUploadImagePackItems()
  const deleteItem = useDeleteImagePackItem()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-medium">{pack.name}</span>
          {pack.is_system && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("image_library.system_pack_badge")}
            </span>
          )}
        </div>
        {!pack.is_system && (
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 0)
                  uploadItems.mutate({ packId: pack.identifier, files })
                e.target.value = ""
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadItems.isPending}
            >
              <Upload className="mr-1.5 size-3.5" />
              {t("image_library.upload_btn")}
            </Button>
            {onDeletePack && (
              <Button size="icon-sm" variant="destructive" onClick={onDeletePack}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
      {pack.items.length > 0 && (
        <div className="grid grid-cols-8 gap-2">
          {pack.items.map((item) => (
            <div
              key={item.identifier}
              className="group relative flex aspect-square items-center justify-center rounded-md border border-border p-1.5"
              title={item.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.resolved_url} alt={item.name} className="size-full" />
              {!pack.is_system && (
                <button
                  type="button"
                  onClick={() => deleteItem.mutate(item.identifier)}
                  className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                >
                  <Trash2 className="size-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ImagePackManager() {
  const { t } = useT()
  const { data: packs = [], isLoading } = useImagePacks()
  const createPack = useCreateImagePack()
  const deletePack = useDeleteImagePack()

  const [newModal, newActions] = useFormModal<null>()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  const systemPack = packs.find((p) => p.is_system)
  const customPacks = packs.filter((p) => !p.is_system)

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) return
    await newActions.run(async () => {
      await createPack.mutateAsync({ name: name.trim(), slug: slug.trim() })
      setName("")
      setSlug("")
    })
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {t("image_library.manage_title")}
        </h2>
        <Button size="sm" onClick={() => newActions.openNew()}>
          <Plus className="mr-1.5 size-3.5" />
          {t("image_library.new_pack_btn")}
        </Button>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {t("image_library.manage_desc")}
      </p>

      {systemPack && <PackRow pack={systemPack} />}
      {customPacks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("image_library.no_custom_packs")}
        </p>
      ) : (
        customPacks.map((pack) => (
          <PackRow
            key={pack.identifier}
            pack={pack}
            onDeletePack={() => deletePack.mutate(pack.identifier)}
          />
        ))
      )}

      <Dialog
        open={newModal.open}
        onOpenChange={(o) => !o && newActions.close()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("image_library.new_pack_title")}</DialogTitle>
            <DialogDescription>
              {t("image_library.new_pack_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pack-name">
                {t("image_library.pack_name_placeholder")}
              </Label>
              <Input
                id="pack-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSlug(slugify(e.target.value))
                }}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pack-slug">
                {t("image_library.pack_slug_placeholder")}
              </Label>
              <Input
                id="pack-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          {newModal.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {newModal.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={newModal.isPending || !name.trim() || !slug.trim()}
            >
              {newModal.isPending ? t("common.saving") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
