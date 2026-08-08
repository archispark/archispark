import type { Node, Edge } from "@xyflow/react"
import type { useRouter } from "next/navigation"
import type { ElementOut, RelationshipOut } from "@/lib/api"
import { isRelationshipAllowed } from "@/lib/archimate-rules"

// ── Graph builder (BFS with filters) ─────────────────────────────────────────

function createNode(
  id: string,
  label: string,
  elementType: string,
  isCentral: boolean,
  router: ReturnType<typeof useRouter>
): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      label,
      elementType,
      isCentral,
      onClick: isCentral
        ? undefined
        : () => router.push(`/elements/${encodeURIComponent(id)}`),
    },
    type: "archimateNode",
  }
}

// Resolves the relationship's "other end" relative to the current frontier,
// or undefined if `rel` doesn't touch the frontier or the other end is skipped.
function frontierStep(
  rel: RelationshipOut,
  currentFrontier: Set<string>,
  visited: Set<string>,
  hiddenElementTypes: Set<string>,
  byId: Map<string, ElementOut>
): { otherId: string; label: string; elementType: string } | undefined {
  const srcIn = currentFrontier.has(rel.source)
  const tgtIn = currentFrontier.has(rel.target)
  if (!srcIn && !tgtIn) return undefined

  const otherId = srcIn ? rel.target : rel.source
  if (visited.has(otherId)) return undefined

  const other = byId.get(otherId)
  const elementType = other?.type ?? "Grouping"
  if (hiddenElementTypes.has(elementType)) return undefined

  const fallbackName = srcIn ? rel.target_name : rel.source_name
  return { otherId, label: other?.name ?? fallbackName ?? otherId, elementType }
}

// BFS from `element` up to `depth` hops, skipping relationship endpoints whose
// type is hidden, and registering every newly-reached element in `nodeMap`.
function expandFrontier(
  element: ElementOut,
  eligibleRels: RelationshipOut[],
  byId: Map<string, ElementOut>,
  depth: number,
  hiddenElementTypes: Set<string>,
  nodeMap: Map<string, Node>,
  router: ReturnType<typeof useRouter>
): Set<string> {
  const visited = new Set<string>([element.identifier])
  let currentFrontier = new Set<string>([element.identifier])

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>()
    for (const rel of eligibleRels) {
      const step = frontierStep(
        rel,
        currentFrontier,
        visited,
        hiddenElementTypes,
        byId
      )
      if (!step) continue

      visited.add(step.otherId)
      nextFrontier.add(step.otherId)
      if (!nodeMap.has(step.otherId)) {
        nodeMap.set(
          step.otherId,
          createNode(step.otherId, step.label, step.elementType, false, router)
        )
      }
    }
    if (nextFrontier.size === 0) break
    currentFrontier = nextFrontier
  }

  return visited
}

function computeConflictNodeIds(
  visibleRels: RelationshipOut[],
  byId: Map<string, ElementOut>
): Set<string> {
  const conflictNodeIds = new Set<string>()
  for (const r of visibleRels) {
    const src = byId.get(r.source)
    const tgt = byId.get(r.target)
    if (!isRelationshipAllowed(r.type, src?.type, tgt?.type)) {
      conflictNodeIds.add(r.source)
      conflictNodeIds.add(r.target)
    }
  }
  return conflictNodeIds
}

export function buildGraph(
  element: ElementOut,
  allRelationships: RelationshipOut[],
  byId: Map<string, ElementOut>,
  depth: number,
  hiddenElementTypes: Set<string>,
  hiddenRelTypes: Set<string>,
  showIndirect: boolean,
  router: ReturnType<typeof useRouter>
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>()

  // Central element is always shown regardless of filters
  nodeMap.set(
    element.identifier,
    createNode(element.identifier, element.name, element.type, true, router)
  )

  const eligibleRels = allRelationships.filter(
    (r) => !hiddenRelTypes.has(r.type)
  )
  const visited = expandFrontier(
    element,
    eligibleRels,
    byId,
    depth,
    hiddenElementTypes,
    nodeMap,
    router
  )

  const allVisibleRels = eligibleRels.filter(
    (r) => visited.has(r.source) && visited.has(r.target)
  )
  const visibleRels = showIndirect
    ? allVisibleRels
    : allVisibleRels.filter(
        (r) =>
          r.source === element.identifier || r.target === element.identifier
      )

  const conflictNodeIds = computeConflictNodeIds(visibleRels, byId)
  for (const [id, node] of nodeMap) {
    node.data = { ...node.data, hasConflict: conflictNodeIds.has(id) }
  }

  const edges: Edge[] = visibleRels.map((r) => ({
    id: r.identifier,
    source: r.source,
    target: r.target,
    type: "archiEdge",
    label: r.name ? `${r.type} · ${r.name}` : r.type,
    data: { relationshipType: r.type },
  }))

  return { nodes: Array.from(nodeMap.values()), edges }
}

// ── Compute available types (unfiltered BFS) ──────────────────────────────────

// BFS over every relationship (no filters), returning the set of reached element ids.
function computeVisitedIds(
  element: ElementOut,
  allRelationships: RelationshipOut[],
  depth: number
): Set<string> {
  const visited = new Set<string>([element.identifier])
  let currentFrontier = new Set<string>([element.identifier])

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>()
    for (const rel of allRelationships) {
      const srcIn = currentFrontier.has(rel.source)
      const tgtIn = currentFrontier.has(rel.target)
      if (!srcIn && !tgtIn) continue
      const otherId = srcIn ? rel.target : rel.source
      if (!visited.has(otherId)) {
        visited.add(otherId)
        nextFrontier.add(otherId)
      }
    }
    if (nextFrontier.size === 0) break
    currentFrontier = nextFrontier
  }

  return visited
}

export function getReachableTypes(
  element: ElementOut,
  allRelationships: RelationshipOut[],
  byId: Map<string, ElementOut>,
  depth: number
): { elementTypes: string[]; relTypes: string[] } {
  const visited = computeVisitedIds(element, allRelationships, depth)

  const elementTypes = new Set<string>()
  for (const id of visited) {
    const el = id === element.identifier ? element : byId.get(id)
    if (el) elementTypes.add(el.type)
  }

  const relTypes = new Set<string>()
  for (const rel of allRelationships) {
    if (visited.has(rel.source) && visited.has(rel.target))
      relTypes.add(rel.type)
  }

  return {
    elementTypes: [...elementTypes].sort((a, b) => a.localeCompare(b)),
    relTypes: [...relTypes].sort((a, b) => a.localeCompare(b)),
  }
}
