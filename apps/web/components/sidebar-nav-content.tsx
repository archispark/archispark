"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  LayoutGrid,
  Tag,
  Settings as SettingsIcon,
  GitBranch,
} from "lucide-react"
import type { ModelInfo } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { Section } from "@/components/sidebar-section"
import { ElementsNavSection } from "@/components/sidebar-elements-nav"
import { ImportExportControls } from "@/components/sidebar-import-export"

/** Full sidebar nav content (overview, layer sections, settings) — hidden on desktop when collapsed to an icon rail. */
export function SidebarNavContent({
  pathname,
  currentLayer,
  onClose,
  model,
  absentCount,
  layerCounts,
  relConflictCount,
  t,
}: {
  pathname: string
  currentLayer: string | null
  onClose: () => void
  model: ModelInfo | undefined
  absentCount: number
  layerCounts: Record<string, number>
  relConflictCount: number
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <>
      {/* Model info */}
      {model && (
        <div className="border-b border-border px-4 pt-4 pb-3">
          <div className="mb-1 overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap text-foreground">
            {model.name}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {t("sidebar.model_summary", {
              n: model.element_count,
              r: model.relationship_count,
              v: model.view_count,
            })}
          </div>
        </div>
      )}

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

        {/* Layer sections */}
        <ElementsNavSection
          pathname={pathname}
          currentLayer={currentLayer}
          onClose={onClose}
          model={model}
          absentCount={absentCount}
          layerCounts={layerCounts}
          t={t}
        />

        {/* Separator */}
        <div className="mx-4 mt-2 mb-1 border-t border-border" />

        {/* Relations group */}
        <Section title={t("sidebar.relationships")}>
          <Link
            href="/relationships"
            onClick={onClose}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
              pathname === "/relationships"
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <GitBranch className="size-3.5 shrink-0" />
              {t("sidebar.list")}
            </span>
            <span className="flex items-center gap-1">
              {model && (
                <span className="text-[11px] text-muted-foreground">
                  {model.relationship_count}
                </span>
              )}
              {relConflictCount > 0 && (
                <span className="rounded-full bg-destructive/15 px-1 text-[10px] font-bold text-destructive">
                  {relConflictCount}
                </span>
              )}
            </span>
          </Link>
        </Section>

        {/* Separator */}
        <div className="mx-4 mt-2 mb-1 border-t border-border" />

        {/* Vues group */}
        <Section title={t("sidebar.views")}>
          <Link
            href="/views"
            onClick={onClose}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
              pathname === "/views" || pathname.startsWith("/views/")
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <LayoutGrid className="size-3.5 shrink-0" />
              {t("sidebar.list")}
            </span>
            {model && (
              <span className="text-[11px] text-muted-foreground">
                {model.view_count}
              </span>
            )}
          </Link>
        </Section>

        {/* Separator */}
        <div className="mx-4 mt-2 mb-1 border-t border-border" />

        {/* Propriétés group */}
        <Section title={t("sidebar.properties")}>
          <Link
            href="/properties"
            onClick={onClose}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
              pathname === "/properties"
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Tag className="size-3.5 shrink-0" />
              {t("sidebar.list")}
            </span>
            {model && (
              <span className="text-[11px] text-muted-foreground">
                {model.property_definition_count}
              </span>
            )}
          </Link>
        </Section>
      </div>

      {/* Settings — bottom */}
      <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
        <ImportExportControls collapsed={false} onClose={onClose} t={t} />
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
      </div>
    </>
  )
}
