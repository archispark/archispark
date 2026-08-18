import { describe, expect, it } from "vitest"
import { archimateEdgeStyle } from "@/components/archimate-edge-style"

describe("archimateEdgeStyle", () => {
  it("uses the ArchiMate realization notation everywhere", () => {
    expect(archimateEdgeStyle("Realization")).toEqual({
      markerEnd: "url(#archi-triangle-open)",
      strokeDasharray: "6 3",
    })
  })

  it("keeps solid relationships solid", () => {
    expect(archimateEdgeStyle("Specialization")).toEqual({
      markerEnd: "url(#archi-triangle-open)",
    })
    expect(archimateEdgeStyle("Association")).toEqual({})
  })
})
