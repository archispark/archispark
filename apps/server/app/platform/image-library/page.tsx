"use client"

import { useState } from "react"
import { Images, Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { useImagePacks, useCreateImagePack } from "@/lib/queries"
import { useImagePackColumns } from "@/components/image-pack-columns"
import { useFormModal } from "@/hooks/use-form-modal"
import { DataTable } from "@/components/data-table"
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

/**
 * platform_admin-only — instance-wide image packs (see
 * image-library-store.ts). Row click goes to the detail page, which owns
 * upload/delete of items and the pack itself.
 */
export default function ImageLibraryPage() {
  const { t } = useT()
  const { data: packs = [], isLoading } = useImagePacks()
  const createPack = useCreateImagePack()
  const columns = useImagePackColumns()

  const [newModal, newActions] = useFormModal<null>()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) return
    await newActions.run(async () => {
      await createPack.mutateAsync({ name: name.trim(), slug: slug.trim() })
      setName("")
      setSlug("")
    })
  }

  return (
    <div className="max-w-4xl p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Images className="size-5 text-primary" />
            {t("image_library.manage_title")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("image_library.manage_desc")}
          </p>
        </div>
        <Button size="sm" onClick={() => newActions.openNew()}>
          <Plus className="size-3.5" />
          {t("image_library.new_pack_btn")}
        </Button>
      </div>

      <DataTable columns={columns} data={packs} loading={isLoading} />

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
