"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { exportModelUrl } from "@/lib/api"
import { useT } from "@/lib/i18n"

/** Downloads the Open Exchange XML of the active workspace's model. */
export function ModelExportButton() {
  const { t } = useT()
  const [exporting, setExporting] = useState(false)

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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
    >
      <Download className="size-4" />
      {exporting ? t("sidebar.exporting") : t("sidebar.export")}
    </Button>
  )
}
