"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2 } from "lucide-react"
import { useT } from "@/lib/i18n"
import {
  usePlatformOrganizations,
  useCreatePlatformOrganization,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { usePlatformOrganizationColumns } from "@/components/platform-organization-columns"
import { CreatePlatformOrganizationDialog } from "@/components/platform-organization-dialogs"
import { DataTable } from "@/components/data-table"

/**
 * platform_admin-only view — organization metadata, read-only besides
 * creation. Row click goes to the detail page, which owns name/description
 * editing, suspend/reactivate, member management, and deletion.
 */
export default function PlatformOrganizationsPage() {
  const { t } = useT()
  const router = useRouter()
  const { data: organizations = [], isLoading } = usePlatformOrganizations()
  const columns = usePlatformOrganizationColumns()
  const createOrg = useCreatePlatformOrganization()

  const [createModal, createActions] = useFormModal<null>()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  function openCreate() {
    setName("")
    setDescription("")
    createActions.openNew()
  }

  async function handleCreate() {
    if (!name.trim()) return
    await createActions.run(async () => {
      const org = await createOrg.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      })
      router.push(`/platform/organizations/${org.id}`)
    })
  }

  return (
    <div className="p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-5 text-primary" />
            {t("platform.title")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("platform.desc")}
          </p>
        </div>
        <CreatePlatformOrganizationDialog
          modal={createModal}
          actions={createActions}
          onOpenCreate={openCreate}
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          onCreate={handleCreate}
        />
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
