import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OrganizationsPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { AdminOrganizationOut } from "@/lib/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAdminOrgs: { current: AdminOrganizationOut[]; isLoading: boolean } = { current: [], isLoading: false };
const setEnabledMutateAsync = vi.fn();
const createOrgMutateAsync = vi.fn();
const verifyDbMutateAsync = vi.fn();
const reprovisionMutateAsync = vi.fn();

vi.mock("@/lib/queries", () => ({
  useAdminOrganizations: () => ({ data: mockAdminOrgs.current, isLoading: mockAdminOrgs.isLoading }),
  useSetOrganizationEnabled: () => ({ mutateAsync: setEnabledMutateAsync, isPending: false }),
  useNeonStatus: () => ({ data: { configured: true, reachable: true } }),
  useCreateAdminOrganization: () => ({ mutateAsync: createOrgMutateAsync, isPending: false }),
  useVerifyOrganizationDb: () => ({ mutateAsync: verifyDbMutateAsync, isPending: false }),
  useReprovisionOrganization: () => ({ mutateAsync: reprovisionMutateAsync, isPending: false }),
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

const baseOrg: AdminOrganizationOut = {
  id: "org1",
  name: "Acme",
  slug: "acme",
  enabled: true,
  created_at: new Date().toISOString(),
  tenant_status: "active",
  last_error: null,
};

beforeEach(() => {
  mockAdminOrgs.current = [];
  mockAdminOrgs.isLoading = false;
  setEnabledMutateAsync.mockReset();
  createOrgMutateAsync.mockReset();
  verifyDbMutateAsync.mockReset();
  reprovisionMutateAsync.mockReset();
});

describe("OrganizationsPage", () => {
  it("renders the organizations table with status badges", () => {
    mockAdminOrgs.current = [baseOrg];
    renderPage();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("Dédiée")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("opens the create dialog and auto-fills the slug from the name", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    const nameInput = screen.getByLabelText(/^Nom \*/);
    fireEvent.change(nameInput, { target: { value: "My Org" } });

    const slugInput = screen.getByLabelText(/^Identifiant|^Slug/) as HTMLInputElement;
    expect(slugInput.value).toBe("my-org");
  });

  it("submits the create form and calls createAdminOrganization.mutateAsync", async () => {
    createOrgMutateAsync.mockResolvedValue({ ...baseOrg, id: "org-new" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    const nameInput = screen.getByLabelText(/^Nom \*/);
    fireEvent.change(nameInput, { target: { value: "New Org" } });

    const dialog = screen.getByRole("dialog");
    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Créer|Create/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(createOrgMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Org", slug: "new-org" }),
    ));
  });

  it("opens the suspend confirmation dialog and calls setOrganizationEnabled", async () => {
    setEnabledMutateAsync.mockResolvedValue({ ...baseOrg, enabled: false });
    mockAdminOrgs.current = [baseOrg];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Suspendre" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Suspendre l'organisation ?");

    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Suspendre")!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(setEnabledMutateAsync).toHaveBeenCalledWith({ id: "org1", enabled: false }));
  });

  it("activates a suspended organization without a confirmation dialog", async () => {
    setEnabledMutateAsync.mockResolvedValue({ ...baseOrg, enabled: true });
    mockAdminOrgs.current = [{ ...baseOrg, enabled: false, tenant_status: null }];
    renderPage();

    expect(screen.getByText("Suspendue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réactiver" }));

    await waitFor(() => expect(setEnabledMutateAsync).toHaveBeenCalledWith({ id: "org1", enabled: true }));
  });

  it("shows reprovision button for orgs in error state", () => {
    mockAdminOrgs.current = [{ ...baseOrg, tenant_status: "error", last_error: "connection refused" }];
    renderPage();
    expect(screen.getByRole("button", { name: /Reprovisionner|Reprovision/i })).toBeInTheDocument();
  });

  it("calls reprovisionOrganization when reprovision button clicked", async () => {
    reprovisionMutateAsync.mockResolvedValue({ ...baseOrg, tenant_status: "active" });
    mockAdminOrgs.current = [{ ...baseOrg, tenant_status: "error", last_error: "timeout" }];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Reprovisionner|Reprovision/i }));

    await waitFor(() => expect(reprovisionMutateAsync).toHaveBeenCalledWith("org1"));
  });
});
