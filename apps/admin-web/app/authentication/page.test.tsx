import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuthenticationPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { OAuthProviderOut } from "@/lib/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fetchProviders = vi.fn();
const createProvider = vi.fn();
const updateProvider = vi.fn();
const deleteProvider = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchProviders: (...args: unknown[]) => fetchProviders(...args),
  createProvider: (...args: unknown[]) => createProvider(...args),
  updateProvider: (...args: unknown[]) => updateProvider(...args),
  deleteProvider: (...args: unknown[]) => deleteProvider(...args),
}));

vi.mock("@workspace/ui/components/dialog", () => {
  const DialogContext = createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({ open: false });

  const Dialog = ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <DialogContext.Provider value={{ open: !!open, onOpenChange }}>{children}</DialogContext.Provider>
  );

  const DialogTrigger = ({ children, render: r, onClick }: { children: React.ReactNode; render?: React.ReactElement; onClick?: () => void }) => {
    const { onOpenChange } = useContext(DialogContext);
    const handleClick = () => { onClick?.(); (r?.props as { onClick?: () => void } | undefined)?.onClick?.(); onOpenChange?.(true); };
    return <button type="button" onClick={handleClick}>{children}</button>;
  };

  const DialogContent = ({ children }: { children: React.ReactNode }) => {
    const { open } = useContext(DialogContext);
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
  return render(
    <I18nProvider>
      <AuthenticationPage />
    </I18nProvider>,
  );
}

const oidcProvider: OAuthProviderOut = {
  id: "p1",
  provider_id: "oidc-p1",
  type: "oidc",
  name: "My SSO",
  client_id: "client-1",
  issuer_url: "https://sso.example.com",
  tenant_id: null,
  enabled: true,
  created_at: 1700000000,
};

const entraProvider: OAuthProviderOut = {
  id: "p2",
  provider_id: "entra-p2",
  type: "microsoft-entra-id",
  name: "Entra",
  client_id: "client-2",
  issuer_url: null,
  tenant_id: "tenant-abc",
  enabled: false,
  created_at: 1700000001,
};

beforeEach(() => {
  fetchProviders.mockReset();
  createProvider.mockReset();
  updateProvider.mockReset();
  deleteProvider.mockReset();
});

describe("AuthenticationPage", () => {
  it("shows a loading state while fetching providers", () => {
    fetchProviders.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Chargement/)).toBeInTheDocument();
  });

  it("shows an error message when fetching providers fails", async () => {
    fetchProviders.mockRejectedValue(new Error("network down"));
    renderPage();
    await waitFor(() => expect(screen.getByText("network down")).toBeInTheDocument());
  });

  it("shows the empty state when there are no providers", async () => {
    fetchProviders.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Aucun fournisseur configuré/)).toBeInTheDocument());
  });

  it("renders the list of providers with type label and issuer", async () => {
    fetchProviders.mockResolvedValue([oidcProvider, entraProvider]);
    renderPage();

    await waitFor(() => expect(screen.getByText("My SSO")).toBeInTheDocument());
    expect(screen.getByText("Entra")).toBeInTheDocument();
    expect(screen.getByText(/OIDC générique/)).toBeInTheDocument();
    expect(screen.getByText(/Microsoft Entra ID/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/sso.example.com/)).toBeInTheDocument();
  });

  it("toggles enabled state when clicking the enable/disable button", async () => {
    fetchProviders.mockResolvedValueOnce([oidcProvider]).mockResolvedValueOnce([{ ...oidcProvider, enabled: false }]);
    updateProvider.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByText("My SSO")).toBeInTheDocument());

    const toggleBtn = screen.getByTitle("Désactiver");
    fireEvent.click(toggleBtn);

    await waitFor(() => expect(updateProvider).toHaveBeenCalledWith("p1", { enabled: false }));
    await waitFor(() => expect(fetchProviders).toHaveBeenCalledTimes(2));
  });

  it("creates an OIDC provider with issuer URL", async () => {
    fetchProviders.mockResolvedValue([]);
    createProvider.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByText(/Aucun fournisseur configuré/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un fournisseur/ }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByLabelText(/^Nom affiché \*/), { target: { value: "Keycloak" } });
    fireEvent.change(screen.getByLabelText(/^Client ID \*/), { target: { value: "abc-client" } });
    fireEvent.change(screen.getByLabelText(/^Client Secret \*/), { target: { value: "abc-secret" } });
    fireEvent.change(screen.getByLabelText(/^Issuer URL \*/), { target: { value: "https://kc.example.com/realms/main" } });

    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Créer")!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(createProvider).toHaveBeenCalledWith({
      type: "oidc",
      name: "Keycloak",
      client_id: "abc-client",
      client_secret: "abc-secret",
      issuer_url: "https://kc.example.com/realms/main",
    }));
  });

  it("shows a validation error when creating an OIDC provider without an issuer URL", async () => {
    fetchProviders.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Aucun fournisseur configuré/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un fournisseur/ }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByLabelText(/^Nom affiché \*/), { target: { value: "Keycloak" } });
    fireEvent.change(screen.getByLabelText(/^Client ID \*/), { target: { value: "abc-client" } });
    fireEvent.change(screen.getByLabelText(/^Client Secret \*/), { target: { value: "abc-secret" } });

    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Créer")!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(screen.getByText(/Issuer URL requis pour OIDC/)).toBeInTheDocument());
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("creates a Microsoft Entra ID provider with a tenant id and shows the tenant field", async () => {
    fetchProviders.mockResolvedValue([]);
    createProvider.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByText(/Aucun fournisseur configuré/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un fournisseur/ }));

    const dialog = screen.getByRole("dialog");

    // Switch the provider type to "microsoft-entra-id" via the mocked select.
    const entraOption = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Microsoft Entra ID")!;
    fireEvent.click(entraOption);

    fireEvent.change(screen.getByLabelText(/^Nom affiché \*/), { target: { value: "Entra Login" } });
    fireEvent.change(screen.getByLabelText(/^Client ID \*/), { target: { value: "entra-client" } });
    fireEvent.change(screen.getByLabelText(/^Client Secret \*/), { target: { value: "entra-secret" } });
    fireEvent.change(screen.getByLabelText(/^Tenant ID/), { target: { value: "tenant-xyz" } });

    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Créer")!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(createProvider).toHaveBeenCalledWith({
      type: "microsoft-entra-id",
      name: "Entra Login",
      client_id: "entra-client",
      client_secret: "entra-secret",
      tenant_id: "tenant-xyz",
    }));
  });

  it("toggles the client secret visibility", async () => {
    fetchProviders.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/Aucun fournisseur configuré/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un fournisseur/ }));

    const secretInput = screen.getByLabelText(/^Client Secret \*/) as HTMLInputElement;
    expect(secretInput.type).toBe("password");

    const toggleBtn = secretInput.parentElement!.querySelector("button")!;
    fireEvent.click(toggleBtn);

    expect(secretInput.type).toBe("text");
  });

  it("opens the edit dialog and submits a name change", async () => {
    fetchProviders.mockResolvedValue([oidcProvider]);
    updateProvider.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByText("My SSO")).toBeInTheDocument());

    // The edit button is the pencil icon button within the provider row.
    const editBtn = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-pencil"))!;
    fireEvent.click(editBtn);

    const dialog = screen.getByRole("dialog");
    const nameInput = screen.getByLabelText(/^Nom affiché \*/) as HTMLInputElement;
    expect(nameInput.value).toBe("My SSO");

    fireEvent.change(nameInput, { target: { value: "My SSO Renamed" } });

    const saveBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Enregistrer|Save/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateProvider).toHaveBeenCalledWith("p1", expect.objectContaining({
      name: "My SSO Renamed",
      client_id: "client-1",
      issuer_url: "https://sso.example.com",
    })));
  });

  it("opens the delete dialog and confirms deletion", async () => {
    fetchProviders.mockResolvedValue([oidcProvider]);
    deleteProvider.mockResolvedValue({});
    renderPage();

    await waitFor(() => expect(screen.getByText("My SSO")).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg.text-destructive"));
    fireEvent.click(deleteButtons[0]!);

    const dialog = screen.getByRole("dialog");
    expect(screen.getByText(/Supprimer le fournisseur/)).toBeInTheDocument();

    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Supprimer")!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteProvider).toHaveBeenCalledWith("p1"));
  });
});
