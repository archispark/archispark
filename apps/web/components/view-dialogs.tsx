"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type ViewOut } from "@/lib/api"
import type { FormModalState } from "@/hooks/use-form-modal"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
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

export function CreateViewDialog({
  modal,
  actions,
  onOpenCreate,
  name,
  onNameChange,
  viewpoint,
  onViewpointChange,
  viewpoints,
  doc,
  onDocChange,
  onCreate,
}: {
  modal: FormModalState<null>
  actions: { close: () => void }
  onOpenCreate: () => void
  name: string
  onNameChange: (v: string) => void
  viewpoint: string
  onViewpointChange: (v: string) => void
  viewpoints: string[]
  doc: string
  onDocChange: (v: string) => void
  onCreate: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogTrigger render={<Button size="sm" onClick={onOpenCreate} />}>
        <Plus className="size-4" /> Nouvelle vue
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("views.new_btn")}</DialogTitle>
          <DialogDescription>{t("views.new_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-name">Nom *</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("views.unnamed")}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("views.viewpoint")}</Label>
            <Select
              value={viewpoint}
              onValueChange={(v) => onViewpointChange(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("views.no_viewpoint")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  {t("views.no_viewpoint_short")}
                </SelectItem>
                {viewpoints.map((vp) => (
                  <SelectItem key={vp} value={vp}>
                    {vp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-doc">Documentation</Label>
            <textarea
              id="view-doc"
              value={doc}
              onChange={(e) => onDocChange(e.target.value)}
              placeholder={t("common.optional_desc")}
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

export function DeleteViewDialog({
  view,
  onOpenChange,
  error,
  deleting,
  onConfirm,
}: {
  view: ViewOut | null
  onOpenChange: (o: boolean) => void
  error: string | null
  deleting: boolean
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={!!view} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("common.delete")} « {view?.name || t("views.unnamed")} »
          </DialogTitle>
          <DialogDescription>{t("common.irreversible")}</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" disabled={deleting} />}
          >
            {t("common.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
