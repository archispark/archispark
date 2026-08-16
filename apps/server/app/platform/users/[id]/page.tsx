"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Ban, Play } from "lucide-react"
import { useT } from "@/lib/i18n"
import { usePlatformUser, useUpdatePlatformUser } from "@/lib/queries"
import { PlatformUserForm } from "@/components/platform-user-form"
import { PlatformUserOrganizations } from "@/components/platform-user-organizations"

/**
 * platform_admin-only — edits a single local account (identity, password,
 * platform_admin flag) and its organization memberships. See
 * platform-users-store.ts / platform-user-organizations-store.ts.
 */
export default function PlatformUserDetailPage() {
  const params = useParams<{ id: string }>()!
  const userId = decodeURIComponent(params.id)
  const { t } = useT()
  const { data: user, isLoading } = usePlatformUser(userId)
  const updateUser = useUpdatePlatformUser()

  if (isLoading) {
    return (
      <div className="p-7 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-3xl space-y-4 p-7">
        <BackLink t={t} />
        <p className="text-sm text-muted-foreground">
          {t("platform.users.user_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <BackLink t={t} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">
            {user.display_name || user.username}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {user.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-[11px] font-medium ${user.enabled ? "text-primary" : "text-destructive"}`}
          >
            {user.enabled
              ? t("platform.status_enabled")
              : t("platform.status_suspended")}
          </span>
          <button
            type="button"
            onClick={() =>
              updateUser.mutate({
                id: user.id,
                changes: { enabled: !user.enabled },
              })
            }
            disabled={updateUser.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {user.enabled ? (
              <>
                <Ban className="size-3.5" />
                {t("platform.suspend")}
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                {t("platform.reactivate")}
              </>
            )}
          </button>
        </div>
      </div>

      <PlatformUserForm user={user} />
      <PlatformUserOrganizations user={user} />
    </div>
  )
}

function BackLink({ t }: { t: ReturnType<typeof useT>["t"] }) {
  return (
    <Link
      href="/platform/users"
      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground no-underline hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      {t("platform.users.title")}
    </Link>
  )
}
