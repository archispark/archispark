"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n"
import { type OrganizationOut, type OrgRole } from "@/lib/api"
import {
  useOrganizationMembers,
  useUpdateOrganizationMemberRole,
  useRemoveOrganizationMember,
  useOrganizationInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useResendInvitation,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { MemberList } from "@/components/organization-member-list"
import { OrganizationInvitationsPanel } from "@/components/organization-invitations-panel"
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
  const updateRole = useUpdateOrganizationMemberRole(org.id)
  const removeMember = useRemoveOrganizationMember(org.id)
  const { data: invitations = [] } = useOrganizationInvitations(org.id)
  const createInvitation = useCreateInvitation(org.id)
  const revokeInvitation = useRevokeInvitation(org.id)
  const resendInvitation = useResendInvitation(org.id)
  const canManage = org.role === "owner"

  const [inviteModal, inviteActions] = useFormModal<null>()
  const [removeModal, removeActions] = useFormModal<{
    user_id: string
    username: string
  }>()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("member")

  async function handleInvite() {
    if (!email.trim()) return
    await inviteActions.run(async () => {
      await createInvitation.mutateAsync({ email: email.trim(), role })
      setEmail("")
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

          <MemberList
            members={members}
            isLoading={isLoading}
            canManage={canManage}
            onUpdateRole={(userId, r) => updateRole.mutate({ userId, role: r })}
            updateRolePending={updateRole.isPending}
            onRemove={removeActions.openWith}
          />

          {canManage && (
            <OrganizationInvitationsPanel
              invitations={invitations}
              inviteModal={inviteModal}
              email={email}
              onEmailChange={setEmail}
              role={role}
              onRoleChange={setRole}
              onInvite={handleInvite}
              onResend={(id) => resendInvitation.mutate(id)}
              resendPending={resendInvitation.isPending}
              onRevoke={(id) => revokeInvitation.mutate(id)}
              revokePending={revokeInvitation.isPending}
            />
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
