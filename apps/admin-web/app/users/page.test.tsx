import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersPage from "./page";
import { I18nProvider } from "@/lib/i18n";
import type { UserOut } from "@/lib/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUsers: { current: UserOut[]; isLoading: boolean; error: Error | null } = {
  current: [],
  isLoading: false,
  error: null,
};
const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();

vi.mock("@/lib/queries", () => ({
  useUsers: () => ({ data: mockUsers.current, isLoading: mockUsers.isLoading, error: mockUsers.error }),
  useCreateUser: () => ({ mutateAsync: createMutateAsync }),
  useUpdateUser: () => ({ mutateAsync: updateMutateAsync }),
  useDeleteUser: () => ({ mutateAsync: deleteMutateAsync }),
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
        <UsersPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  mockUsers.current = [];
  mockUsers.isLoading = false;
  mockUsers.error = null;
  createMutateAsync.mockReset();
  updateMutateAsync.mockReset();
  deleteMutateAsync.mockReset();
});

describe("UsersPage", () => {
  it("renders the list of users", () => {
    mockUsers.current = [
      { id: "u1", username: "alice", role: "user", created_at: "2024-01-01T00:00:00.000Z" },
      { id: "u2", username: "bob", role: "platform_admin", created_at: "2024-02-01T00:00:00.000Z" },
    ];
    renderPage();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("platform_admin")).toBeInTheDocument();
  });

  it("displays an error message when loading users fails", () => {
    mockUsers.error = new Error("boom");
    renderPage();
    expect(screen.getByText(/Erreur|Error/)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it("opens the create dialog and submits with username, password, and role", async () => {
    createMutateAsync.mockResolvedValue({ id: "u-new" });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Nouvel utilisateur|New user/i }));

    const dialog = screen.getByRole("dialog");
    const usernameInput = screen.getByLabelText(/^Nom d.utilisateur \*/);
    fireEvent.change(usernameInput, { target: { value: "carol" } });

    const passwordInput = dialog.querySelector("#new-password") as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "secret123" } });

    // Change role to platform_admin via the mocked select.
    const roleButton = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "platform_admin")!;
    fireEvent.click(roleButton);

    const createBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Créer|Create/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(createBtn);

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledWith({
      username: "carol",
      password: "secret123",
      role: "platform_admin",
    }));
  });

  it("opens the edit dialog for a user and submits the role change", async () => {
    updateMutateAsync.mockResolvedValue({ id: "u1" });
    mockUsers.current = [
      { id: "u1", username: "alice", role: "user", created_at: "2024-01-01T00:00:00.000Z" },
    ];
    renderPage();

    const editButtons = screen.getAllByRole("button", { name: /Modifier|Edit/i });
    fireEvent.click(editButtons[0]!);

    const dialog = screen.getByRole("dialog");
    const roleButton = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "platform_admin")!;
    fireEvent.click(roleButton);

    const saveBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Enregistrer|Save/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith({
      id: "u1",
      body: { password: undefined, role: "platform_admin" },
    }));
  });

  it("opens the delete dialog for a user and confirms deletion", async () => {
    deleteMutateAsync.mockResolvedValue(undefined);
    mockUsers.current = [
      { id: "u1", username: "alice", role: "user", created_at: "2024-01-01T00:00:00.000Z" },
    ];
    renderPage();

    const deleteButtons = screen.getAllByRole("button", { name: /Supprimer|Delete/i });
    // The last button in the actions column is the row delete button.
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    const dialog = screen.getByRole("dialog");
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /Supprimer|Delete/.test(b.textContent ?? ""),
    )!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("u1"));
  });
});
