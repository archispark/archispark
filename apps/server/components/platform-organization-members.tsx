"use client"

import { useState } from "react"
import { Users as UsersIcon, Trash2, Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type PlatformOrganizationDetailOut, type OrgRole } from "@/lib/api"
import {
  usePlatformUsers,
  useAddPlatformOrganizationMember,
  useRemovePlatformOrganizationMember,
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
 * platform_admin-only — add/remove an organization's members from its
 * detail page. See platform-organization-members-store.ts.
 */
export function PlatformOrganizationMembers({
  org,
}: {
  org: PlatformOrganizationDetailOut
}) {
  const { t } = useT()
  const { data: allUsers = [] } = usePlatformUsers()
  const addMember = useAddPlatformOrganizationMember()
  const removeMember = useRemovePlatformOrganizationMember()
  const [removeModal, removeActions] =
    useFormModal<PlatformOrganizationDetailOut["members"][number]>()

  const availableUsers = allUsers.filter(
    (u) => !org.members.some((m) => m.id === u.id)
  )
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState<OrgRole>("viewer")

  async function handleAdd() {
    const userId = selectedUserId || availableUsers[0]?.id
    if (!userId) return
    await addMember.mutateAsync({
      id: org.id,
      body: { user_id: userId, role: selectedRole },
    })
    setSelectedUserId("")
  }

  async function handleRemove() {
    if (!removeModal.target) return
    await removeActions.run(async () => {
      await removeMember.mutateAsync({
        id: org.id,
        userId: removeModal.target!.id,
      })
    })
  }

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <UsersIcon className="size-4 text-primary" />
        {t("platform.orgs.members_title")}
      </h2>

      {org.members.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {t("platform.orgs.no_members")}
        </p>
      ) : (
        <div className="mb-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {org.members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {member.display_name || member.username}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {member.email}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {roleLabel(t, member.role as OrgRole)}
              </span>
              <Button
                variant="destructive"
                size="icon-xs"
                onClick={() => removeActions.openWith(member)}
                aria-label={t("common.delete")}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
          >
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name || u.username}
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
            disabled={addMember.isPending}
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
            <DialogTitle>{t("platform.orgs.remove_member_title")}</DialogTitle>
            <DialogDescription>
              {t("platform.orgs.remove_member_desc", {
                name:
                  removeModal.target?.display_name ||
                  removeModal.target?.username ||
                  "",
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
