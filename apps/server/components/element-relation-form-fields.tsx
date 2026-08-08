"use client"

import { type ElementOut } from "@/lib/api"
import { ElementSelect } from "@/components/element-detail-header"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { useT } from "@/lib/i18n"

export interface RelationFormFields {
  relType: string
  setRelType: (v: string) => void
  relSource: string
  setRelSource: (v: string) => void
  relTarget: string
  setRelTarget: (v: string) => void
  relName: string
  setRelName: (v: string) => void
  relDoc: string
  setRelDoc: (v: string) => void
  relTypes: string[]
  elementSelectOpts: ElementOut[]
}

/** Type/source/target/name/documentation fields shared by the create and edit relation dialogs. */
export function RelationFormBody({
  fields,
  mode,
}: {
  fields: RelationFormFields
  mode: "create" | "edit"
}) {
  const { t } = useT()
  const {
    relType,
    setRelType,
    relSource,
    setRelSource,
    relTarget,
    setRelTarget,
    relName,
    setRelName,
    relDoc,
    setRelDoc,
    relTypes,
    elementSelectOpts,
  } = fields
  const isCreate = mode === "create"
  const idPrefix = isCreate ? "crel" : "erel"

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <Label>{t("common.type")} *</Label>
        <Select value={relType} onValueChange={(v) => setRelType(v ?? "")}>
          <SelectTrigger>
            <SelectValue
              placeholder={
                isCreate ? t("relationships.choose_type") : undefined
              }
            />
          </SelectTrigger>
          <SelectContent>
            {relTypes.map((rt) => (
              <SelectItem key={rt} value={rt}>
                {rt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("common.source")} *</Label>
        <ElementSelect
          options={elementSelectOpts}
          value={relSource}
          onChange={setRelSource}
          placeholder={isCreate ? t("common.source") : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("common.target")} *</Label>
        <ElementSelect
          options={elementSelectOpts}
          value={relTarget}
          onChange={setRelTarget}
          placeholder={isCreate ? t("common.target") : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          {t("common.name")}{" "}
          {isCreate && (
            <span className="text-[11px] text-muted-foreground">
              {t("common.optional")}
            </span>
          )}
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={relName}
          onChange={(e) => setRelName(e.target.value)}
          placeholder={isCreate ? t("relationships.optional_name") : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-doc`}>
          {t("common.documentation")}{" "}
          {isCreate && (
            <span className="text-[11px] text-muted-foreground">
              {t("common.optional")}
            </span>
          )}
        </Label>
        <textarea
          id={`${idPrefix}-doc`}
          value={relDoc}
          onChange={(e) => setRelDoc(e.target.value)}
          className="resize-vertical min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </div>
    </div>
  )
}
