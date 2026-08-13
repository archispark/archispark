"use client"

import { Suspense, useState, useEffect, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { useT } from "@/lib/i18n"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

interface Providers {
  keycloakSsoEnabled: boolean
  keycloakProviderName: string
}

function LoginPageInner() {
  const { t } = useT()
  // useSearchParams() is typed nullable only for pages/-router compat (this
  // app only calls it from app/ client components, where it's always populated).
  const searchParams = useSearchParams()!
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const [providers, setProviders] = useState<Providers | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/settings/messages")
      .then((r) => r.json())
      .then(
        (d: {
          login_message: string | null
          login_message_enabled: boolean
        }) => {
          if (d.login_message_enabled && d.login_message)
            setLoginMessage(d.login_message)
        }
      )
      .catch(() => {})
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() =>
        setProviders({
          keycloakSsoEnabled: false,
          keycloakProviderName: "Keycloak",
        })
      )
  }, [])

  const from = searchParams.get("from")
  const keycloakLoginUrl = from
    ? `/api/auth/login?from=${encodeURIComponent(from)}`
    : "/api/auth/login"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        setError(t("login.wrong_credentials"))
        setSubmitting(false)
        return
      }
      window.location.href = from || "/"
    } catch {
      setError(t("login.wrong_credentials"))
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
                id="login-spark"
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
              fill="url(#login-spark)"
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
          <h1 className="mb-1 text-base font-semibold">{t("login.title")}</h1>
          <p className="mb-5 text-[13px] text-muted-foreground">
            {t("login.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-username">{t("login.username")}</Label>
              <Input
                id="login-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">{t("login.password")}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>

          {providers?.keycloakSsoEnabled && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[12px] text-muted-foreground">
                  {t("login.or")}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                render={<a href={keycloakLoginUrl} />}
                className="w-full"
              >
                {t("login.continue_with", {
                  name: providers.keycloakProviderName,
                })}
              </Button>
            </>
          )}
        </div>

        {loginMessage && (
          <div className="mt-4 rounded-lg border border-border bg-card/60 px-4 py-3 text-[12px] whitespace-pre-wrap text-muted-foreground">
            {loginMessage}
          </div>
        )}
      </div>
    </div>
  )
}
