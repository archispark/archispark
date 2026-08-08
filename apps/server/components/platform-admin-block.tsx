"use client"

import Link from "next/link"
import { ShieldAlert, LogOut, Building2 } from "lucide-react"
import { useT } from "@/lib/i18n"

/**
 * Platform admins have no workspaces of their own — shown instead of the
 * workspace UI when a platform_admin session reaches apps/web. The only way
 * out is /platform/organizations (organization administration, metadata
 * only — see client-layout.tsx's bypass for that route) or logout.
 */
export function PlatformAdminBlock() {
  const { t } = useT()

  function logout() {
    window.location.href = "/api/auth/logout"
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          {t("platform_admin_block.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("platform_admin_block.desc")}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/platform/organizations"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Building2 className="size-4" />
            {t("platform.title")}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
          >
            <LogOut className="size-4" />
            {t("nav.logout")}
          </button>
        </div>
      </div>
    </div>
  )
}
