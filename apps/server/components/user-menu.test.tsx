import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { UserMenu } from "./user-menu"

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    username: "alex",
    name: "Alex Martin",
    email: "alex@example.com",
    role: "member",
  }),
}))

vi.mock("@/lib/queries", () => ({
  useOrganizations: () => ({ data: [] }),
}))

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

describe("UserMenu", () => {
  it("opens a collapsed-sidebar menu toward the page content", () => {
    render(<UserMenu placement="up" align="left" />)

    fireEvent.click(screen.getByRole("button", { name: "Mon compte" }))

    expect(screen.getByText("Mon profil").parentElement).toHaveClass("left-0")
    expect(screen.getByText("Mon profil").parentElement).toHaveClass(
      "bottom-full"
    )
  })
})
