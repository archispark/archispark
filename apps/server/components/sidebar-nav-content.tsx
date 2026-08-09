"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  Gauge,
  SearchCode,
  Blocks,
} from "lucide-react"
import { useT } from "@/lib/i18n"
import { useWorkspaces } from "@/lib/queries"
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
  const activeWorkspace = workspaces.find((workspace) => workspace.active)

  return (
    <>
      <div className="border-b border-border px-4 pt-4 pb-3">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Overview */}
        <Link
          href="/"
          onClick={onClose}
          className={`mx-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm no-underline transition-colors ${
            pathname === "/"
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
              pathname === "/dashboards" || pathname.startsWith("/dashboards/")
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
      </div>

      {/* Settings — bottom */}
      <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm no-underline transition-colors ${
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-card font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <SettingsIcon className="size-4 shrink-0" />
          {t("sidebar.settings")}
        </Link>
        <div className="px-1 pt-1">
          <UserMenu placement="up" display="full" />
        </div>
      </div>
    </>
  )
}
