"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { PanelHeader } from "@/components/panel-header"
import { Sidebar } from "@/components/sidebar"
import { PlatformAdminBlock } from "@/components/platform-admin-block"
import { PlatformAdminBanner } from "@/components/platform-admin-banner"
import { useIsAdmin } from "@/hooks/use-current-user"
import { useActivePlatformOrganization } from "@/lib/queries"
import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Toaster } from "sonner"
import { X } from "lucide-react"

function SiteBanner() {
  const [message, setMessage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/settings/messages")
      .then((r) => r.json())
      .then(
        (d: {
          banner_message: string | null
          banner_message_enabled: boolean
        }) => {
          if (d.banner_message_enabled && d.banner_message) {
            const key = `banner-dismissed:${d.banner_message}`
            if (!sessionStorage.getItem(key)) setMessage(d.banner_message)
          }
        }
      )
      .catch(() => {})
  }, [])

  if (!message || dismissed) return null

  function dismiss() {
    sessionStorage.setItem(`banner-dismissed:${message}`, "1")
    setDismissed(true)
  }

  return (
    <div className="sticky top-[var(--nav-h)] z-30 flex items-start gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2.5 text-[13px] text-foreground">
      <span className="flex-1 whitespace-pre-wrap">{message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  // An invitee accepting an invitation isn't a member of any organization
  // yet, so the org-scoped nav/sidebar would just error or look empty —
  // same full-bleed chrome as /login. /change-password is reachable before
  // any organization context exists too (a platform_admin's forced
  // first-login password change, e.g. the seeded admin/admin account, has
  // no active org yet) — without this, PlatformAdminBlock below would
  // replace the change-password form and strand that account.
  const isChromeless =
    pathname === "/login" ||
    pathname === "/change-password" ||
    !!pathname?.startsWith("/invitations")
  // platform_admin has no workspace access of its own, but IS meant to
  // reach /platform/* (organization administration) — see
  // apps/server/app/platform/organizations/page.tsx — and gets the regular
  // app chrome for an organization's content, same as a real owner, as soon
  // as login enters it into one (defaults to the smallest existing
  // organization; can switch to another one from /platform/organizations).
  const isPlatformRoute = pathname?.startsWith("/platform")
  const isPlatformAdmin = useIsAdmin()
  const { data: activePlatformOrgData } =
    useActivePlatformOrganization(isPlatformAdmin)
  const activePlatformOrg = activePlatformOrgData?.organization ?? null
  // Organizations is a full-width chrome-light page, without a sidebar.
  const hideSidebar = isChromeless || pathname === "/organizations"

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1")
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0")
      return next
    })
  }, [])

  if (
    !isChromeless &&
    isPlatformAdmin &&
    !isPlatformRoute &&
    !activePlatformOrg
  ) {
    return (
      <ThemeProvider>
        <PlatformAdminBlock />
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      {!hideSidebar && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
        />
      )}
      <main
        className={
          isChromeless
            ? ""
            : `min-h-screen bg-background transition-[margin-left] duration-200 ${
                hideSidebar
                  ? ""
                  : sidebarCollapsed
                    ? "md:ml-[var(--sidebar-w-collapsed,56px)]"
                    : "md:ml-[var(--sidebar-w)]"
              }`
        }
      >
        {isChromeless ? (
          children
        ) : (
          <section className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
            <PanelHeader
              showSidebarToggle={!hideSidebar}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={toggleSidebarCollapsed}
              onToggleMobileSidebar={() => setSidebarOpen((open) => !open)}
            />
            {isPlatformAdmin && !isPlatformRoute && activePlatformOrg && (
              <PlatformAdminBanner organizationName={activePlatformOrg.name} />
            )}
            <SiteBanner />
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </section>
        )}
      </main>
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  )
}
