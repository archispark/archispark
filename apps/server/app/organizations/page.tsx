"use client"

import { Building2 } from "lucide-react"
import { useT } from "@/lib/i18n"
import { useOrganizations, useActivateOrganization } from "@/lib/queries"
import { useOrganizationColumns } from "@/components/organization-columns"
import { DataTable } from "@/components/data-table"

export default function OrganizationsPage() {
  const { t } = useT()
  const { data: organizations = [], isLoading } = useOrganizations()
  const activateOrg = useActivateOrganization()

  const columns = useOrganizationColumns({
    onActivate: (id) => activateOrg.mutate(id),
    activatePending: activateOrg.isPending,
  })

  return (
    <div className="p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-5 text-primary" />
            {t("breadcrumb.organizations")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("organizations.subtitle")}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={organizations}
        loading={isLoading}
        searchable
        searchPlaceholder={t("common.search_by_name")}
      />
    </div>
  )
}
