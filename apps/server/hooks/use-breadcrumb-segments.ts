"use client"

import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { type ElementOut } from "@/lib/api"
import {
  useOrganizations,
  useElement,
  useView,
  usePlatformUser,
  usePlatformOrganization,
} from "@/lib/queries"
import { useDashboard } from "@/lib/queries/dashboards"
import { useT } from "@/lib/i18n"

/**
 * Path segments for the header breadcrumb, plus a resolver that swaps id
 * segments (element, view, dashboard, organization, platform user/org) for
 * their display name — falls back to the raw id for unrecognized segments.
 */
export function useBreadcrumbSegments() {
  const pathname = usePathname()!
  const { t } = useT()
  const { data: organizations = [] } = useOrganizations()
  const qc = useQueryClient()
  const segments = pathname.split("/").filter(Boolean)

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
  const orgId =
    segments[0] === "organizations" && segments.length === 2
      ? decodeURIComponent(segments[1]!)
      : ""
  const platformUserId =
    segments[0] === "platform" &&
    segments[1] === "users" &&
    segments.length === 3
      ? decodeURIComponent(segments[2]!)
      : ""
  const { data: breadcrumbPlatformUser } = usePlatformUser(platformUserId)
  const platformOrgId =
    segments[0] === "platform" &&
    segments[1] === "organizations" &&
    segments.length === 3
      ? decodeURIComponent(segments[2]!)
      : ""
  const { data: breadcrumbPlatformOrg } = usePlatformOrganization(platformOrgId)

  function segmentLabel(segment: string, index: number): string {
    const keys: Record<string, Parameters<typeof t>[0]> = {
      elements: "breadcrumb.elements",
      relationships: "breadcrumb.relationships",
      views: "breadcrumb.views",
      validator: "breadcrumb.validator",
      properties: "breadcrumb.properties",
      users: "breadcrumb.users",
      plugins: "platform.plugins.title",
      settings: "breadcrumb.settings",
      workspaces: "breadcrumb.workspaces",
      overview: "sidebar.overview",
      dashboards: "sidebar.dashboards",
      explore: "sidebar.explore",
      "panel-visualizations": "sidebar.panel_catalog",
      organizations: "breadcrumb.organizations",
      platform: "platform.sidebar_badge",
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
    if (id === orgId && segments[index - 1] === "organizations") {
      return organizations.find((o) => o.id === id)?.name ?? "…"
    }
    if (id === platformUserId && segments[index - 1] === "users") {
      const name =
        (breadcrumbPlatformUser?.id === id
          ? breadcrumbPlatformUser.username
          : undefined) ??
        qc.getQueryData<{ username?: string }>(["platformUser", id])?.username
      return name ?? "…"
    }
    if (id === platformOrgId && segments[index - 1] === "organizations") {
      const name =
        (breadcrumbPlatformOrg?.id === id
          ? breadcrumbPlatformOrg.name
          : undefined) ??
        qc.getQueryData<{ name?: string }>(["platformOrganization", id])?.name
      return name ?? "…"
    }
    return id
  }

  return { segments, segmentLabel }
}
