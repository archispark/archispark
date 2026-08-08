"use client"

import { useT } from "@/lib/i18n"
import { type RelationshipOut } from "@/lib/api"
import type { FormModalState } from "@/hooks/use-form-modal"
import { PropertiesEditor } from "@/components/properties-editor"
import {
  ElementSelectField,
  type RelationshipFormFields,
} from "@/components/relationship-form-fields"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

export function EditRelationshipDialog({
  modal,
  actions,
  fields,
  onSave,
}: {
  modal: FormModalState<RelationshipOut>
  actions: { close: () => void }
  fields: RelationshipFormFields
  onSave: () => void
}) {
  const { t } = useT()
  const {
    type,
    onTypeChange,
    source,
    onSourceChange,
    target,
    onTargetChange,
    name,
    onNameChange,
    doc,
    onDocChange,
    props,
    onPropsChange,
    types,
    allElements,
  } = fields
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("relationships.edit_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((rtype) => (
                  <SelectItem key={rtype} value={rtype}>
                    {rtype}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Source *</Label>
            <ElementSelectField
              value={source}
              onChange={onSourceChange}
              placeholder="Élément source"
              allElements={allElements}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Cible *</Label>
            <ElementSelectField
              value={target}
              onChange={onTargetChange}
              placeholder="Élément cible"
              allElements={allElements}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-rel-name">Nom</Label>
            <Input
              id="edit-rel-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-rel-doc">Documentation</Label>
            <textarea
              id="edit-rel-doc"
              value={doc}
              onChange={(e) => onDocChange(e.target.value)}
              className="resize-vertical min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Propriétés</Label>
            <PropertiesEditor value={props} onChange={onPropsChange} />
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
          <Button
            onClick={onSave}
            disabled={modal.isPending || !type || !source || !target}
          >
            {modal.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteRelationshipDialog({
  modal,
  actions,
  onConfirm,
}: {
  modal: FormModalState<RelationshipOut>
  actions: { close: () => void }
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
