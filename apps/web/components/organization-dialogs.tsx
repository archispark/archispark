"use client"

import { Plus } from "lucide-react"
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
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@workspace/ui/components/dialog"

/** The three org-level dialogs from app/organizations/page.tsx, split out to stay under max-lines. */

export function CreateOrganizationDialog({
  modal,
  actions,
  name,
  onNameChange,
  onOpenNew,
  onCreate,
}: {
  modal: FormModalState<null>
  actions: FormModalActions<null>
  name: string
  onNameChange: (v: string) => void
  onOpenNew: () => void
  onCreate: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogTrigger render={<Button size="sm" onClick={onOpenNew} />}>
        <Plus className="size-4" /> {t("settings.org.org_new_btn")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.org.org_new_title")}</DialogTitle>
          <DialogDescription>
            {t("settings.org.org_new_desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="new-org-name">{t("settings.org.org_name")} *</Label>
          <Input
            id="new-org-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate()
            }}
            autoFocus
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
          <Button onClick={onCreate} disabled={modal.isPending || !name.trim()}>
            {modal.isPending ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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

export function DeleteOrganizationDialog({
  modal,
  actions,
  onConfirm,
}: {
  modal: FormModalState<OrganizationOut>
  actions: FormModalActions<OrganizationOut>
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("settings.org.delete_org_title")}</DialogTitle>
          <DialogDescription>
            {t("settings.org.delete_org_desc", {
              name: modal.target?.name ?? "",
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
