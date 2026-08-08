"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useT } from "@/lib/i18n"

/** Desktop-only button that collapses/expands the sidebar to an icon rail. */
export function CollapseToggle({
  collapsed,
  onToggleCollapse,
  t,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <div className="hidden border-t border-border px-2 py-2 md:block">
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        className={`flex w-full items-center gap-2.5 rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
          collapsed ? "mx-auto size-9 justify-center" : "px-3 py-2"
        }`}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4 shrink-0" />
        ) : (
          <PanelLeftClose className="size-4 shrink-0" />
        )}
        {!collapsed && t("sidebar.collapse")}
      </button>
    </div>
  )
}
