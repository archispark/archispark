"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Ban, Play } from "lucide-react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"
import { usePlatformUser, useUpdatePlatformUser } from "@/lib/queries"
import { PlatformUserForm } from "@/components/platform-user-form"
import { PlatformUserOrganizations } from "@/components/platform-user-organizations"
import { Button } from "@workspace/ui/components/button"

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
  const updateProfile = useUpdatePlatformUser()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? "")
    setLastName(user.last_name ?? "")
    setEmail(user.email)
    setIsAdmin(user.role === "platform_admin")
  }, [user])

  const dirty =
    !!user &&
    (firstName !== (user.first_name ?? "") ||
      lastName !== (user.last_name ?? "") ||
      email !== user.email ||
      isAdmin !== (user.role === "platform_admin") ||
      password.length > 0)

  async function handleSave() {
    if (!user) return
    setError(null)
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        changes: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim(),
          role: isAdmin ? "platform_admin" : "user",
          ...(password ? { password } : {}),
        },
      })
      setPassword("")
      toast.success(t("platform.users.saved"))
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

  if (!user) {
    return (
      <div className="max-w-3xl space-y-4 p-7">
        <p className="text-sm text-muted-foreground">
          {t("platform.users.user_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {user.display_name || user.username}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                user.enabled
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {user.enabled
                ? t("platform.status_enabled")
                : t("platform.status_suspended")}
            </span>
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {user.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
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
          <Button
            onClick={handleSave}
            disabled={updateProfile.isPending || !dirty}
            className="shrink-0 bg-indigo-600 text-primary-foreground hover:bg-indigo-700"
          >
            {updateProfile.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      <PlatformUserForm
        firstName={firstName}
        onFirstNameChange={setFirstName}
        lastName={lastName}
        onLastNameChange={setLastName}
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        isAdmin={isAdmin}
        onIsAdminChange={setIsAdmin}
        error={error}
      />
      <PlatformUserOrganizations user={user} />
    </div>
  )
}
