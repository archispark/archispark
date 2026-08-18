"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users as UsersIcon } from "lucide-react"
import { useT } from "@/lib/i18n"
import { usePlatformUsers, useCreatePlatformUser } from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { usePlatformUserColumns } from "@/components/platform-user-columns"
import {
  CreatePlatformUserDialog,
  type NewPlatformUserFields,
} from "@/components/platform-user-dialogs"
import { DataTable } from "@/components/data-table"

const EMPTY_FIELDS: NewPlatformUserFields = {
  username: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  isAdmin: false,
}

/**
 * platform_admin-only — local accounts (the `users` table), read-only
 * besides creation. Keycloak-managed accounts aren't listed: see
 * platform-users-store.ts for why. Row click goes to the detail page,
 * which owns role/status/password editing.
 */
export default function PlatformUsersPage() {
  const { t } = useT()
  const router = useRouter()
  const { data: users = [], isLoading } = usePlatformUsers()
  const columns = usePlatformUserColumns()
  const createUser = useCreatePlatformUser()

  const [createModal, createActions] = useFormModal<null>()
  const [fields, setFields] = useState<NewPlatformUserFields>(EMPTY_FIELDS)

  function openCreate() {
    setFields(EMPTY_FIELDS)
    createActions.openNew()
  }

  async function handleCreate() {
    if (!fields.username.trim() || !fields.email.trim() || !fields.password)
      return
    await createActions.run(async () => {
      const user = await createUser.mutateAsync({
        username: fields.username.trim(),
        email: fields.email.trim(),
        password: fields.password,
        first_name: fields.firstName.trim() || null,
        last_name: fields.lastName.trim() || null,
        role: fields.isAdmin ? "platform_admin" : "user",
      })
      router.push(`/platform/users/${encodeURIComponent(user.id)}`)
    })
  }

  return (
    <div className="max-w-4xl p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <UsersIcon className="size-5 text-primary" />
            {t("platform.users.title")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("platform.users.desc")}
          </p>
        </div>
        <CreatePlatformUserDialog
          modal={createModal}
          actions={createActions}
          onOpenCreate={openCreate}
          fields={fields}
          onFieldsChange={setFields}
          onCreate={handleCreate}
        />
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        searchable
        searchPlaceholder={t("common.search_by_name")}
      />
    </div>
  )
}
