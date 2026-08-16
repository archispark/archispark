"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  LayoutGrid,
  Tag,
  Settings as SettingsIcon,
  GitBranch,
  Gauge,
  List,
  SearchCode,
  Blocks,
  CircleHelp,
} from "lucide-react"
import { useT } from "@/lib/i18n"
import { useWorkspaces, useOrganizations } from "@/lib/queries"
import { RailLink } from "@/components/sidebar-section"
import { UserMenu } from "@/components/user-menu"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"

/** Icon-only rail shown on desktop when the sidebar is collapsed. */
export function SidebarIconRail({
  pathname,
  onClose,
  collapsed,
  absentCount,
  relConflictCount,
  t,
}: {
  pathname: string
  onClose: () => void
  collapsed: boolean
  absentCount: number
  relConflictCount: number
  t: ReturnType<typeof useT>["t"]
}) {
  const { data: workspaces = [] } = useWorkspaces()
  const { data: organizations = [] } = useOrganizations()
  const activeWorkspace = workspaces.find((workspace) => workspace.active)
  const isWorkspacesOverview = pathname === "/workspaces"
  // No organization means no accessible section besides the home page — see
  // registry.ts, users can no longer self-provision one.
  const hasOrganization = organizations.length > 0
  const hideNav = isWorkspacesOverview || !hasOrganization

  return (
    <>
      <div
        className={`hidden flex-1 flex-col items-center gap-1 overflow-y-auto py-3 ${collapsed ? "md:flex md:overflow-visible" : ""}`}
      >
        <Link
          href="/"
          onClick={onClose}
          title="ArchiSpark"
          aria-label="ArchiSpark"
          className="mb-2 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="archispark-rail-logo"
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
              fill="url(#archispark-rail-logo)"
            />
          </svg>
        </Link>
        {hasOrganization && (
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            display="compact"
          />
        )}
        {!hideNav && (
          <>
            <div className="mb-1 w-6 border-t border-border" />
            <RailLink
              href="/overview"
              icon={LayoutDashboard}
              label={t("sidebar.overview")}
              active={pathname === "/overview"}
              onClick={onClose}
            />
            <div className="my-1 w-6 border-t border-border" />
            <RailLink
              href="/dashboards"
              icon={Gauge}
              label={t("sidebar.dashboards")}
              active={pathname.startsWith("/dashboards")}
              onClick={onClose}
            />
            <RailLink
              href="/explore"
              icon={SearchCode}
              label={t("sidebar.explore")}
              active={pathname === "/explore"}
              onClick={onClose}
            />
            <RailLink
              href="/panel-visualizations"
              icon={Blocks}
              label={t("sidebar.panel_catalog")}
              active={pathname === "/panel-visualizations"}
              onClick={onClose}
            />
            <div className="my-1 w-6 border-t border-border" />
            <RailLink
              href="/elements"
              icon={List}
              label={t("sidebar.elements")}
              active={pathname === "/elements"}
              onClick={onClose}
              badge={absentCount > 0 ? "amber" : undefined}
            />
            <RailLink
              href="/relationships"
              icon={GitBranch}
              label={t("sidebar.relationships")}
              active={pathname === "/relationships"}
              onClick={onClose}
              badge={relConflictCount > 0 ? "destructive" : undefined}
            />
            <RailLink
              href="/views"
              icon={LayoutGrid}
              label={t("sidebar.views")}
              active={pathname === "/views" || pathname.startsWith("/views/")}
              onClick={onClose}
            />
            <RailLink
              href="/properties"
              icon={Tag}
              label={t("sidebar.properties")}
              active={pathname === "/properties"}
              onClick={onClose}
            />
            <RailLink
              href="/settings"
              icon={SettingsIcon}
              label={`${t("sidebar.settings")} — ${t("sidebar.general")}`}
              active={
                pathname === "/settings" || pathname.startsWith("/settings/")
              }
              onClick={onClose}
            />
          </>
        )}
      </div>

      <div
        className={`hidden flex-col items-center gap-1 border-t border-border py-2 ${collapsed ? "md:flex" : ""}`}
      >
        <a
          href="https://archispark.io/docs/"
          target="_blank"
          rel="noreferrer"
          title="Aide"
          aria-label="Aide"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <CircleHelp className="size-4" />
        </a>
        <UserMenu placement="up" align="left" />
      </div>
    </>
  )
}
