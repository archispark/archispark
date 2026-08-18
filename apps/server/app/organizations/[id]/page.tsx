"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useT } from "@/lib/i18n"
import { useOrganizations, useRenameOrganization } from "@/lib/queries"
import { OrganizationEditForm } from "@/components/organization-edit-form"
import { OrganizationMembersPanel } from "@/components/organization-members-panel"
import { Button } from "@workspace/ui/components/button"

/**
 * Organization detail/edit page for a regular member — name (owner-only)
 * and member management. Unlike the platform_admin equivalent
 * (app/platform/organizations/[id]/page.tsx), there is no suspend/reactivate
 * toggle or delete section: those are instance-level actions reserved for
 * platform_admin.
 */
export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>()!
  const orgId = decodeURIComponent(params.id)
  const { t } = useT()
  const { data: organizations = [], isLoading } = useOrganizations()
  const org = organizations.find((o) => o.id === orgId)
  const renameOrg = useRenameOrganization()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return
    setName(org.name)
    setDescription(org.description ?? "")
  }, [org?.id, org?.name, org?.description])

  const dirty =
    !!org && (name !== org.name || description !== (org.description ?? ""))

  async function handleSave() {
    if (!org) return
    setError(null)
    try {
      await renameOrg.mutateAsync({
        id: org.id,
        name: name.trim(),
        description: description.trim() || null,
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="p-7 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!org) {
    return (
      <div className="max-w-3xl space-y-4 p-7">
        <p className="text-sm text-muted-foreground">
          {t("organizations.org_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {org.name}
            {org.is_personal && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                {t("organizations.personal_badge")}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                org.enabled
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {org.enabled
                ? t("organizations.active_badge")
                : t("organizations.suspended_badge")}
            </span>
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t(`settings.org.role_${org.role}` as "settings.org.role_owner")}
          </p>
        </div>

        {org.role === "owner" && (
          <Button
            onClick={handleSave}
            disabled={renameOrg.isPending || !dirty || !name.trim()}
            className="shrink-0 bg-indigo-600 text-primary-foreground hover:bg-indigo-700"
          >
            {renameOrg.isPending ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </div>

      {org.role === "owner" && (
        <OrganizationEditForm
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          error={error}
        />
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold">
          {t("settings.org.members_title")}
        </h2>
        <OrganizationMembersPanel org={org} />
      </div>
    </div>
  )
}
