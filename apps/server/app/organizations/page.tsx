"use client"

import { useState } from "react"
import { Building2, Pencil, Trash2, Check, Users } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type OrganizationOut } from "@/lib/api"
import {
  useOrganizations,
  useCreateOrganization,
  useRenameOrganization,
  useDeleteOrganization,
  useActivateOrganization,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { OrganizationMembers } from "@/components/organization-members"
import {
  CreateOrganizationDialog,
  EditOrganizationDialog,
  DeleteOrganizationDialog,
} from "@/components/organization-dialogs"
import { Button } from "@workspace/ui/components/button"

export default function OrganizationsPage() {
  const { t } = useT()
  const { data: organizations = [], isLoading } = useOrganizations()
  const createOrg = useCreateOrganization()
  const renameOrg = useRenameOrganization()
  const deleteOrg = useDeleteOrganization()
  const activateOrg = useActivateOrganization()

  const [createModal, createActions] = useFormModal<null>()
  const [editModal, editActions] = useFormModal<OrganizationOut>()
  const [deleteModal, deleteActions] = useFormModal<OrganizationOut>()
  const [membersOrg, setMembersOrg] = useState<OrganizationOut | null>(null)

  const [newName, setNewName] = useState("")
  const [editName, setEditName] = useState("")

  function openEdit(org: OrganizationOut) {
    setEditName(org.name)
    editActions.openWith(org)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    await createActions.run(async () => {
      await createOrg.mutateAsync(newName.trim())
      setNewName("")
    })
  }

  async function handleEditSave() {
    if (!editModal.target || !editName.trim()) return
    await editActions.run(async () => {
      await renameOrg.mutateAsync({
        id: editModal.target!.id,
        name: editName.trim(),
      })
    })
  }

  async function handleDelete() {
    if (!deleteModal.target) return
    await deleteActions.run(async () => {
      await deleteOrg.mutateAsync(deleteModal.target!.id)
    })
  }

  return (
    <div className="max-w-3xl p-7">
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

        <CreateOrganizationDialog
          modal={createModal}
          actions={createActions}
          name={newName}
          onNameChange={setNewName}
          onOpenNew={() => {
            setNewName("")
            createActions.openNew()
          }}
          onCreate={handleCreate}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {organizations.map((org) => (
            <div key={org.id} className="flex items-center gap-3 px-4 py-3">
              <Building2
                className={`size-4 shrink-0 ${org.active ? "text-primary" : "text-muted-foreground"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                  {org.name}
                  {org.is_personal && (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {t("organizations.personal_badge")}
                    </span>
                  )}
                  {!org.enabled && (
                    <span className="rounded-full border border-destructive/30 px-1.5 py-0.5 text-[10px] font-normal text-destructive">
                      {t("organizations.suspended_badge")}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    `settings.org.role_${org.role}` as "settings.org.role_owner"
                  )}
                </p>
              </div>
              {org.active ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
                  <Check className="size-3.5" />
                  {t("nav.workspace_active")}
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => activateOrg.mutate(org.id)}
                  disabled={activateOrg.isPending}
                  className="shrink-0"
                >
                  {t("workspaces.activate")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setMembersOrg(org)}
                aria-label={t("settings.org.members_title")}
              >
                <Users className="size-3.5" />
              </Button>
              {(org.role === "owner" || org.role === "admin") && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => openEdit(org)}
                  aria-label={t("common.edit")}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
              {org.role === "owner" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => deleteActions.openWith(org)}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <EditOrganizationDialog
        modal={editModal}
        actions={editActions}
        name={editName}
        onNameChange={setEditName}
        onSave={handleEditSave}
      />

      <DeleteOrganizationDialog
        modal={deleteModal}
        actions={deleteActions}
        onConfirm={handleDelete}
      />

      {membersOrg && (
        <OrganizationMembers
          org={membersOrg}
          open={!!membersOrg}
          onOpenChange={(o) => !o && setMembersOrg(null)}
        />
      )}
    </div>
  )
}
