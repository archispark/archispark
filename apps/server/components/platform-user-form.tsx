"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"
import { type PlatformUserDetailOut } from "@/lib/api"
import { useUpdatePlatformUser } from "@/lib/queries"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

/**
 * platform_admin-only — edits a local account's identity (first/last name,
 * email, password) and platform_admin flag. Suspend/reactivate stays a
 * separate immediate action, same as the users list.
 */
export function PlatformUserForm({ user }: { user: PlatformUserDetailOut }) {
  const { t } = useT()
  const updateUser = useUpdatePlatformUser()

  const [firstName, setFirstName] = useState(user.first_name ?? "")
  const [lastName, setLastName] = useState(user.last_name ?? "")
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(user.role === "platform_admin")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFirstName(user.first_name ?? "")
    setLastName(user.last_name ?? "")
    setEmail(user.email)
    setIsAdmin(user.role === "platform_admin")
  }, [user])

  const dirty =
    firstName !== (user.first_name ?? "") ||
    lastName !== (user.last_name ?? "") ||
    email !== user.email ||
    isAdmin !== (user.role === "platform_admin") ||
    password.length > 0

  async function handleSave() {
    setError(null)
    try {
      await updateUser.mutateAsync({
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

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="user-first-name">
            {t("platform.users.first_name")}
          </Label>
          <Input
            id="user-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="user-last-name">
            {t("platform.users.last_name")}
          </Label>
          <Input
            id="user-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="user-email">{t("common.email")}</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="user-password">
            {t("platform.users.new_password")}
          </Label>
          <Input
            id="user-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("platform.users.new_password_placeholder")}
            className="mt-1"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
          className="shrink-0 rounded"
        />
        {t("platform.users.role_admin")}
      </label>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button onClick={handleSave} disabled={updateUser.isPending || !dirty}>
        {updateUser.isPending ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  )
}
