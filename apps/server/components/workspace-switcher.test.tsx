import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { WorkspaceInfo } from "@/lib/api"
import { WorkspaceSwitcher } from "./workspace-switcher"

const { mockPush, mockMutateAsync } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockMutateAsync: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("@/lib/queries", () => ({
  useActivateWorkspace: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}))

const activeWorkspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Architecture actuelle",
  active: true,
  organization_id: "org-1",
  created_by_id: "user-1",
}

const otherWorkspace: WorkspaceInfo = {
  ...activeWorkspace,
  id: "workspace-2",
  name: "Architecture cible",
  active: false,
}

describe("WorkspaceSwitcher", () => {
  it("offers a link to add a workspace", () => {
    render(
      <WorkspaceSwitcher
        workspaces={[activeWorkspace]}
        activeWorkspace={activeWorkspace}
      />
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Changer de workspace — Architecture actuelle",
      })
    )

    expect(
      screen.getByRole("menuitem", { name: "Ajouter un workspace" })
    ).toHaveAttribute("href", "/workspaces")
  })

  it("activates the selected workspace then opens its overview", async () => {
    mockMutateAsync.mockResolvedValue(otherWorkspace)

    render(
      <WorkspaceSwitcher
        workspaces={[activeWorkspace, otherWorkspace]}
        activeWorkspace={activeWorkspace}
      />
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Changer de workspace — Architecture actuelle",
      })
    )
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Architecture cible" })
    )

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith("workspace-2")
      expect(mockPush).toHaveBeenCalledWith("/")
    })
  })
})
