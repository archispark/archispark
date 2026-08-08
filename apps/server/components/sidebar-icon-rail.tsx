"use client"

import {
  LayoutDashboard,
  LayoutGrid,
  Tag,
  Settings as SettingsIcon,
  GitBranch,
  List,
} from "lucide-react"
import { useT } from "@/lib/i18n"
import { RailLink } from "@/components/sidebar-section"
import { ImportExportControls } from "@/components/sidebar-import-export"
import { CollapseToggle } from "@/components/sidebar-collapse-toggle"

/** Icon-only rail shown on desktop when the sidebar is collapsed, plus the collapse/expand toggle. */
export function SidebarIconRail({
  pathname,
  onClose,
  collapsed,
  onToggleCollapse,
  absentCount,
  relConflictCount,
  t,
}: {
  pathname: string
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  absentCount: number
  relConflictCount: number
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <>
      <div
        className={`hidden flex-1 flex-col items-center gap-1 py-3 ${collapsed ? "md:flex" : ""}`}
      >
        <RailLink
          href="/"
          icon={LayoutDashboard}
          label={t("sidebar.overview")}
          active={pathname === "/"}
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
      </div>

      <div
        className={`hidden flex-col items-center gap-1 border-t border-border py-2 ${collapsed ? "md:flex" : ""}`}
      >
        <ImportExportControls collapsed={true} onClose={onClose} t={t} />
        <RailLink
          href="/settings"
          icon={SettingsIcon}
          label={t("sidebar.settings")}
          active={pathname === "/settings" || pathname.startsWith("/settings/")}
          onClick={onClose}
        />
      </div>

      {/* Collapse / expand toggle — desktop only */}
      <CollapseToggle
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        t={t}
      />
    </>
  )
}
