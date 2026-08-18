"use client"

import { useT } from "@/lib/i18n"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

/**
 * platform_admin-only. Presentational identity fields (first/last name,
 * email, password, platform_admin flag) — state, the mutation and the Save
 * button live in the page itself so the button can sit next to the title,
 * at the same height as suspend/reactivate.
 */
export function PlatformUserForm({
  firstName,
  onFirstNameChange,
  lastName,
  onLastNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  isAdmin,
  onIsAdminChange,
  error,
}: {
  firstName: string
  onFirstNameChange: (value: string) => void
  lastName: string
  onLastNameChange: (value: string) => void
  email: string
  onEmailChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  isAdmin: boolean
  onIsAdminChange: (value: boolean) => void
  error: string | null
}) {
  const { t } = useT()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="user-first-name">
            {t("platform.users.first_name")}
          </Label>
          <Input
            id="user-first-name"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
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
            onChange={(e) => onLastNameChange(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="user-email">{t("common.email")}</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
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
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t("platform.users.new_password_placeholder")}
            className="mt-1"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => onIsAdminChange(e.target.checked)}
          className="shrink-0 rounded"
        />
        {t("platform.users.role_admin")}
      </label>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
