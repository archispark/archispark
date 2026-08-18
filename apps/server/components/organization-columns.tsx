import { useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Check } from "lucide-react"
import type { OrganizationOut } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"

export function useOrganizationColumns({
  onActivate,
  activatePending,
}: {
  onActivate: (id: string) => void
  activatePending: boolean
}): ColumnDef<OrganizationOut>[] {
  const { t } = useT()

  return useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: ({ row }) => (
          <Link
            href={`/organizations/${encodeURIComponent(row.original.id)}`}
            className="flex items-center gap-2 font-medium text-foreground no-underline hover:underline"
          >
            {row.original.name}
            {row.original.is_personal && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                {t("organizations.personal_badge")}
              </span>
            )}
            {!row.original.enabled && (
              <span className="rounded-full border border-destructive/30 px-1.5 py-0.5 text-[10px] font-normal text-destructive">
                {t("organizations.suspended_badge")}
              </span>
            )}
          </Link>
        ),
      },
      {
        accessorKey: "role",
        header: t("common.role"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {t(
              `settings.org.role_${row.original.role}` as "settings.org.role_owner"
            )}
          </span>
        ),
      },
      {
        id: "active",
        header: t("common.status"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.active ? (
            <span className="flex items-center gap-1 text-[13px] font-medium text-primary">
              <Check className="size-3.5" />
              {t("nav.workspace_active")}
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onActivate(row.original.id)}
              disabled={activatePending}
            >
              {t("workspaces.activate")}
            </Button>
          ),
      },
    ],
    [t, onActivate, activatePending]
  )
}
