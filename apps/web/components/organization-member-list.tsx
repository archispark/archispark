"use client"

import { Trash2 } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type OrgRole, type OrganizationMemberOut } from "@/lib/api"
import { Button } from "@workspace/ui/components/button"

export const ROLES: OrgRole[] = ["owner", "admin", "member"]

export function roleLabel(t: ReturnType<typeof useT>["t"], r: OrgRole): string {
  return r === "owner"
    ? t("settings.org.role_owner")
    : r === "admin"
      ? t("settings.org.role_admin")
      : t("settings.org.role_member")
}

export function MemberList({
  members,
  isLoading,
  canManage,
  onUpdateRole,
  updateRolePending,
  onRemove,
}: {
  members: OrganizationMemberOut[]
  isLoading: boolean
  canManage: boolean
  onUpdateRole: (userId: string, role: OrgRole) => void
  updateRolePending: boolean
  onRemove: (member: { user_id: string; username: string }) => void
}) {
  const { t } = useT()

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
    )
  }

  return (
    <div className="max-h-72 divide-y divide-border overflow-hidden overflow-y-auto rounded-lg border border-border">
      {members.map((m) => (
        <div key={m.user_id} className="flex items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{m.username}</p>
          </div>
          {canManage ? (
            <select
              value={m.role}
              onChange={(e) =>
                onUpdateRole(m.user_id, e.target.value as OrgRole)
              }
              disabled={updateRolePending}
              className="rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(t, r)}
                </option>
              ))}
            </select>
          ) : (
            <span className="shrink-0 text-[12px] text-muted-foreground">
              {roleLabel(t, m.role)}
            </span>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() =>
                onRemove({ user_id: m.user_id, username: m.username })
              }
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
