import { render, screen } from "@testing-library/react"
import { vi, describe, expect, it } from "vitest"
import OrganizationsPage from "./page"

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("@/lib/queries", () => ({
  useOrganizations: () => ({
    data: [
      {
        id: "1",
        slug: "archi",
        name: "Archi",
        is_personal: false,
        enabled: true,
        role: "owner",
        active: true,
      },
    ],
    isLoading: false,
  }),
  useRenameOrganization: () => ({ mutateAsync: vi.fn() }),
  useActivateOrganization: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe("OrganizationsPage", () => {
  it("does not expose organization creation or deletion to an owner", () => {
    render(<OrganizationsPage />)

    expect(
      screen.queryByRole("button", { name: "settings.org.org_new_btn" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "common.delete" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "common.edit" })
    ).toBeInTheDocument()
  })
})
