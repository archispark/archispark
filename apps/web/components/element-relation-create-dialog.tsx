"use client"

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

export function CreateRelationDialog({
  modal,
  actions,
  fields,
  onConfirm,
}: {
  modal: FormModalState<null>
  actions: FormModalActions<null>
  fields: RelationFormFields
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("relationships.new_title")}</DialogTitle>
          <DialogDescription>{t("relationships.new_desc")}</DialogDescription>
        </DialogHeader>
        <RelationFormBody fields={fields} mode="create" />
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
            {modal.isPending ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
