import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { DashboardDefinition } from "@/lib/dashboards/contracts"
import { DashboardForm } from "./dashboard-form"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/queries/dashboards", () => ({
  useCreateDashboard: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useUpdateDashboard: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}))

vi.mock("@/lib/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const initialDefinition = {
  id: "motivation",
  title: "Motivation",
  description: "Description",
  category: "Système",
  schemaVersion: 2,
  parameters: [],
  panels: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "system",
  updatedBy: "system",
} as unknown as DashboardDefinition

describe("DashboardForm — champs et bouton d'enregistrement selon isSystem", () => {
  it("désactive les champs et masque l'enregistrement quand isSystem=true", () => {
    render(
      <DashboardForm mode="edit" dashboardId="motivation" initialDefinition={initialDefinition} isSystem />
    )
    expect(screen.queryByText("dashboards.form_save_revision")).not.toBeInTheDocument()
    expect(screen.getByText("common.cancel")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Motivation")).toBeDisabled()
    expect(screen.getByDisplayValue("Système")).toBeDisabled()
  })

  it("laisse les champs actifs et affiche l'enregistrement quand isSystem est absent", () => {
    render(
      <DashboardForm mode="edit" dashboardId="autre-dashboard" initialDefinition={{ ...initialDefinition, id: "autre-dashboard" }} />
    )
    expect(screen.getByText("dashboards.form_save_revision")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Motivation")).not.toBeDisabled()
    expect(screen.getByDisplayValue("Système")).not.toBeDisabled()
  })
})
