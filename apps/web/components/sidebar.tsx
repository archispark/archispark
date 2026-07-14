"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState, useMemo } from "react"
import { getLayer } from "@/lib/archimate-helpers"
import { allowedRelationships } from "@/lib/archimate-rules"
import {
  useModel,
  useElements,
  useRelationships,
  useElementsInViews,
} from "@/lib/queries"
import { useT } from "@/lib/i18n"
import { SidebarNavContent } from "@/components/sidebar-nav-content"
import { SidebarIconRail } from "@/components/sidebar-icon-rail"

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <Suspense>
      <SidebarInner
        open={open}
        onClose={onClose}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </Suspense>
  )
}

function SidebarInner({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useT()
  // React Query so the sidebar reflects mutations (e.g. a newly created element
  // bumps the counts) as soon as their queries are invalidated.
  const { data: model } = useModel()
  const { data: elements = [] } = useElements()
  const { data: relationships = [] } = useRelationships()
  const { data: inViews = [] } = useElementsInViews()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const byId = useMemo(
    () => new Map(elements.map((e) => [e.identifier, e])),
    [elements]
  )
  const inViewsSet = useMemo(() => new Set(inViews), [inViews])

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const el of elements) {
      const layer = getLayer(el.type)
      counts[layer] = (counts[layer] || 0) + 1
    }
    return counts
  }, [elements])

  const absentCount = useMemo(
    () => elements.filter((e) => !inViewsSet.has(e.identifier)).length,
    [elements, inViewsSet]
  )

  const relConflictCount = useMemo(
    () =>
      relationships.filter((r) => {
        const src = byId.get(r.source)
        const tgt = byId.get(r.target)
        return !allowedRelationships(src?.type, tgt?.type).includes(r.type)
      }).length,
    [relationships, byId]
  )

  const currentLayer =
    pathname === "/elements" ? searchParams.get("layer") : null

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-[var(--nav-h)] bottom-0 left-0 z-40 w-[var(--sidebar-w)] ${collapsed ? "md:w-[var(--sidebar-w-collapsed,56px)]" : ""} flex flex-col overflow-y-auto border-r border-border bg-secondary transition-[width,transform] duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Full content — hidden on desktop when the sidebar is collapsed to an icon rail */}
        <div className={collapsed ? "contents md:hidden" : "contents"}>
          <SidebarNavContent
            pathname={pathname}
            currentLayer={currentLayer}
            onClose={onClose}
            model={model}
            absentCount={absentCount}
            layerCounts={layerCounts}
            relConflictCount={relConflictCount}
            t={t}
          />
        </div>

        <SidebarIconRail
          pathname={pathname}
          onClose={onClose}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          absentCount={absentCount}
          relConflictCount={relConflictCount}
          t={t}
        />
      </aside>
    </>
  )
}
