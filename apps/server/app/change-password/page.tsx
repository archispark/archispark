"use client"

import { useState, type FormEvent } from "react"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

/** Forced password change — the only page a `mustChangePassword` session can reach (see proxy.ts). */
export default function ChangePasswordPage() {
  const { t } = useT()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function skipPasswordChange() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/local/skip-password-change", {
        method: "POST",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(
          typeof body.detail === "string"
            ? body.detail
            : t("change_password.error")
        )
        setSubmitting(false)
        return
      }
      window.location.href = "/"
    } catch {
      setError(t("change_password.error"))
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError(t("change_password.mismatch"))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/local/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(
          typeof body.detail === "string"
            ? body.detail
            : t("change_password.error")
        )
        setSubmitting(false)
        return
      }
      window.location.href = "/"
    } catch {
      setError(t("change_password.error"))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="change-password-spark"
                x1="0"
                y1="0"
                x2="24"
                y2="24"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FF1D5D" />
                <stop offset="50%" stopColor="#892FE8" />
                <stop offset="100%" stopColor="#1A87FF" />
              </linearGradient>
            </defs>
            <path
              d="M12 0 C12 7 13 11 24 12 C13 13 12 17 12 24 C12 17 11 13 0 12 C11 11 12 7 12 0 Z"
              fill="url(#change-password-spark)"
            />
          </svg>
          <span
            className="text-[22px] leading-none tracking-tight"
            style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
          >
            <span className="font-light text-foreground">Archi</span>
            <span className="font-bold text-primary">Spark</span>
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-base font-semibold">
            {t("change_password.title")}
          </h1>
          <p className="mb-5 text-[13px] text-muted-foreground">
            {t("change_password.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">{t("change_password.current")}</Label>
              <Input
                id="cp-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-new">{t("change_password.new")}</Label>
              <Input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">{t("change_password.confirm")}</Label>
              <Input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? t("change_password.submitting")
                : t("change_password.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={submitting}
              onClick={skipPasswordChange}
            >
              {submitting
                ? t("change_password.skipping")
                : t("change_password.skip")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
