"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Upload, Download } from "lucide-react"
import { useImportModel } from "@/lib/queries"
import { exportModelUrl } from "@/lib/api"
import { useT } from "@/lib/i18n"

/** Import/export controls for the active workspace's model — owner/admin only. */
export function ImportExportControls({
  collapsed,
  onClose,
  t,
}: {
  collapsed: boolean
  onClose: () => void
  t: ReturnType<typeof useT>["t"]
}) {
  const importModel = useImportModel()
  const [exporting, setExporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(exportModelUrl, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const filename =
        disposition.match(/filename="?([^";\n]+)"?/)?.[1] ?? "model.xml"
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

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
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    await importFile(file)
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
    if (!file) return
    await importFile(file)
  }

  const importLabel = importModel.isPending
    ? t("common.loading")
    : t("sidebar.import")
  const exportLabel = exporting ? t("sidebar.exporting") : t("sidebar.export")
  const importDragClasses = dragOver
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
      {collapsed ? (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={importModel.isPending}
            title={importLabel}
            aria-label={importLabel}
            className={`flex size-9 items-center justify-center rounded-md border-2 border-dashed transition-colors disabled:pointer-events-none disabled:opacity-60 ${importDragClasses}`}
          >
            <Upload className="pointer-events-none size-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            title={exportLabel}
            aria-label={exportLabel}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
          >
            <Download className="size-4 shrink-0" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={importModel.isPending}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-2 py-3 text-center transition-colors disabled:pointer-events-none disabled:opacity-60 ${importDragClasses}`}
          >
            <Upload className="pointer-events-none size-5 shrink-0" />
            <span className="pointer-events-none text-xs font-medium">
              {importLabel}
            </span>
            <span className="pointer-events-none text-[10px] leading-tight">
              {t("sidebar.import_drop_hint")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
          >
            <Download className="size-4 shrink-0" />
            {exportLabel}
          </button>
        </>
      )}
    </>
  )
}
