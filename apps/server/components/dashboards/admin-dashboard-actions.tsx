"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { useDeleteDashboard } from "@/lib/queries/dashboards"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export function DeleteDashboardButton({ dashboardId }: { dashboardId: string }) {
  const { t } = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const deleteDashboard = useDeleteDashboard()

  async function handleDelete() {
    try {
      await deleteDashboard.mutateAsync(dashboardId)
      setOpen(false)
      router.push("/dashboards")
    } catch {
      // l'erreur est affichée via deleteDashboard.error ci-dessous
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 /> {t("common.delete")}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("dashboards.delete_confirm_title")}</DialogTitle>
          <DialogDescription>{t("dashboards.delete_confirm_desc", { id: dashboardId })}</DialogDescription>
        </DialogHeader>
        {deleteDashboard.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(deleteDashboard.error as Error).message}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteDashboard.isPending}>
            {deleteDashboard.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
