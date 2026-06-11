import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OrganizationsPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { OrganizationListItem } from "@/hooks/use-organization";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrgs: { current: OrganizationListItem[] } = { current: [] };
const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();

vi.mock("@/hooks/use-organization", () => ({
  useOrganizations: () => mockOrgs.current,
  useCreateOrganization: () => ({ mutateAsync: createMutateAsync }),
  useUpdateOrganization: () => ({ mutateAsync: updateMutateAsync }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@workspace/ui/components/dialog", () => {
  const DialogOpenContext = createContext(false);

  const Dialog = ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <DialogOpenContext.Provider value={!!open}>{children}</DialogOpenContext.Provider>
  );

  const DialogTrigger = ({ children, render: r, onClick }: { children: React.ReactNode; render?: React.ReactElement; onClick?: () => void }) => {
    if (r) {
      return (
        <button type="button" onClick={() => { onClick?.(); (r.props as { onClick?: () => void }).onClick?.(); }}>
          {children}
        </button>
      );
    }
    return <button type="button" onClick={onClick}>{children}</button>;
  };

  const DialogContent = ({ children }: { children: React.ReactNode }) => {
    const open = useContext(DialogOpenContext);
    return open ? <div role="dialog">{children}</div> : null;
  };

  return {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogClose: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <OrganizationsPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  mockOrgs.current = [];
  createMutateAsync.mockReset();
  updateMutateAsync.mockReset();
});

describe("OrganizationsPage", () => {
  it("renders the list of organizations", () => {
    mockOrgs.current = [
      { id: "org1", name: "Acme", slug: "acme", createdAt: new Date(), metadata: { description: "An org" } },
    ];
    renderPage();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("An org")).toBeInTheDocument();
  });

  it("opens the create dialog and auto-fills the slug from the name", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    const nameInput = screen.getByLabelText(/^Nom \*/);
    fireEvent.change(nameInput, { target: { value: "My Org" } });

    const slugInput = screen.getByLabelText(/^Identifiant|^Slug/) as HTMLInputElement;
    expect(slugInput.value).toBe("my-org");
  });

  it("submits the create form and calls createOrganization.mutateAsync", async () => {
    createMutateAsync.mockResolvedValue({ id: "org-new" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    const nameInput = screen.getByLabelText(/^Nom \*/);
    fireEvent.change(nameInput, { target: { value: "New Org" } });

    const dialog = screen.getByRole("dialog");
    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Créer|Create/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Org", slug: "new-org" }),
    ));
  });

  it("opens the edit dialog for an organization and submits the update", async () => {
    updateMutateAsync.mockResolvedValue({ id: "org1" });
    mockOrgs.current = [
      { id: "org1", name: "Acme", slug: "acme", createdAt: new Date(), metadata: { description: "Desc" } },
    ];
    renderPage();

    const editButtons = screen.getAllByRole("button", { name: /Modifier|Edit/i });
    fireEvent.click(editButtons[0]!);

    const dialog = screen.getByRole("dialog");
    const nameInput = screen.getByLabelText(/^Nom \*/) as HTMLInputElement;
    expect(nameInput.value).toBe("Acme");

    fireEvent.change(nameInput, { target: { value: "Acme Renamed" } });

    const saveBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Enregistrer|Save/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org1", name: "Acme Renamed" }),
    ));
  });
});
