"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import type { FormModalState, FormModalActions } from "@/hooks/use-form-modal"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

/** platform_admin-only — creates a "team" organization from the admin console. */
export function CreatePlatformOrganizationDialog({
  modal,
  actions,
  onOpenCreate,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onCreate,
}: {
  modal: FormModalState<null>
  actions: FormModalActions<null>
  onOpenCreate: () => void
  name: string
  onNameChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  onCreate: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            onClick={onOpenCreate}
            className="bg-emerald-600 text-primary-foreground hover:bg-emerald-700"
          />
        }
      >
        <Plus className="size-4" /> {t("common.add")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("platform.orgs.new_title")}</DialogTitle>
          <DialogDescription>{t("platform.orgs.new_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-org-name">{t("platform.orgs.name")} *</Label>
            <Input
              id="new-org-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-org-description">
              {t("platform.orgs.description")}
            </Label>
            <textarea
              id="new-org-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder={t("common.optional_desc")}
              rows={3}
              className="resize-vertical min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
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
