"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

export function CreateRelationshipDialog({
  modal,
  actions,
  onOpenCreate,
  fields,
  onCreate,
}: {
  modal: FormModalState<null>
  actions: { close: () => void }
  onOpenCreate: () => void
  fields: RelationshipFormFields
  onCreate: () => void
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
      <DialogTrigger render={<Button size="sm" onClick={onOpenCreate} />}>
        <Plus className="size-4" /> Nouvelle relation
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("relationships.new_title")}</DialogTitle>
          <DialogDescription>{t("relationships.new_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={t("elements.choose_type")} />
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
            <Label htmlFor="rel-name">Nom</Label>
            <Input
              id="rel-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("relationships.optional_name")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rel-doc">Documentation</Label>
            <textarea
              id="rel-doc"
              value={doc}
              onChange={(e) => onDocChange(e.target.value)}
              placeholder="Description optionnelle"
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
            onClick={onCreate}
            disabled={modal.isPending || !type || !source || !target}
          >
            {modal.isPending ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
