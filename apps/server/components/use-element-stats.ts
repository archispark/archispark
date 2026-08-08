import { useMemo } from "react"
import { type ElementOut, type RelationshipOut } from "@/lib/api"
import { getLayer } from "@/lib/archimate-helpers"
import { isRelationshipAllowed } from "@/lib/archimate-rules"

export type ElementStatusFilter = "all" | "ok" | "conflict" | "absent"

/** Per-element relationship ok/conflict counts, filtering, and footer stats — split out of app/elements/page.tsx to stay under max-lines. */
export function useElementStats({
  elements,
  allRelationships,
  byId,
  inViewsSet,
  layerFilter,
  statusFilter,
}: {
  elements: ElementOut[]
  allRelationships: RelationshipOut[]
  byId: Map<string, ElementOut>
  inViewsSet: Set<string>
  layerFilter: string | null
  statusFilter: ElementStatusFilter
}) {
  const relStats = useMemo(() => {
    const map = new Map<string, { ok: number; conflict: number }>()
    for (const rel of allRelationships) {
      const src = byId.get(rel.source)
      const tgt = byId.get(rel.target)
      const ok = isRelationshipAllowed(rel.type, src?.type, tgt?.type)
      for (const id of [rel.source, rel.target]) {
        const entry = map.get(id) ?? { ok: 0, conflict: 0 }
        if (ok) entry.ok += 1
        else entry.conflict += 1
        map.set(id, entry)
      }
    }
    return map
  }, [allRelationships, byId])

  const filteredElements = useMemo(() => {
    let result = layerFilter
      ? elements.filter((el) => getLayer(el.type) === layerFilter)
      : elements
    if (statusFilter !== "all") {
      result = result.filter((el) => {
        const stats = relStats.get(el.identifier)
        const inView = inViewsSet.has(el.identifier)
        if (statusFilter === "conflict") return (stats?.conflict ?? 0) > 0
        if (statusFilter === "absent") return !inView
        return (stats?.conflict ?? 0) === 0 && inView
      })
    }
    return result
  }, [elements, layerFilter, statusFilter, relStats, inViewsSet])

  const elementStats = useMemo(() => {
    let ok = 0,
      conflict = 0,
      absent = 0
    for (const el of filteredElements) {
      const stats = relStats.get(el.identifier)
      const inView = inViewsSet.has(el.identifier)
      if ((stats?.conflict ?? 0) > 0) conflict++
      else if (!inView) absent++
      else ok++
    }
    return { ok, conflict, absent }
  }, [filteredElements, relStats, inViewsSet])

  return { relStats, filteredElements, elementStats }
}
