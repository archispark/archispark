"use client"

import { useState } from "react"
import { Building2, Trash2, Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type PlatformUserDetailOut, type OrgRole } from "@/lib/api"
import {
  usePlatformOrganizations,
  useAddPlatformUserOrganization,
  useRemovePlatformUserOrganization,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { ROLES, roleLabel } from "@/components/organization-member-list"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

/**
 * platform_admin-only — add/remove the organizations a local account
 * belongs to, from its detail page. See platform-user-organizations-store.ts.
 */
export function PlatformUserOrganizations({
  user,
}: {
  user: PlatformUserDetailOut
}) {
  const { t } = useT()
  const { data: allOrgs = [] } = usePlatformOrganizations()
  const addOrg = useAddPlatformUserOrganization()
  const removeOrg = useRemovePlatformUserOrganization()
  const [removeModal, removeActions] =
    useFormModal<PlatformUserDetailOut["organizations"][number]>()

  const availableOrgs = allOrgs.filter(
    (o) => !user.organizations.some((m) => m.id === o.id)
  )
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [selectedRole, setSelectedRole] = useState<OrgRole>("viewer")

  async function handleAdd() {
    const orgId = selectedOrgId || availableOrgs[0]?.id
    if (!orgId) return
    await addOrg.mutateAsync({
      id: user.id,
      body: { organization_id: orgId, role: selectedRole },
    })
    setSelectedOrgId("")
  }

  async function handleRemove() {
    if (!removeModal.target) return
    await removeActions.run(async () => {
      await removeOrg.mutateAsync({ id: user.id, orgId: removeModal.target!.id })
    })
  }

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Building2 className="size-4 text-primary" />
        {t("platform.users.organizations_title")}
      </h2>

      {user.organizations.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {t("platform.users.no_organizations")}
        </p>
      ) : (
        <div className="mb-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {user.organizations.map((org) => (
            <div key={org.id} className="flex items-center gap-3 px-4 py-3">
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
                <p className="font-mono text-[11px] text-muted-foreground">
                  {org.slug}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {roleLabel(t, org.role as OrgRole)}
              </span>
              <Button
                variant="destructive"
                size="icon-xs"
                onClick={() => removeActions.openWith(org)}
                aria-label={t("common.delete")}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableOrgs.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
          >
            {availableOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
            className="shrink-0 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(t, r)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={addOrg.isPending}
          >
            <Plus className="size-3.5" />
            {t("common.add")}
          </Button>
        </div>
      )}

      <Dialog
        open={removeModal.open}
        onOpenChange={(o) => !o && removeActions.close()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("platform.users.remove_org_title")}
            </DialogTitle>
            <DialogDescription>
              {t("platform.users.remove_org_desc", {
                name: removeModal.target?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          {removeModal.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {removeModal.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeModal.isPending}
            >
              {removeModal.isPending
                ? t("common.deleting")
                : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
