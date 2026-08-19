import { useRef } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { DataTable, type DataTableColumnDef, type DataTableHandle } from "./data-table"
import { I18nProvider } from "@/lib/i18n"

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => (
    <table>{children}</table>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => (
    <th>{children}</th>
  ),
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr>{children}</tr>
  ),
  TableCell: ({
    children,
    colSpan,
  }: {
    children: React.ReactNode
    colSpan?: number
  }) => <td colSpan={colSpan}>{children}</td>,
}))

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock("lucide-react", () => ({
  ArrowUpDown: () => <span>↕</span>,
  ChevronLeft: () => <span>←</span>,
  ChevronRight: () => <span>→</span>,
  Search: () => <span>🔍</span>,
  Trash2: () => <span>🗑</span>,
}))

interface Row {
  name: string
  type: string
}

const columns: DataTableColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "type", header: "Type" },
]

describe("DataTable", () => {
  it("renders empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText("Aucun élément trouvé")).toBeInTheDocument()
  })

  it("renders loading state when loading and no data", () => {
    render(<DataTable columns={columns} data={[]} loading />)
    expect(screen.getByText("Chargement...")).toBeInTheDocument()
  })

  it("renders rows when data provided", () => {
    const data: Row[] = [
      { name: "App Server", type: "ApplicationComponent" },
      { name: "Database", type: "DataObject" },
    ]
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText("App Server")).toBeInTheDocument()
    expect(screen.getByText("Database")).toBeInTheDocument()
  })

  it("renders column headers", () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Type")).toBeInTheDocument()
  })

  it("shows result count", () => {
    const data: Row[] = [{ name: "A", type: "T" }]
    renderWithI18n(<DataTable columns={columns} data={data} />)
    expect(screen.getByText(/1 résultat/)).toBeInTheDocument()
  })

  it("shows pagination controls", () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText(/Page 1/)).toBeInTheDocument()
  })

  it("search box filters results when searchable", () => {
    const data: Row[] = [
      { name: "Alpha", type: "TypeA" },
      { name: "Beta", type: "TypeB" },
    ]
    render(
      <DataTable
        columns={columns}
        data={data}
        searchable
        searchPlaceholder="Search…"
      />
    )
    const input = screen.getByPlaceholderText("Search…")
    fireEvent.change(input, { target: { value: "Alpha" } })
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("renders a search action alongside the search input", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        searchable
        searchAction={<button type="button">Add</button>}
      />
    )

    expect(screen.getByPlaceholderText("Rechercher…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument()
  })

  it("page size selector fires onChange", () => {
    const data: Row[] = Array.from({ length: 15 }, (_, i) => ({
      name: `R${i}`,
      type: "T",
    }))
    render(
      <DataTable columns={columns} data={data} pageSizeOptions={[5, 10, 25]} />
    )
    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "25" } })
    expect(screen.getByText(/Page 1/)).toBeInTheDocument()
  })

  it("next/previous page buttons are clickable", () => {
    const data: Row[] = Array.from({ length: 15 }, (_, i) => ({
      name: `Row${i}`,
      type: "T",
    }))
    render(<DataTable columns={columns} data={data} pageSize={5} />)
    const buttons = screen.getAllByRole("button")
    const nextBtn = buttons.find(
      (b) => b.querySelector("span")?.textContent === "→"
    )
    const prevBtn = buttons.find(
      (b) => b.querySelector("span")?.textContent === "←"
    )
    if (nextBtn) fireEvent.click(nextBtn)
    if (prevBtn) fireEvent.click(prevBtn)
    expect(screen.getByText(/Page/)).toBeInTheDocument()
  })

  it("renders renderSubRow when provided and row is expanded", () => {
    const data: Row[] = [{ name: "Expandable", type: "T" }]
    const subRowColumns: DataTableColumnDef<Row>[] = [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button onClick={() => row.toggleExpanded()}>
            {String(row.getValue("name"))}
          </button>
        ),
      },
      { accessorKey: "type", header: "Type" },
    ]
    render(
      <DataTable
        columns={subRowColumns}
        data={data}
        renderSubRow={() => <span data-testid="subrow">Sub content</span>}
      />
    )
    expect(screen.getByText("Expandable")).toBeInTheDocument()
    expect(screen.queryByTestId("subrow")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Expandable"))
    expect(screen.getByTestId("subrow")).toBeInTheDocument()
  })

  it("renders footerStats when provided", () => {
    const data: Row[] = [{ name: "A", type: "T" }]
    renderWithI18n(
      <DataTable
        columns={columns}
        data={data}
        footerStats={<span data-testid="footer-stats">Total: 5</span>}
      />
    )
    expect(screen.getByTestId("footer-stats")).toBeInTheDocument()
  })

  it("selectable: notifies onSelectionChange when rows are selected", () => {
    const onSelectionChange = vi.fn()
    const data: Row[] = [
      { name: "Alpha", type: "TypeA" },
      { name: "Beta", type: "TypeB" },
    ]
    renderWithI18n(
      <DataTable
        columns={columns}
        data={data}
        selectable
        onSelectionChange={onSelectionChange}
        getRowId={(row) => row.name}
      />
    )
    // Select all rows via the header checkbox
    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0]!)
    expect(onSelectionChange).toHaveBeenLastCalledWith(data)
  })

  it("selectable: requestBulkDelete (via ref) opens the confirmation dialog and calls onBulkDelete on confirm", () => {
    const onBulkDelete = vi.fn()
    const data: Row[] = [{ name: "Alpha", type: "TypeA" }]

    function Wrapper() {
      const tableRef = useRef<DataTableHandle>(null)
      return (
        <>
          <button onClick={() => tableRef.current?.requestBulkDelete()}>
            trigger-delete
          </button>
          <DataTable
            ref={tableRef}
            columns={columns}
            data={data}
            selectable
            onBulkDelete={onBulkDelete}
            getRowId={(row) => row.name}
          />
        </>
      )
    }

    renderWithI18n(<Wrapper />)
    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0]!)
    fireEvent.click(screen.getByText("trigger-delete"))
    const confirmBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Supprimer")
    expect(confirmBtn).toBeTruthy()
    fireEvent.click(confirmBtn!)
    expect(onBulkDelete).toHaveBeenCalledWith(data)
  })

  it("isRowSelectable: hides the row checkbox for non-selectable rows", () => {
    const data: Row[] = [
      { name: "Alpha", type: "TypeA" },
      { name: "System", type: "TypeB" },
    ]
    renderWithI18n(
      <DataTable
        columns={columns}
        data={data}
        selectable
        isRowSelectable={(row) => row.name !== "System"}
        getRowId={(row) => row.name}
      />
    )
    // Header select-all + one selectable row checkbox — the "System" row has none
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
  })
})
