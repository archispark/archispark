"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"
import { useImportModel } from "@/lib/queries"

/** Drop zone used to import an Open Exchange XML model into the active workspace. */
export function ModelImportDropzone() {
  const { t } = useT()
  const importModel = useImportModel()
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function importFile(file: File) {
    try {
      const info = await importModel.mutateAsync(file)
      toast.success(
        t("sidebar.import_success", {
          name: info.name,
          n: info.element_count,
          v: info.view_count,
        })
      )
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) await importFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!importModel.isPending) setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (importModel.isPending) return
    const file = e.dataTransfer.files?.[0]
    if (file) await importFile(file)
  }

  const importLabel = importModel.isPending
    ? t("common.loading")
    : t("sidebar.import")
  const classes = dragOver
    ? "border-primary bg-primary/5 text-primary"
    : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground"

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="hidden"
        onChange={handleImportChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={importModel.isPending}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors disabled:pointer-events-none disabled:opacity-60 ${classes}`}
      >
        <Upload className="pointer-events-none size-5 shrink-0" />
        <span className="pointer-events-none text-xs font-medium">
          {importLabel}
        </span>
        <span className="pointer-events-none text-[10px] leading-tight">
          {t("sidebar.import_drop_hint")}
        </span>
      </button>
    </>
  )
}
