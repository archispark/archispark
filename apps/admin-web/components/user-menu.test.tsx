import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserMenu } from "./user-menu";

const mockUser: { current: { id: string; username: string; name: string; email: string | null; role: string } | null } = {
  current: { id: "u1", username: "alice", name: "Alice", email: "alice@example.com", role: "platform_admin" },
};
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => mockUser.current,
}));

describe("UserMenu", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockUser.current = { id: "u1", username: "alice", name: "Alice", email: "alice@example.com", role: "platform_admin" };
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, writable: true });
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

  it("navigates to /api/auth/logout on logout click", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Mon compte" }));
    fireEvent.click(screen.getByText("Se déconnecter"));
    expect(window.location.href).toBe("/api/auth/logout");
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
