import { useMemo } from "react"
import { type DataTableColumnDef } from "@/components/data-table"
import { type PropertyDefinitionOut } from "@/lib/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Pencil, Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"

export function usePropertyDefinitionColumns({
  isAdmin,
  onEdit,
  onDelete,
}: {
  isAdmin: boolean
  onEdit: (pd: PropertyDefinitionOut) => void
  onDelete: (pd: PropertyDefinitionOut) => void
}): DataTableColumnDef<PropertyDefinitionOut>[] {
  const { t } = useT()

  return useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("name") || "—"}</span>
        ),
      },
      {
        accessorKey: "type",
        header: t("common.type"),
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-xs">
            {row.getValue("type") || "string"}
          </Badge>
        ),
      },
      {
        accessorKey: "is_system",
        header: t("properties.origin"),
        cell: ({ row }) =>
          row.original.is_system ? (
            <Badge variant="secondary">{t("properties.system")}</Badge>
          ) : (
            <span className="text-muted-foreground">
              {t("properties.custom")}
            </span>
          ),
      },
      {
        accessorKey: "identifier",
        header: t("common.identifier"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-xs truncate font-mono text-[11px] text-muted-foreground">
            {row.getValue("identifier")}
          </span>
        ),
      },
      ...(isAdmin
        ? [
            {
              id: "actions",
              header: "",
              enableSorting: false,
              cell: ({ row }: { row: { original: PropertyDefinitionOut } }) => (
                <div className="flex items-center justify-end gap-1">
                  {!row.original.is_system && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onEdit(row.original)}
                        aria-label={t("common.edit")}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => onDelete(row.original)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [isAdmin]
  )
}
