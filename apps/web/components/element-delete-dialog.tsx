"use client"

import { useT } from "@/lib/i18n"
import { type ElementOut } from "@/lib/api"
import type { FormModalState, FormModalActions } from "@/hooks/use-form-modal"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

export function DeleteElementDialog({
  modal,
  actions,
  onConfirm,
}: {
  modal: FormModalState<ElementOut>
  actions: FormModalActions<ElementOut>
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("elements.delete_title")}</DialogTitle>
          <DialogDescription>
            {t("elements.delete_desc", {
              name: modal.target?.name || "?",
            })}
          </DialogDescription>
        </DialogHeader>
        {modal.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {modal.error}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={modal.isPending}
          >
            {modal.isPending ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ElementStats({
  ok,
  conflict,
  absent,
  t,
}: {
  ok: number
  conflict: number
  absent: number
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <>
      <span className="text-emerald-600">
        {ok} {t("common.ok")}
      </span>
      {conflict > 0 && (
        <>
          {" "}
          ·{" "}
          <span className="text-destructive">
            {conflict} {t("common.conflicts").toLowerCase()}
          </span>
        </>
      )}
      {absent > 0 && (
        <>
          {" "}
          ·{" "}
          <span className="text-amber-600">
            {absent} {t("common.absent")}
          </span>
        </>
      )}
    </>
  )
}
