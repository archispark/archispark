"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Puzzle } from "lucide-react"
import { useT } from "@/lib/i18n"
import { useCreateImagePack, useInstallImagePackItems } from "@/lib/queries"
import type { ImagePackManifestIn } from "@/lib/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** platform_admin-only — installs a plugin icon pack (svg files + optional
 *  manifest.json) into a newly created custom pack in one action. */
export default function PlatformPluginsPage() {
  const { t } = useT()
  const router = useRouter()
  const createPack = useCreateImagePack()
  const installItems = useInstallImagePackItems()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const manifestFile = files.find(
    (f) => f.name.toLowerCase() === "manifest.json"
  )
  const svgFiles = files.filter((f) => f.name.toLowerCase().endsWith(".svg"))
  const isPending = createPack.isPending || installItems.isPending

  async function handleInstall() {
    setError(null)
    setSuccess(null)
    if (!name.trim() || !slug.trim() || svgFiles.length === 0) return
    try {
      const manifest = manifestFile
        ? (JSON.parse(await manifestFile.text()) as ImagePackManifestIn)
        : undefined
      const pack = await createPack.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
      })
      const items = await installItems.mutateAsync({
        packId: pack.identifier,
        files: svgFiles,
        manifest,
      })
      setSuccess(
        t("platform.plugins.install_success", {
          name: pack.name,
          count: items.length,
        })
      )
      setTimeout(
        () => router.push(`/platform/image-library/${pack.identifier}`),
        1200
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="max-w-2xl p-7">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Puzzle className="size-5 text-primary" />
          {t("platform.plugins.title")}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t("platform.plugins.desc")}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plugin-pack-name">
            {t("image_library.pack_name_placeholder")}
          </Label>
          <Input
            id="plugin-pack-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSlug(slugify(e.target.value))
            }}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plugin-pack-slug">
            {t("image_library.pack_slug_placeholder")}
          </Label>
          <Input
            id="plugin-pack-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,application/json"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            {t("platform.plugins.select_files_btn")}
          </Button>
          <p className="text-[12px] text-muted-foreground">
            {t("platform.plugins.dropzone_hint")}
          </p>
          {svgFiles.length > 0 && (
            <p className="text-[13px]">
              {t("platform.plugins.files_selected", { count: svgFiles.length })}
              {manifestFile && (
                <span className="ml-2 text-muted-foreground">
                  · {t("platform.plugins.manifest_detected")}
                </span>
              )}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
            {success}
          </div>
        )}

        <Button
          onClick={handleInstall}
          disabled={
            isPending || !name.trim() || !slug.trim() || svgFiles.length === 0
          }
        >
          {isPending
            ? t("platform.plugins.installing")
            : t("platform.plugins.install_btn")}
        </Button>
      </div>
    </div>
  )
}
