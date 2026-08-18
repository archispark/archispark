"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useWorkspaces, useOrganizations } from "@/lib/queries"
import { useT } from "@/lib/i18n"
import { useMounted } from "@/hooks/use-mounted"
import { useBreadcrumbSegments } from "@/hooks/use-breadcrumb-segments"
import { ThemeToggle } from "@/components/theme-toggle"

export function PanelHeader({
  showSidebarToggle,
  sidebarCollapsed,
  onToggleSidebar,
  onToggleMobileSidebar,
}: {
  showSidebarToggle: boolean
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onToggleMobileSidebar: () => void
}) {
  const pathname = usePathname()!
  const router = useRouter()
  const { t } = useT()
  const mounted = useMounted()
  const { data: workspaces = [], isSuccess: wsLoaded } = useWorkspaces()
  const { data: organizations = [], isSuccess: orgsLoaded } = useOrganizations()
  const { segments, segmentLabel } = useBreadcrumbSegments()

  useEffect(() => {
    // A platform_admin with no real organization membership has zero
    // organizations and zero workspaces (both list endpoints return []
    // rather than erroring — see registry.ts / organizations-store.ts) —
    // must not be bounced out of /platform/* while managing organizations,
    // users, plugins or images.
    if (!wsLoaded || !orgsLoaded || pathname.startsWith("/platform")) return

    // No organization at all: users can no longer self-provision one by
    // creating a workspace (see registry.ts), so /workspaces would only
    // dead-end them — send them to the simple starter home page instead.
    if (organizations.length === 0) {
      if (pathname !== "/") router.push("/")
      return
    }

    if (workspaces.length === 0 && pathname !== "/workspaces") {
      router.push("/workspaces")
    }
  }, [
    wsLoaded,
    orgsLoaded,
    organizations.length,
    workspaces.length,
    pathname,
    router,
  ])

  return (
    <header className="sticky top-0 z-40 flex h-[var(--nav-h)] shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
      {showSidebarToggle && (
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle menu"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu className="size-4" />
        </button>
      )}
      <Link
        href="/"
        aria-label="ArchiSpark"
        className="flex shrink-0 items-center gap-1.5 no-underline md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="archispark-header-logo"
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
            fill="url(#archispark-header-logo)"
          />
        </svg>
        <span
          className="text-[15px] leading-none tracking-tight text-foreground"
          style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
        >
          <span className="font-light">Archi</span>
          <span className="font-bold text-primary">Spark</span>
        </span>
      </Link>
      {showSidebarToggle && (
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          aria-label={
            sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")
          }
          className="hidden size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      )}
      {showSidebarToggle && (
        <div className="hidden h-4 w-px bg-border md:block" />
      )}

      {mounted && workspaces.length > 0 && segments.length > 0 && (
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[13px] text-muted-foreground">
          {segments.map((segment, index) => {
            const last = index === segments.length - 1
            return (
              <span
                key={segment}
                className="flex min-w-0 items-center gap-1.5 overflow-hidden"
              >
                {index > 0 && <span className="shrink-0 text-border">/</span>}
                {last ? (
                  <span className="truncate whitespace-nowrap text-foreground">
                    {segmentLabel(segment, index)}
                  </span>
                ) : (
                  <Link
                    href={`/${segments.slice(0, index + 1).join("/")}`}
                    className="whitespace-nowrap no-underline hover:text-foreground"
                  >
                    {segmentLabel(segment, index)}
                  </Link>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex-1" />
      <ThemeToggle />
    </header>
  )
}
