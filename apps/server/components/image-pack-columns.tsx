import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import type { ImagePackOut } from "@/lib/api"
import { Badge } from "@workspace/ui/components/badge"
import { useT } from "@/lib/i18n"

export function useImagePackColumns(): ColumnDef<ImagePackOut>[] {
  const { t } = useT()

  return useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/platform/image-library/${encodeURIComponent(row.original.identifier)}`}
            className="font-medium text-foreground no-underline hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "slug",
        header: t("common.identifier"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.slug}
          </span>
        ),
      },
      {
        accessorKey: "is_system",
        header: t("image_library.origin"),
        cell: ({ row }) =>
          row.original.is_system ? (
            <Badge variant="secondary">
              {t("image_library.system_pack_badge")}
            </Badge>
          ) : (
            <span className="text-muted-foreground">
              {t("image_library.custom_pack_badge")}
            </span>
          ),
      },
      {
        id: "items",
        header: t("image_library.items_count"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.items.length}
          </span>
        ),
      },
    ],
    [t]
  )
}
