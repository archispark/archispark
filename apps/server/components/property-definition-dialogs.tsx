"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
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
  DialogTrigger,
} from "@workspace/ui/components/dialog"

export const PROPERTY_TYPES = [
  "string",
  "boolean",
  "integer",
  "double",
  "date",
  "object",
]

function TypeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "string")}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROPERTY_TYPES.map((pt) => (
          <SelectItem key={pt} value={pt}>
            {pt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CreatePropertyDefinitionDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  type,
  onTypeChange,
  error,
  creating,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  onNameChange: (v: string) => void
  type: string
  onTypeChange: (v: string) => void
  error: string | null
  creating: boolean
  onCreate: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nouvelle définition
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("properties.new_title")}</DialogTitle>
          <DialogDescription>{t("properties.new_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pd-name">{t("common.name")} *</Label>
            <Input
              id="pd-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("properties.placeholder")}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("properties.value_type")}</Label>
            <TypeSelect value={type} onChange={onTypeChange} />
          </div>
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={onCreate} disabled={creating || !name.trim()}>
            {creating ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditPropertyDefinitionDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  type,
  onTypeChange,
  error,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  onNameChange: (v: string) => void
  type: string
  onTypeChange: (v: string) => void
  error: string | null
  saving: boolean
  onSave: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("properties.edit_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-pd-name">{t("common.name")} *</Label>
            <Input
              id="edit-pd-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSave()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("properties.value_type")}</Label>
            <TypeSelect value={type} onChange={onTypeChange} />
          </div>
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={onSave} disabled={saving || !name.trim()}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeletePropertyDefinitionDialog({
  open,
  onOpenChange,
  targetName,
  error,
  deleting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  targetName: string
  error: string | null
  deleting: boolean
  onConfirm: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("properties.delete_title")}</DialogTitle>
          <DialogDescription>
            {t("properties.delete_desc", { name: targetName || "?" })}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
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
