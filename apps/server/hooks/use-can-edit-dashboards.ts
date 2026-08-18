"use client"

import { useOrganizations } from "@/lib/queries/organizations"

/** Dashboards are org-scoped: only the active organization's owner/admin can create, edit, or delete them — members get read-only. */
export function useCanEditDashboards(): boolean {
  const { data: organizations } = useOrganizations()
  const active = organizations?.find((org) => org.active)
  return active?.role === "owner" || active?.role === "editor"
}
