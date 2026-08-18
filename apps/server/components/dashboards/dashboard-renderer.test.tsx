import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { DashboardDefinition } from "@/lib/dashboards/contracts"
import { DashboardRenderer } from "./dashboard-renderer"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/queries/dashboards", () => ({
  usePanelResult: () => ({ data: undefined, error: undefined }),
  useDeleteDashboard: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}))

vi.mock("@/lib/queries/elements", () => ({
  useElements: () => ({ data: [] }),
}))

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const dashboard = {
  id: "sample",
  title: "Dashboard d'exemple",
  description: "Description",
  category: "Tests",
  schemaVersion: 2,
  parameters: [],
  panels: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "test",
  updatedBy: "test",
} as unknown as DashboardDefinition

function renderRenderer(canEdit: boolean, isSystem: boolean) {
  return render(
    <DashboardRenderer
      dashboardId="sample"
      dashboard={dashboard}
      initialParameters={{}}
      canEdit={canEdit}
      isSystem={isSystem}
    />
  )
}

describe("DashboardRenderer — actions selon canEdit/isSystem", () => {
  it("affiche Modifier/Supprimer quand canEdit=true et isSystem=false", () => {
    renderRenderer(true, false)
    expect(screen.queryByText("common.edit")).toBeInTheDocument()
    expect(screen.queryByText("common.delete")).toBeInTheDocument()
  })

  it("masque Modifier/Supprimer quand canEdit=true et isSystem=true", () => {
    renderRenderer(true, true)
    expect(screen.queryByText("common.edit")).not.toBeInTheDocument()
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument()
  })

  it("masque Modifier/Supprimer quand canEdit=false et isSystem=false", () => {
    renderRenderer(false, false)
    expect(screen.queryByText("common.edit")).not.toBeInTheDocument()
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument()
  })

  it("masque Modifier/Supprimer quand canEdit=false et isSystem=true", () => {
    renderRenderer(false, true)
    expect(screen.queryByText("common.edit")).not.toBeInTheDocument()
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument()
  })
})
