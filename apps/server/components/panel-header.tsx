"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { type ElementOut } from "@/lib/api"
import { useWorkspaces, useElement, useView } from "@/lib/queries"
import { useDashboard } from "@/lib/queries/dashboards"
import { useT } from "@/lib/i18n"
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
  const { data: workspaces = [], isSuccess: wsLoaded } = useWorkspaces()
  const qc = useQueryClient()
  const segments = pathname.split("/").filter(Boolean)

  useEffect(() => {
    if (wsLoaded && workspaces.length === 0 && pathname !== "/workspaces") {
      router.push("/workspaces")
    }
  }, [wsLoaded, workspaces.length, pathname, router])

  const elementId =
    segments[0] === "elements" && segments.length === 2
      ? decodeURIComponent(segments[1]!)
      : ""
  const { data: breadcrumbElement } = useElement(elementId)
  const viewId =
    segments[0] === "views" && segments.length === 2
      ? decodeURIComponent(segments[1]!)
      : ""
  const { data: breadcrumbView } = useView(viewId)
  const dashboardId =
    segments[0] === "dashboards"
      ? segments[1] === "admin"
        ? segments[2] && segments[2] !== "new"
          ? decodeURIComponent(segments[2])
          : ""
        : segments[1]
          ? decodeURIComponent(segments[1])
          : ""
      : ""
  const { data: breadcrumbDashboard } = useDashboard(dashboardId)

  function segmentLabel(segment: string, index: number): string {
    const keys: Record<string, Parameters<typeof t>[0]> = {
      elements: "breadcrumb.elements",
      relationships: "breadcrumb.relationships",
      views: "breadcrumb.views",
      validator: "breadcrumb.validator",
      properties: "breadcrumb.properties",
      users: "breadcrumb.users",
      settings: "breadcrumb.settings",
      workspaces: "breadcrumb.workspaces",
      dashboards: "sidebar.dashboards",
      explore: "sidebar.explore",
      "panel-visualizations": "sidebar.panel_catalog",
      organizations: "breadcrumb.organizations",
      platform: "platform.title",
      admin: "breadcrumb.admin",
      new: "common.create",
      edit: "common.edit",
      invitations: "invitations.page_title",
      login: "breadcrumb.login",
      profile: "breadcrumb.profile",
    }
    if (keys[segment]) return t(keys[segment])

    const id = decodeURIComponent(segment)
    if (segments[index - 1] === "elements") {
      const name =
        (breadcrumbElement?.identifier === id
          ? breadcrumbElement.name
          : undefined) ?? qc.getQueryData<ElementOut>(["element", id])?.name
      if (name) return name
      if (id === elementId) return "…"
    }
    if (segments[index - 1] === "views") {
      const name =
        (breadcrumbView?.identifier === id ? breadcrumbView.name : undefined) ??
        qc.getQueryData<{ name?: string }>(["view", id])?.name
      if (name) return name
      if (id === viewId) return "…"
    }
    if (
      id === dashboardId &&
      (segments[index - 1] === "dashboards" || segments[index - 2] === "admin")
    ) {
      return breadcrumbDashboard?.definition.title ?? "…"
    }
    return id
  }

  return (
    <header className="flex h-[var(--nav-h)] shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
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

      {workspaces.length > 0 && segments.length > 0 && (
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
