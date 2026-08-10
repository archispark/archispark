import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ReactFlowFullscreenButton,
  useReactFlowFullscreen,
} from "./react-flow-fullscreen"

function FullscreenHarness() {
  const { fullscreen, toggleFullscreen } = useReactFlowFullscreen()
  return (
    <ReactFlowFullscreenButton
      fullscreen={fullscreen}
      onToggle={toggleFullscreen}
    />
  )
}

describe("ReactFlow fullscreen", () => {
  it("toggles fullscreen, locks scrolling, and exits with Escape", () => {
    render(<FullscreenHarness />)

    fireEvent.click(
      screen.getByRole("button", { name: "Agrandir en plein écran" })
    )
    expect(document.body.style.overflow).toBe("hidden")
    expect(
      screen.getByRole("button", { name: "Quitter le plein écran" })
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.body.style.overflow).toBe("")
    expect(
      screen.getByRole("button", { name: "Agrandir en plein écran" })
    ).toBeInTheDocument()
  })
})
