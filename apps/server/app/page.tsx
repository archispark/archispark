"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  FolderOpen,
  Gauge,
  Settings as SettingsIcon,
  Building2,
} from "lucide-react"
import { useT } from "@/lib/i18n"
import { useOrganizations } from "@/lib/queries"

const quickLinks = [
  { href: "/overview", labelKey: "sidebar.overview", icon: LayoutDashboard },
  { href: "/workspaces", labelKey: "breadcrumb.workspaces", icon: FolderOpen },
  { href: "/dashboards", labelKey: "sidebar.dashboards", icon: Gauge },
  { href: "/settings", labelKey: "sidebar.general", icon: SettingsIcon },
] as const

export default function HomePage() {
  const { t } = useT()
  const { data: organizations = [], isLoading } = useOrganizations()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
        {t("common.loading")}
      </div>
    )
  }

  if (organizations.length === 0) {
    return (
      <div className="max-w-2xl p-7">
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">
            {t("home.no_org_title")}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("home.no_org_desc")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl p-7">
      <h1 className="text-lg font-semibold">{t("home.welcome_title")}</h1>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {t("home.welcome_desc")}
      </p>

      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {quickLinks.map(({ href, labelKey, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-foreground no-underline transition-colors hover:border-primary/50"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            {t(labelKey)}
          </Link>
        ))}
      </div>
    </div>
  )
}
