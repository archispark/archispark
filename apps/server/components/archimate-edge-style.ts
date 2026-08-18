export interface ArchimateEdgeStyle {
  strokeDasharray?: string
  markerStart?: string
  markerEnd?: string
}

/** Single ArchiMate relationship notation mapping used by every React Flow. */
export function archimateEdgeStyle(type?: string): ArchimateEdgeStyle {
  switch (type) {
    case "Composition":
      return { markerStart: "url(#archi-diamond-filled)" }
    case "Aggregation":
      return { markerStart: "url(#archi-diamond-open)" }
    case "Assignment":
      return {
        markerStart: "url(#archi-dot-filled)",
        markerEnd: "url(#archi-arrow-open)",
      }
    case "Realization":
      return {
        markerEnd: "url(#archi-triangle-open)",
        strokeDasharray: "6 3",
      }
    case "Serving":
    case "UsedBy":
      return { markerEnd: "url(#archi-arrow-open)" }
    case "Triggering":
      return { markerEnd: "url(#archi-arrow-filled)" }
    case "Flow":
      return {
        markerEnd: "url(#archi-arrow-filled)",
        strokeDasharray: "6 3",
      }
    case "Access":
      return {
        markerEnd: "url(#archi-arrow-open)",
        strokeDasharray: "4 3",
      }
    case "Influence":
      return {
        markerEnd: "url(#archi-arrow-open)",
        strokeDasharray: "6 3",
      }
    case "Specialization":
      return { markerEnd: "url(#archi-triangle-open)" }
    default:
      return {}
  }
}
