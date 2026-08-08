import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
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
}): ColumnDef<PropertyDefinitionOut>[] {
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
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onEdit(row.original)}
                    aria-label={t("common.edit")}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDelete(row.original)}
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
    [isAdmin]
  )
}
