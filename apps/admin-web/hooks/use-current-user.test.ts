import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCurrentUser, useIsAdmin } from "./use-current-user";

vi.mock("@/lib/auth-client", () => {
  let mockUser: { id: string; name: string; username?: string; role?: string } | null = null;
  return {
    useSession: () => ({
      data: mockUser ? { user: mockUser, session: {} } : null,
    }),
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
    signUp: vi.fn(),
    getSession: vi.fn(),
    _setMockUser: (u: typeof mockUser) => { mockUser = u; },
  };
});

import * as authClient from "@/lib/auth-client";
const setMockUser = (authClient as unknown as { _setMockUser: (u: unknown) => void })._setMockUser;

describe("useCurrentUser", () => {
  beforeEach(() => setMockUser(null));

  it("returns null when no session", () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBeNull();
  });

  it("returns user when session exists", () => {
    setMockUser({ id: "u1", name: "alice", username: "alice", role: "platform_admin" });
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current?.username).toBe("alice");
    expect(result.current?.role).toBe("platform_admin");
  });
});

describe("useIsAdmin", () => {
  beforeEach(() => setMockUser(null));

  it("returns false when no user", () => {
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it("returns true when user role is platform_admin", () => {
    setMockUser({ id: "u1", name: "alice", username: "alice", role: "platform_admin" });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
  });

  it("returns false when user role is user", () => {
    setMockUser({ id: "u2", name: "bob", username: "bob", role: "user" });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });
});
