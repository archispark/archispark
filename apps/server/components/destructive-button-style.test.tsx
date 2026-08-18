import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

describe("destructive Button", () => {
  it("uses the destructive background with white text and icons", () => {
    render(
      <Button variant="destructive">
        <Trash2 />
        Supprimer
      </Button>
    )

    const button = screen.getByRole("button", { name: "Supprimer" })
    expect(button).toHaveClass("bg-destructive", "text-white")
    expect(button.querySelector("svg")).not.toHaveClass("text-destructive")
  })
})
