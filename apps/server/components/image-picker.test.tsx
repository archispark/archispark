import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ImagePicker } from "./image-picker"
import { I18nProvider } from "@/lib/i18n"
import type { ImagePackOut } from "@/lib/api"

const PACKS: ImagePackOut[] = [
  {
    identifier: "pack-system",
    slug: "archimate",
    name: "ArchiMate Notation",
    description: null,
    is_system: true,
    items: [
      {
        identifier: "item-1",
        slug: "business-actor",
        name: "Business Actor",
        archimate_type: "BusinessActor",
        resolved_url: "/api/image-library/items/item-1/svg",
      },
    ],
  },
  {
    identifier: "pack-custom",
    slug: "my-pack",
    name: "My Custom Pack",
    description: null,
    is_system: false,
    items: [
      {
        identifier: "item-2",
        slug: "logo",
        name: "Company Logo",
        archimate_type: null,
        resolved_url: "https://blob.example.test/logo.png",
      },
    ],
  },
]

function renderPicker(value = "") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onChange = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ImagePicker value={value} onChange={onChange} />
      </I18nProvider>
    </QueryClientProvider>
  )
  return { onChange }
}

describe("ImagePicker", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows a placeholder when no image is selected", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PACKS), { status: 200 }))
    )
    renderPicker()
    expect(
      screen.getByRole("button", { name: "Choisir une image" })
    ).toBeInTheDocument()
  })

  it("shows the selected item's name when value matches a pack item", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PACKS), { status: 200 }))
    )
    renderPicker("business-actor")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Business Actor/i })
      ).toBeInTheDocument()
    )
  })

  it("opens the dialog and lists both packs with their items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PACKS), { status: 200 }))
    )
    renderPicker()
    fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }))
    await waitFor(() =>
      expect(screen.getByText("ArchiMate Notation")).toBeInTheDocument()
    )
    expect(screen.getByText("My Custom Pack")).toBeInTheDocument()
    expect(screen.getByTitle("Business Actor")).toBeInTheDocument()
    expect(screen.getByTitle("Company Logo")).toBeInTheDocument()
  })

  it("calls onChange with the item's slug when an item is picked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PACKS), { status: 200 }))
    )
    const { onChange } = renderPicker()
    fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }))
    await waitFor(() =>
      expect(screen.getByTitle("Company Logo")).toBeInTheDocument()
    )
    fireEvent.click(screen.getByTitle("Company Logo"))
    expect(onChange).toHaveBeenCalledWith("logo")
  })

  it("filters items by search text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PACKS), { status: 200 }))
    )
    renderPicker()
    fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }))
    await waitFor(() =>
      expect(screen.getByTitle("Business Actor")).toBeInTheDocument()
    )
    fireEvent.change(screen.getByPlaceholderText("Rechercher une icône…"), {
      target: { value: "logo" },
    })
    expect(screen.queryByTitle("Business Actor")).not.toBeInTheDocument()
    expect(screen.getByTitle("Company Logo")).toBeInTheDocument()
  })
})
