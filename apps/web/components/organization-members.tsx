"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type OrganizationOut, type OrgRole } from "@/lib/api"
import {
  useOrganizationMembers,
  useAddOrganizationMember,
  useUpdateOrganizationMemberRole,
  useRemoveOrganizationMember,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

const ROLES: OrgRole[] = ["owner", "admin", "member"]

/** Member management for one organization — add/change-role/remove are owner-only (server-enforced; hidden here for a clean UI). */
export function OrganizationMembers({
  org,
  open,
  onOpenChange,
}: {
  org: OrganizationOut
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  const { data: members = [], isLoading } = useOrganizationMembers(org.id)
  const addMember = useAddOrganizationMember(org.id)
  const updateRole = useUpdateOrganizationMemberRole(org.id)
  const removeMember = useRemoveOrganizationMember(org.id)
  const canManage = org.role === "owner"

  const [addModal, addActions] = useFormModal<null>()
  const [removeModal, removeActions] = useFormModal<{
    user_id: string
    username: string
  }>()
  const [username, setUsername] = useState("")
  const [role, setRole] = useState<OrgRole>("member")

  function roleLabel(r: OrgRole): string {
    return r === "owner"
      ? t("settings.org.role_owner")
      : r === "admin"
        ? t("settings.org.role_admin")
        : t("settings.org.role_member")
  }

  async function handleAdd() {
    if (!username.trim()) return
    await addActions.run(async () => {
      await addMember.mutateAsync({ username: username.trim(), role })
      setUsername("")
      setRole("member")
    })
  }

  async function handleRemove() {
    if (!removeModal.target) return
    await removeActions.run(async () => {
      await removeMember.mutateAsync(removeModal.target!.user_id)
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("settings.org.members_title")} — {org.name}
            </DialogTitle>
            <DialogDescription>
              {t("settings.org.members_count", {
                n: members.length,
                s: members.length !== 1 ? "s" : "",
              })}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : (
            <div className="max-h-72 divide-y divide-border overflow-hidden overflow-y-auto rounded-lg border border-border">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {m.username}
                    </p>
                  </div>
                  {canManage ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateRole.mutate({
                          userId: m.user_id,
                          role: e.target.value as OrgRole,
                        })
                      }
                      disabled={updateRole.isPending}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {roleLabel(m.role)}
                    </span>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        removeActions.openWith({
                          user_id: m.user_id,
                          username: m.username,
                        })
                      }
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="add-member-username" className="text-[12px]">
                    {t("settings.members.username")}
                  </Label>
                  <Input
                    id="add-member-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd()
                    }}
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="add-member-role" className="text-[12px]">
                    {t("common.role")}
                  </Label>
                  <select
                    id="add-member-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as OrgRole)}
                    className="rounded-md border border-border bg-background px-2 py-2 text-[13px] text-foreground"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {addModal.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {addModal.error}
                </div>
              )}
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={addModal.isPending || !username.trim()}
              >
                <Plus className="size-3.5" />
                {t("settings.org.add_member_btn")}
              </Button>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeModal.open}
        onOpenChange={(o) => !o && removeActions.close()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.org.remove_member_title")}</DialogTitle>
            <DialogDescription>
              {t("settings.org.remove_member_desc", {
                name: removeModal.target?.username ?? "",
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
    </>
  )
}
