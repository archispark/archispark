"use client"

import { Mail, RefreshCw, Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type OrgRole, type OrganizationInvitationOut } from "@/lib/api"
import type { FormModalState } from "@/hooks/use-form-modal"
import { ROLES, roleLabel } from "@/components/organization-member-list"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"

export function OrganizationInvitationsPanel({
  invitations,
  inviteModal,
  email,
  onEmailChange,
  role,
  onRoleChange,
  onInvite,
  onResend,
  resendPending,
  onRevoke,
  revokePending,
}: {
  invitations: OrganizationInvitationOut[]
  inviteModal: FormModalState<null>
  email: string
  onEmailChange: (v: string) => void
  role: OrgRole
  onRoleChange: (r: OrgRole) => void
  onInvite: () => void
  onResend: (invitationId: string) => void
  resendPending: boolean
  onRevoke: (invitationId: string) => void
  revokePending: boolean
}) {
  const { t } = useT()

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-[12px] font-medium text-muted-foreground">
        {t("settings.org.invitations_title")}
      </p>
      {invitations.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {t("settings.org.no_pending_invitations")}
        </p>
      ) : (
        <div className="max-h-40 divide-y divide-border overflow-hidden overflow-y-auto rounded-lg border border-border">
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{inv.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  {roleLabel(t, inv.role)}
                  {inv.expired && (
                    <>
                      {" · "}
                      {t("settings.org.invitation_expired")}
                    </>
                  )}
                  {!inv.sent_at && (
                    <>
                      {" · "}
                      {t("settings.org.invitation_not_sent")}
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onResend(inv.id)}
                disabled={resendPending}
                aria-label={t("settings.org.resend_invitation")}
              >
                <RefreshCw className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRevoke(inv.id)}
                disabled={revokePending}
                aria-label={t("settings.org.cancel_invitation")}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="invite-email" className="text-[12px]">
            {t("settings.org.invite_email")}
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onInvite()
            }}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="invite-role" className="text-[12px]">
            {t("settings.org.invite_role")}
          </Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => onRoleChange(e.target.value as OrgRole)}
            className="rounded-md border border-border bg-background px-2 py-2 text-[13px] text-foreground"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(t, r)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {inviteModal.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {inviteModal.error}
        </div>
      )}
      <Button
        size="sm"
        onClick={onInvite}
        disabled={inviteModal.isPending || !email.trim()}
      >
        <Mail className="size-3.5" />
        {t("settings.org.invite_btn")}
      </Button>
    </div>
  )
}
