import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ArchimateLayerBadge } from "./archimate-layer-badge"

describe("ArchimateLayerBadge", () => {
  it("renders the icon associated with the ArchiMate layer", () => {
    const { container } = render(<ArchimateLayerBadge layer="Technology" />)

    expect(container.querySelector(".lucide-server")).toBeInTheDocument()
  })

  it("uses the generic icon for an unknown layer", () => {
    const { container } = render(<ArchimateLayerBadge layer="Unknown" />)

    expect(container.querySelector(".lucide-box")).toBeInTheDocument()
  })
})
