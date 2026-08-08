"use client"

import { type RelationshipOut } from "@/lib/api"
import type { FormModalState, FormModalActions } from "@/hooks/use-form-modal"
import {
  RelationFormBody,
  type RelationFormFields,
} from "@/components/element-relation-form-fields"
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

export function EditRelationDialog({
  modal,
  actions,
  fields,
  onConfirm,
}: {
  modal: FormModalState<RelationshipOut>
  actions: FormModalActions<RelationshipOut>
  fields: RelationFormFields
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("relationships.edit_title")}</DialogTitle>
        </DialogHeader>
        <RelationFormBody fields={fields} mode="edit" />
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
            onClick={onConfirm}
            disabled={
              modal.isPending ||
              !fields.relType ||
              !fields.relSource ||
              !fields.relTarget
            }
          >
            {modal.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteRelationDialog({
  modal,
  actions,
  onConfirm,
}: {
  modal: FormModalState<RelationshipOut>
  actions: FormModalActions<RelationshipOut>
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("relationships.delete_title")}</DialogTitle>
          <DialogDescription>
            {t("relationships.delete_desc", {
              type: modal.target?.type ?? "",
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
