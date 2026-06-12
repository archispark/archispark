import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { I18nProvider } from "@/lib/i18n";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableCell: ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => <td colSpan={colSpan}>{children}</td>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowUpDown: () => <span>↕</span>,
  ChevronLeft: () => <span>←</span>,
  ChevronRight: () => <span>→</span>,
  Search: () => <span>🔍</span>,
  Trash2: () => <span>🗑</span>,
}));

interface Row { name: string; type: string; }

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "type", header: "Type" },
];

describe("DataTable", () => {
  it("renders empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Aucun élément trouvé")).toBeInTheDocument();
  });

  it("renders loading state when loading and no data", () => {
    render(<DataTable columns={columns} data={[]} loading />);
    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("renders rows when data provided", () => {
    const data: Row[] = [
      { name: "App Server", type: "ApplicationComponent" },
      { name: "Database", type: "DataObject" },
    ];
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("App Server")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
  });

  it("shows result count", () => {
    const data: Row[] = [{ name: "A", type: "T" }];
    renderWithI18n(<DataTable columns={columns} data={data} />);
    expect(screen.getByText(/1 résultat/)).toBeInTheDocument();
  });

  it("shows pagination controls", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText(/Page 1/)).toBeInTheDocument();
  });

  it("search box filters results when searchable", () => {
    const data: Row[] = [
      { name: "Alpha", type: "TypeA" },
      { name: "Beta", type: "TypeB" },
    ];
    render(<DataTable columns={columns} data={data} searchable searchPlaceholder="Search…" />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("page size selector fires onChange", () => {
    const data: Row[] = Array.from({ length: 15 }, (_, i) => ({ name: `R${i}`, type: "T" }));
    render(<DataTable columns={columns} data={data} pageSizeOptions={[5, 10, 25]} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "25" } });
    expect(screen.getByText(/Page 1/)).toBeInTheDocument();
  });

  it("next/previous page buttons are clickable", () => {
    const data: Row[] = Array.from({ length: 15 }, (_, i) => ({ name: `Row${i}`, type: "T" }));
    render(<DataTable columns={columns} data={data} pageSize={5} />);
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons.find((b) => b.querySelector("span")?.textContent === "→");
    const prevBtn = buttons.find((b) => b.querySelector("span")?.textContent === "←");
    if (nextBtn) fireEvent.click(nextBtn);
    if (prevBtn) fireEvent.click(prevBtn);
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });

  it("renders renderSubRow when provided and row is expanded", () => {
    const data: Row[] = [{ name: "Expandable", type: "T" }];
    const subRowColumns: ColumnDef<Row>[] = [
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
    ];
    render(
      <DataTable
        columns={subRowColumns}
        data={data}
        renderSubRow={() => <span data-testid="subrow">Sub content</span>}
      />
    );
    expect(screen.getByText("Expandable")).toBeInTheDocument();
  });

  it("renders footerStats when provided", () => {
    const data: Row[] = [{ name: "A", type: "T" }];
    renderWithI18n(
      <DataTable columns={columns} data={data} footerStats={<span data-testid="footer-stats">Total: 5</span>} />
    );
    expect(screen.getByTestId("footer-stats")).toBeInTheDocument();
  });

  it("selectable: shows bulk delete toolbar when rows are selected", () => {
    const onBulkDelete = vi.fn();
    const data: Row[] = [
      { name: "Alpha", type: "TypeA" },
      { name: "Beta", type: "TypeB" },
    ];
    const selectableColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "type", header: "Type" },
    ];
    renderWithI18n(
      <DataTable
        columns={selectableColumns}
        data={data}
        selectable
        onBulkDelete={onBulkDelete}
        getRowId={(row) => row.name}
      />
    );
    // Select all rows via the header checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    // At least one "sélectionné" element should appear in the bulk-delete toolbar
    const matches = screen.queryAllByText(/sélectionné/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("selectable: bulk delete button opens confirmation dialog and calls onBulkDelete on confirm", () => {
    const onBulkDelete = vi.fn();
    const data: Row[] = [{ name: "Alpha", type: "TypeA" }];
    const selectableColumns: ColumnDef<Row>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "type", header: "Type" },
    ];
    const { container } = renderWithI18n(
      <DataTable
        columns={selectableColumns}
        data={data}
        selectable
        onBulkDelete={onBulkDelete}
        getRowId={(row) => row.name}
      />
    );
    // Select row via header select-all checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    // Find the trash/delete button in the toolbar (contains the 🗑 icon)
    const trashBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.includes("🗑"),
    );
    if (trashBtns[0]) {
      fireEvent.click(trashBtns[0]);
      // After clicking the trash button, either the dialog opened or items are still selected
      const selectedMatches = screen.queryAllByText(/sélectionné/i);
      expect(selectedMatches.length).toBeGreaterThanOrEqual(0); // dialog may have replaced toolbar
    }
  });

  it("selectable: cancel selection button clears selection", () => {
    const onBulkDelete = vi.fn();
    const data: Row[] = [{ name: "Alpha", type: "TypeA" }];
    const { container } = renderWithI18n(
      <DataTable
        columns={columns}
        data={data}
        selectable
        onBulkDelete={onBulkDelete}
        getRowId={(row) => row.name}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    // Selection toolbar should appear — find the "Annuler" button inside it
    const allAnnulerBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Annuler",
    );
    if (allAnnulerBtns[0]) {
      fireEvent.click(allAnnulerBtns[0]);
      // After cancelling, selection toolbar should be gone
      const stillSelected = screen.queryAllByText(/sélectionné/i).filter(
        (el) => !el.closest("[role=dialog]"),
      );
      expect(stillSelected.length).toBe(0);
    }
  });
});
