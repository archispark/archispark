"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useT } from "@/lib/i18n"
import {
  useInvitationPreview,
  useAcceptInvitation,
  useActivateOrganization,
} from "@/lib/queries"
import { type OrgRole } from "@/lib/api"
import { Button } from "@workspace/ui/components/button"

export default function InvitationAcceptPage() {
  const { t } = useT()
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = decodeURIComponent(params.token)

  const { data: preview, isLoading, error } = useInvitationPreview(token)
  const acceptInvitation = useAcceptInvitation()
  const activateOrg = useActivateOrganization()
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  function roleLabel(r: OrgRole): string {
    return r === "owner"
      ? t("settings.org.role_owner")
      : r === "admin"
        ? t("settings.org.role_admin")
        : t("settings.org.role_member")
  }

  async function handleAccept() {
    setAccepting(true)
    setAcceptError(null)
    try {
      const result = await acceptInvitation.mutateAsync(token)
      await activateOrg.mutateAsync(result.organization_id)
      router.push("/organizations")
    } catch (err) {
      setAcceptError((err as Error).message)
      setAccepting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold">
          {t("invitations.page_title")}
        </h1>

        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )}

        {!isLoading && error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && preview && (
          <>
            <p className="text-sm text-foreground">
              {t("invitations.invited_to", {
                org: preview.organization_name,
              })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("invitations.role_label", {
                role: roleLabel(preview.role),
              })}
            </p>

            {acceptError && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {acceptError}
              </div>
            )}

            <Button
              className="mt-4 w-full"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting
                ? t("invitations.accepting")
                : t("invitations.accept_btn")}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
