"use client"

import { useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trash2, Upload } from "lucide-react"
import { useT } from "@/lib/i18n"
import {
  useImagePacks,
  useUploadImagePackItems,
  useDeleteImagePackItem,
  useDeleteImagePack,
} from "@/lib/queries"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"

export default function ImagePackDetailPage() {
  // useParams() is typed nullable only for pages/-router compat (this app
  // only calls it from app/ client components, where it's always populated).
  const params = useParams<{ packId: string }>()!
  const packId = decodeURIComponent(params.packId)
  const router = useRouter()
  const { t } = useT()
  const { data: packs = [], isLoading } = useImagePacks()
  const pack = packs.find((p) => p.identifier === packId)
  const uploadItems = useUploadImagePackItems()
  const deleteItem = useDeleteImagePackItem()
  const deletePack = useDeleteImagePack()
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleDeletePack() {
    if (!pack) return
    await deletePack.mutateAsync(pack.identifier)
    router.push("/platform/image-library")
  }

  if (isLoading) {
    return (
      <div className="p-7 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!pack) {
    return (
      <div className="max-w-3xl space-y-4 p-7">
        <BackLink t={t} />
        <p className="text-sm text-muted-foreground">
          {t("image_library.pack_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <BackLink t={t} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {pack.name}
            {pack.is_system && (
              <Badge variant="secondary">
                {t("image_library.system_pack_badge")}
              </Badge>
            )}
          </h1>
          <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
            {pack.slug}
          </p>
        </div>
        {!pack.is_system && (
          <div className="flex shrink-0 items-center gap-1.5">
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
              <Upload className="size-3.5" />
              {t("image_library.upload_btn")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeletePack}
              disabled={deletePack.isPending}
            >
              <Trash2 className="size-3.5" />
              {t("common.delete")}
            </Button>
          </div>
        )}
      </div>

      {pack.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("image_library.pack_empty")}
        </p>
      ) : (
        <div className="grid grid-cols-8 gap-2">
          {pack.items.map((item) => (
            <div
              key={item.identifier}
              className="group relative flex aspect-square items-center justify-center rounded-md border border-border p-1.5"
              title={item.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.resolved_url}
                alt={item.name}
                className="size-full"
              />
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

function BackLink({ t }: { t: ReturnType<typeof useT>["t"] }) {
  return (
    <Link
      href="/platform/image-library"
      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground no-underline hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      {t("image_library.manage_title")}
    </Link>
  )
}
