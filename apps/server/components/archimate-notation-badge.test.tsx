import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ArchimateNotationBadge } from "./archimate-notation-badge"

describe("ArchimateNotationBadge", () => {
  it("renders the ArchiMate component type in a rounded badge", () => {
    const { container, getByText } = render(
      <ArchimateNotationBadge elementType="ApplicationComponent" size={18} />
    )

    expect(getByText("ApplicationComponent")).toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveStyle({
      background: "#0ea5e9",
      borderRadius: "6px",
    })
  })

  it("uses a readable dark label on light layer colors", () => {
    const { getByText } = render(
      <ArchimateNotationBadge elementType="BusinessActor" />
    )

    expect(getByText("BusinessActor")).toHaveStyle({ color: "#111827" })
  })

  it("keeps a visible label when the type is missing", () => {
    const { getByText } = render(<ArchimateNotationBadge />)

    expect(getByText("Unknown")).toBeInTheDocument()
  })
})
