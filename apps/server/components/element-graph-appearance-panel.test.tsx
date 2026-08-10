import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AppearancePanel } from "./element-graph-appearance-panel"

describe("AppearancePanel", () => {
  it("changes the edge style and graph direction", () => {
    const onChangeEdgePathType = vi.fn()
    const onChangeDirection = vi.fn()
    render(
      <AppearancePanel
        edgePathType="smoothstep"
        onChangeEdgePathType={onChangeEdgePathType}
        direction="TB"
        onChangeDirection={onChangeDirection}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Apparence" }))
    fireEvent.change(screen.getByLabelText("Style des arêtes"), {
      target: { value: "straight" },
    })
    fireEvent.change(screen.getByLabelText("Disposition"), {
      target: { value: "LR" },
    })

    expect(onChangeEdgePathType).toHaveBeenCalledWith("straight")
    expect(onChangeDirection).toHaveBeenCalledWith("LR")
  })
})
