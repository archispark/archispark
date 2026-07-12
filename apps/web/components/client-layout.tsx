"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { Nav } from "@/components/nav"
import { Sidebar } from "@/components/sidebar"
import { PlatformAdminBlock } from "@/components/platform-admin-block"
import { useIsAdmin } from "@/hooks/use-current-user"
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
  const isLogin = pathname === "/login"
  // platform_admin has no workspace access, but IS meant to reach
  // /platform/* (organization administration, metadata only) — see
  // apps/web/app/platform/organizations/page.tsx.
  const isPlatformRoute = pathname?.startsWith("/platform")
  const isPlatformAdmin = useIsAdmin()
  // The workspaces overview is a full-width chrome-light page (no model context),
  // so it hides the sidebar — only the top nav stays.
  const hideSidebar = isLogin || pathname === "/workspaces"

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

  if (!isLogin && isPlatformAdmin && !isPlatformRoute) {
    return (
      <ThemeProvider>
        <PlatformAdminBlock />
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      {!isLogin && <Nav onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
      {!hideSidebar && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      )}
      <main
        className={
          isLogin
            ? ""
            : `mt-[var(--nav-h)] min-h-[calc(100vh-var(--nav-h))] transition-[margin-left] duration-200 ${
                hideSidebar
                  ? ""
                  : sidebarCollapsed
                    ? "md:ml-[var(--sidebar-w-collapsed,56px)]"
                    : "md:ml-[var(--sidebar-w)]"
              }`
        }
      >
        {!isLogin && <SiteBanner />}
        {children}
      </main>
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  )
}
