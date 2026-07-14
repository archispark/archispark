"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { type Property, type PropertyDefinitionOut } from "@/lib/api"
import { InlineText } from "@/components/detail-page-shared"
import { DataTable } from "@/components/data-table"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { Plus, Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"

interface PropRow extends Property {
  _def?: PropertyDefinitionOut
}

export function EntityPropertiesTab({
  isAdmin,
  properties,
  propDefs,
  availableDefs,
  addingProp,
  onStartAdd,
  newPropRef,
  onNewPropRefChange,
  newPropVal,
  onNewPropValChange,
  onSaveAdd,
  onCancelAdd,
  savingAdd,
  onSaveValue,
  onDeleteClick,
}: {
  isAdmin: boolean
  properties: Property[]
  propDefs: PropertyDefinitionOut[]
  availableDefs: PropertyDefinitionOut[]
  addingProp: boolean
  onStartAdd: () => void
  newPropRef: string
  onNewPropRefChange: (v: string) => void
  newPropVal: string
  onNewPropValChange: (v: string) => void
  onSaveAdd: () => void
  onCancelAdd: () => void
  savingAdd: boolean
  onSaveValue: (ref: string, val: string) => void
  onDeleteClick: (ref: string) => void
}) {
  const { t } = useT()

  const propColumns: ColumnDef<PropRow>[] = useMemo(
    () => [
      {
        accessorKey: "property_definition_ref",
        header: t("elements.prop_definition"),
        cell: ({ row }) => {
          const def = propDefs.find(
            (d) => d.identifier === row.original.property_definition_ref
          )
          return (
            <span className="text-xs text-muted-foreground">
              {def?.name ?? row.original.property_definition_ref}
            </span>
          )
        },
      },
      {
        accessorKey: "value",
        header: t("elements.prop_value"),
        cell: ({ row }) =>
          isAdmin ? (
            <InlineText
              value={row.original.value}
              onSave={(v) =>
                onSaveValue(row.original.property_definition_ref, v)
              }
              className="text-sm"
              placeholder="—"
            />
          ) : (
            <span className="text-sm">{row.original.value || "—"}</span>
          ),
      },
      ...(isAdmin
        ? [
            {
              id: "prop_actions",
              header: "",
              enableSorting: false,
              cell: ({ row }: { row: { original: PropRow } }) => (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      onDeleteClick(row.original.property_definition_ref)
                    }
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [isAdmin, propDefs, onSaveValue, onDeleteClick, t]
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-4">
      <div className="space-y-3">
        {isAdmin && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onStartAdd}
              disabled={addingProp || availableDefs.length === 0}
            >
              <Plus className="mr-1 size-3.5" />
              {t("common.create")}
            </Button>
          </div>
        )}
        {addingProp && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Select
              value={newPropRef}
              onValueChange={(v) => onNewPropRefChange(v ?? "")}
            >
              <SelectTrigger className="h-8 min-w-[140px] flex-1 text-sm">
                <SelectValue
                  placeholder={t("properties.property_placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {availableDefs.map((d) => (
                  <SelectItem key={d.identifier} value={d.identifier}>
                    {d.name}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      {d.type}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-8 min-w-[140px] flex-1 text-sm"
              placeholder={t("properties.value_placeholder")}
              value={newPropVal}
              onChange={(e) => onNewPropValChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveAdd()
                if (e.key === "Escape") onCancelAdd()
              }}
            />
            <Button
              size="sm"
              onClick={onSaveAdd}
              disabled={!newPropRef || savingAdd}
            >
              {t("common.create")}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelAdd}>
              {t("common.cancel")}
            </Button>
          </div>
        )}
        <DataTable<PropRow, unknown>
          columns={propColumns}
          data={properties as PropRow[]}
          pageSize={25}
        />
      </div>
    </div>
  )
}
