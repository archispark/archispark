"use client"

import { useState } from "react"
import { Building2, Pencil, Check, Users } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type OrganizationOut } from "@/lib/api"
import {
  useOrganizations,
  useRenameOrganization,
  useActivateOrganization,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { OrganizationMembers } from "@/components/organization-members"
import { EditOrganizationDialog } from "@/components/organization-dialogs"
import { Button } from "@workspace/ui/components/button"

export default function OrganizationsPage() {
  const { t } = useT()
  const { data: organizations = [], isLoading } = useOrganizations()
  const renameOrg = useRenameOrganization()
  const activateOrg = useActivateOrganization()

  const [editModal, editActions] = useFormModal<OrganizationOut>()
  const [membersOrg, setMembersOrg] = useState<OrganizationOut | null>(null)

  const [editName, setEditName] = useState("")

  function openEdit(org: OrganizationOut) {
    setEditName(org.name)
    editActions.openWith(org)
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
