import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import OrganizationsPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { AdminOrganizationOut, UserOut } from "@/lib/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAdminOrgs: { current: AdminOrganizationOut[]; isLoading: boolean } = { current: [], isLoading: false };
const mockUsers: { current: UserOut[] } = { current: [] };
const setEnabledMutateAsync = vi.fn();
const createOrgMutateAsync = vi.fn();
const verifyDbMutateAsync = vi.fn();
const reprovisionMutateAsync = vi.fn();

vi.mock("@/lib/queries", () => ({
  useAdminOrganizations: () => ({ data: mockAdminOrgs.current, isLoading: mockAdminOrgs.isLoading }),
  useUsers: () => ({ data: mockUsers.current }),
  useSetOrganizationEnabled: () => ({ mutateAsync: setEnabledMutateAsync, isPending: false }),
  useNeonStatus: () => ({ data: { configured: true, reachable: true } }),
  useCreateAdminOrganization: () => ({ mutateAsync: createOrgMutateAsync, isPending: false }),
  useVerifyOrganizationDb: () => ({ mutateAsync: verifyDbMutateAsync, isPending: false }),
  useReprovisionOrganization: () => ({ mutateAsync: reprovisionMutateAsync, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
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

vi.mock("@workspace/ui/components/select", () => {
  const SelectContext = createContext<{ value?: string; onValueChange?: (v: string) => void }>({});

  const Select = ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string | null) => void }) => (
    <SelectContext.Provider value={{ value, onValueChange: (v) => onValueChange?.(v) }}>
      <div>{children}</div>
    </SelectContext.Provider>
  );

  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = () => {
    const { value } = useContext(SelectContext);
    return <span>{value}</span>;
  };
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  };

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
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
  mockUsers.current = [];
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

  it("shows an error message in the create dialog when creation fails", async () => {
    createOrgMutateAsync.mockRejectedValue(new Error("Le slug 'new-org' est déjà utilisé."));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: "New Org" } });

    const dialog = screen.getByRole("dialog");
    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Créer|Create/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(screen.getByText("Le slug 'new-org' est déjà utilisé.")).toBeInTheDocument());
    // Dialog stays open so the admin can correct the slug and retry.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("creates with a generated owner account and shows the credentials once", async () => {
    createOrgMutateAsync.mockResolvedValue({
      ...baseOrg, id: "org-new",
      initial_owner: { username: "admin-new-org", password: "Sup3rSecret" },
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: "New Org" } });

    const dialog = screen.getByRole("dialog");
    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Créer|Create/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(createOrgMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Org", slug: "new-org", initial_owner_user_id: undefined }),
    ));

    const credentialsDialog = await screen.findByRole("dialog");
    expect(credentialsDialog).toHaveTextContent(/Propriétaire de l'organisation créé|Organization owner created/);
    expect(screen.getByDisplayValue("admin-new-org")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sup3rSecret")).toBeInTheDocument();
  });

  it("copies the generated password to the clipboard", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    createOrgMutateAsync.mockResolvedValue({
      ...baseOrg, id: "org-new",
      initial_owner: { username: "admin-new-org", password: "Sup3rSecret" },
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));
    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: "New Org" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => /Créer|Create/.test(b.textContent ?? ""))!);

    const passwordInput = await screen.findByDisplayValue("Sup3rSecret");
    const copyBtn = passwordInput.parentElement!.querySelector("button")!;
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("Sup3rSecret");
  });

  it("copies the generated username to the clipboard and closes the credentials dialog", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    createOrgMutateAsync.mockResolvedValue({
      ...baseOrg, id: "org-new",
      initial_owner: { username: "admin-new-org", password: "Sup3rSecret" },
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));
    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: "New Org" } });
    const createDialog = screen.getByRole("dialog");
    fireEvent.click(Array.from(createDialog.querySelectorAll("button")).find((b) => /Créer|Create/.test(b.textContent ?? ""))!);

    const usernameInput = await screen.findByDisplayValue("admin-new-org");
    const copyBtn = usernameInput.parentElement!.querySelector("button")!;
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith("admin-new-org");

    const credentialsDialog = screen.getByRole("dialog");
    const closeBtn = Array.from(credentialsDialog.querySelectorAll("button")).find((b) =>
      /Fermer|Close/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates with an existing user as owner", async () => {
    mockUsers.current = [
      { id: "u1", username: "alice", role: "user", created_at: "2024-01-01T00:00:00.000Z" },
    ];
    createOrgMutateAsync.mockResolvedValue({ ...baseOrg, id: "org-new2" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));
    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: "Other Org" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Utilisateur existant|Existing user/.test(b.textContent ?? ""),
    )!);
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "alice")!);

    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => /Créer|Create/.test(b.textContent ?? ""))!);

    await waitFor(() => expect(createOrgMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Other Org", slug: "other-org", initial_owner_user_id: "u1" }),
    ));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches owner mode back to 'generate' after selecting 'existing'", async () => {
    mockUsers.current = [
      { id: "u1", username: "alice", role: "user", created_at: "2024-01-01T00:00:00.000Z" },
    ];
    createOrgMutateAsync.mockResolvedValue({
      ...baseOrg, id: "org-new3",
      initial_owner: { username: "admin-third-org", password: "Pwd123" },
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));
    fireEvent.change(screen.getByLabelText(/^Nom \*/), { target: { value: "Third Org" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Utilisateur existant|Existing user/.test(b.textContent ?? ""),
    )!);
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Générer un compte|Generate an admin account/i.test(b.textContent ?? ""),
    )!);

    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => /Créer|Create/.test(b.textContent ?? ""))!);

    await waitFor(() => expect(createOrgMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Third Org", slug: "third-org", initial_owner_user_id: undefined }),
    ));
  });

  it("allows manually editing the slug field", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle organisation|New organization/i }));

    const nameInput = screen.getByLabelText(/^Nom \*/);
    fireEvent.change(nameInput, { target: { value: "My Org" } });

    const slugInput = screen.getByLabelText(/^Identifiant|^Slug/) as HTMLInputElement;
    fireEvent.change(slugInput, { target: { value: "Custom Slug!" } });
    expect(slugInput.value).toBe("custom-slug");

    // Subsequent name changes no longer overwrite the manually-edited slug.
    fireEvent.change(nameInput, { target: { value: "Another Name" } });
    expect(slugInput.value).toBe("custom-slug");
  });
});
