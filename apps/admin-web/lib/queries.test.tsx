import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "./queries";

vi.mock("./api", () => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserApi: vi.fn(),
  deleteUserApi: vi.fn(),
}));

import * as api from "./api";
const mocks = api as unknown as {
  fetchUsers: ReturnType<typeof vi.fn>;
  createUser: ReturnType<typeof vi.fn>;
  updateUserApi: ReturnType<typeof vi.fn>;
  deleteUserApi: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

beforeEach(() => {
  mocks.fetchUsers.mockReset();
  mocks.createUser.mockReset();
  mocks.updateUserApi.mockReset();
  mocks.deleteUserApi.mockReset();
});

describe("useUsers", () => {
  it("fetches users via fetchUsers", async () => {
    mocks.fetchUsers.mockResolvedValue([{ id: "u1", username: "alice", role: "user", created_at: "2024-01-01" }]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUsers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.username).toBe("alice");
    expect(mocks.fetchUsers).toHaveBeenCalled();
  });
});

describe("useCreateUser", () => {
  it("calls createUser and invalidates the users query", async () => {
    mocks.createUser.mockResolvedValue({ id: "u2", username: "bob", role: "user", created_at: "2024-01-01" });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateUser(), { wrapper });
    const data = await result.current.mutateAsync({ username: "bob", password: "secret" });
    expect(data.username).toBe("bob");
    expect(mocks.createUser).toHaveBeenCalledWith({ username: "bob", password: "secret" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] }));
  });
});

describe("useUpdateUser", () => {
  it("calls updateUserApi and invalidates the users query", async () => {
    mocks.updateUserApi.mockResolvedValue({ id: "u1", username: "alice", role: "platform_admin", created_at: "2024-01-01" });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    const data = await result.current.mutateAsync({ id: "u1", body: { role: "platform_admin" } });
    expect(data.role).toBe("platform_admin");
    expect(mocks.updateUserApi).toHaveBeenCalledWith("u1", { role: "platform_admin" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] }));
  });
});

describe("useDeleteUser", () => {
  it("calls deleteUserApi and invalidates the users query", async () => {
    mocks.deleteUserApi.mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useDeleteUser(), { wrapper });
    await result.current.mutateAsync("u1");
    expect(mocks.deleteUserApi).toHaveBeenCalledWith("u1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] }));
  });
});
