import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ImagePicker } from "./image-picker"
import { I18nProvider } from "@/lib/i18n"
import type { PluginOut } from "@/lib/api"

const PLUGINS: PluginOut[] = [
  {
    slug: "archimate",
    name: "ArchiMate Notation",
    description: null,
    icons: [
      {
        slug: "business-actor",
        name: "Business Actor",
        url: "/api/plugins/archimate/icons/business-actor",
      },
    ],
  },
  {
    slug: "my-plugin",
    name: "My Custom Plugin",
    description: null,
    icons: [
      {
        slug: "logo",
        name: "Company Logo",
        url: "/api/plugins/my-plugin/icons/logo",
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
      vi.fn(async () => new Response(JSON.stringify(PLUGINS), { status: 200 }))
    )
    renderPicker()
    expect(
      screen.getByRole("button", { name: "Choisir une image" })
    ).toBeInTheDocument()
  })

  it("shows the selected icon's name when value matches a plugin icon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PLUGINS), { status: 200 }))
    )
    renderPicker("business-actor")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Business Actor/i })
      ).toBeInTheDocument()
    )
  })

  it("opens the dialog and lists both plugins with their icons", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PLUGINS), { status: 200 }))
    )
    renderPicker()
    fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }))
    await waitFor(() =>
      expect(screen.getByText("ArchiMate Notation")).toBeInTheDocument()
    )
    expect(screen.getByText("My Custom Plugin")).toBeInTheDocument()
    expect(screen.getByTitle("Business Actor")).toBeInTheDocument()
    expect(screen.getByTitle("Company Logo")).toBeInTheDocument()
  })

  it("calls onChange with the icon's slug when an icon is picked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PLUGINS), { status: 200 }))
    )
    const { onChange } = renderPicker()
    fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }))
    await waitFor(() =>
      expect(screen.getByTitle("Company Logo")).toBeInTheDocument()
    )
    fireEvent.click(screen.getByTitle("Company Logo"))
    expect(onChange).toHaveBeenCalledWith("logo")
  })

  it("filters icons by search text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(PLUGINS), { status: 200 }))
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
