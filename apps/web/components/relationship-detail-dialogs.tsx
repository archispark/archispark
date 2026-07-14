"use client"

import { type RelationshipOut } from "@/lib/api"
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
import { useT } from "@/lib/i18n"

export function DeleteRelationshipConfirmDialog({
  modal,
  actions,
  relType,
  onConfirm,
}: {
  modal: FormModalState<RelationshipOut | undefined>
  actions: FormModalActions<RelationshipOut | undefined>
  relType: string
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("relationships.delete_title")}</DialogTitle>
          <DialogDescription>
            {t("relationships.delete_desc", { type: relType })}
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
