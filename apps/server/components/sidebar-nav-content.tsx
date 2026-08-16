"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  Gauge,
  SearchCode,
  Blocks,
  CircleHelp,
} from "lucide-react"
import { useT } from "@/lib/i18n"
import { useWorkspaces, useOrganizations } from "@/lib/queries"
import { Section } from "@/components/sidebar-section"
import { ElementsNavSection } from "@/components/sidebar-elements-nav"
import { UserMenu } from "@/components/user-menu"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"

/** Full sidebar nav content (overview, layer sections, settings) — hidden on desktop when collapsed to an icon rail. */
export function SidebarNavContent({
  pathname,
  onClose,
  t,
}: {
  pathname: string
  onClose: () => void
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
      <div className="border-b border-border px-4 pt-4 pb-3">
        <Link
          href="/"
          onClick={onClose}
          className="mb-4 flex items-center gap-2.5 no-underline"
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
                id="archispark-logo"
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
              fill="url(#archispark-logo)"
            />
          </svg>
          <span
            className="text-[17px] leading-none tracking-tight"
            style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
          >
            <span className="font-light text-foreground">Archi</span>
            <span className="font-bold text-primary">Spark</span>
          </span>
        </Link>
        {hasOrganization && (
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
          />
        )}
      </div>

      {hideNav ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 overflow-y-auto py-2">
          {/* Overview */}
          <Link
            href="/overview"
            onClick={onClose}
            className={`mx-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm no-underline transition-colors ${
              pathname === "/overview"
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            {t("sidebar.overview")}
          </Link>

          {/* Separator */}
          <div className="mx-4 mt-3 mb-1 border-t border-border" />

          {/* Dashboards group */}
          <Section title={t("sidebar.dashboards")}>
            <Link
              href="/dashboards"
              onClick={onClose}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
                pathname === "/dashboards" ||
                pathname.startsWith("/dashboards/")
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Gauge className="size-3.5 shrink-0" />
              {t("sidebar.dashboards")}
            </Link>
            <Link
              href="/explore"
              onClick={onClose}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
                pathname === "/explore"
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <SearchCode className="size-3.5 shrink-0" />
              {t("sidebar.explore")}
            </Link>
            <Link
              href="/panel-visualizations"
              onClick={onClose}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
                pathname === "/panel-visualizations"
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Blocks className="size-3.5 shrink-0" />
              {t("sidebar.panel_catalog")}
            </Link>
          </Section>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Layer sections */}
          <ElementsNavSection pathname={pathname} onClose={onClose} t={t} />

          <Section title={t("sidebar.settings")}>
            <Link
              href="/settings"
              onClick={onClose}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
                pathname === "/settings" || pathname.startsWith("/settings/")
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <SettingsIcon className="size-3.5 shrink-0" />
              {t("sidebar.general")}
            </Link>
          </Section>
        </div>
      )}

      {/* Profile — bottom */}
      <div className="border-t border-border px-2 py-2">
        <a
          href="https://archispark.io/docs/"
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
        >
          <CircleHelp className="size-4 shrink-0" />
          Aide
        </a>
        <div className="mt-1 px-1">
          <UserMenu placement="up" display="full" />
        </div>
      </div>
    </>
  )
}
