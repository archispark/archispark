import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { ElementHeader } from "./element-detail-header"
import { I18nProvider } from "@/lib/i18n"
import type { ElementOut } from "@/lib/api"

function baseElement(overrides: Partial<ElementOut> = {}): ElementOut {
  return {
    identifier: "el-1",
    name: "My Element",
    type: "Goal",
    documentation: null,
    properties: [],
    ...overrides,
  }
}

function renderHeader(element: ElementOut) {
  return render(
    <I18nProvider>
      <ElementHeader
        element={element}
        isAdmin={true}
        editingType={false}
        setEditingType={() => {}}
        groupedTypes={{}}
        saveField={vi.fn()}
        layer="Motivation"
        layerColor="bg-purple-100"
        isInViews={true}
        onDelete={vi.fn()}
      />
    </I18nProvider>
  )
}

describe("ElementHeader", () => {
  it("falls back to the default ArchiMate type icon when resolved_image_url is absent", () => {
    const { container } = renderHeader(baseElement())
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it("renders the resolved image next to the name", () => {
    const { container } = renderHeader(
      baseElement({
        resolved_image_url: "/api/plugins/aws/icons/aws-lambda",
      })
    )
    const image = container.querySelector("img")
    expect(image).not.toBeNull()
    expect(image?.getAttribute("src")).toBe("/api/plugins/aws/icons/aws-lambda")
  })
})
