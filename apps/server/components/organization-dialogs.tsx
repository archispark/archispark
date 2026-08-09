"use client"

import { useT } from "@/lib/i18n"
import { type OrganizationOut } from "@/lib/api"
import type { FormModalState, FormModalActions } from "@/hooks/use-form-modal"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

export function EditOrganizationDialog({
  modal,
  actions,
  name,
  onNameChange,
  onSave,
}: {
  modal: FormModalState<OrganizationOut>
  actions: FormModalActions<OrganizationOut>
  name: string
  onNameChange: (v: string) => void
  onSave: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.org.org_edit_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="edit-org-name">{t("settings.org.org_name")} *</Label>
          <Input
            id="edit-org-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoComplete="off"
          />
        </div>
        {modal.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {modal.error}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={onSave} disabled={modal.isPending || !name.trim()}>
            {modal.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
