"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type Property } from "@/lib/api"
import { PropertiesEditor } from "@/components/properties-editor"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
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

export function CreateElementDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  type,
  onTypeChange,
  doc,
  onDocChange,
  props,
  onPropsChange,
  layerFilter,
  grouped,
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
  doc: string
  onDocChange: (v: string) => void
  props: Property[]
  onPropsChange: (p: Property[]) => void
  layerFilter: string | null
  grouped: Record<string, string[]>
  error: string | null
  creating: boolean
  onCreate: () => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nouvel élément
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("elements.new_btn")}</DialogTitle>
          <DialogDescription>{t("elements.new_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="el-name">{t("common.name")} *</Label>
            <Input
              id="el-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("elements.placeholder")}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.type")} *</Label>
            <Select value={type} onValueChange={(v) => onTypeChange(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={t("elements.choose_type")} />
              </SelectTrigger>
              <SelectContent>
                {layerFilter
                  ? (grouped[layerFilter] ?? []).map((typ) => (
                      <SelectItem key={typ} value={typ}>
                        {typ}
                      </SelectItem>
                    ))
                  : Object.entries(grouped).map(([layer, typs]) => (
                      <SelectGroup key={layer}>
                        <SelectLabel>{layer}</SelectLabel>
                        {typs.map((typ) => (
                          <SelectItem key={typ} value={typ}>
                            {typ}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="el-doc">{t("common.documentation")}</Label>
            <textarea
              id="el-doc"
              value={doc}
              onChange={(e) => onDocChange(e.target.value)}
              placeholder={t("common.optional_desc")}
              className="resize-vertical min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.properties")}</Label>
            <PropertiesEditor value={props} onChange={onPropsChange} />
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
          <Button
            onClick={onCreate}
            disabled={creating || !name.trim() || !type}
          >
            {creating ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
