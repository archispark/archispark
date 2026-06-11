import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserMenu } from "./user-menu";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth-client", () => ({
  signOut: () => signOut(),
}));

const mockUser: { current: { id: string; username: string; name: string; email: string | null; role: string } | null } = {
  current: { id: "u1", username: "alice", name: "Alice", email: "alice@example.com", role: "platform_admin" },
};
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => mockUser.current,
}));

describe("UserMenu", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    signOut.mockClear();
    mockUser.current = { id: "u1", username: "alice", name: "Alice", email: "alice@example.com", role: "platform_admin" };
  });

  it("renders the user's initial as the avatar button", () => {
    render(<UserMenu />);
    expect(screen.getByRole("button", { name: "Mon compte" })).toHaveTextContent("A");
  });

  it("opens the menu showing the user's name and role", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Mon compte" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("platform_admin")).toBeInTheDocument();
  });

  it("calls signOut and navigates to /login on logout click", async () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Mon compte" }));
    fireEvent.click(screen.getByText("Se déconnecter"));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows '?' when there is no user", () => {
    mockUser.current = null;
    render(<UserMenu />);
    expect(screen.getByRole("button", { name: "Mon compte" })).toHaveTextContent("?");
  });

  it("closes the menu when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <UserMenu />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mon compte" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});
