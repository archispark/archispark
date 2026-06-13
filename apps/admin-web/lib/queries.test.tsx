import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useAdminOrganizations, useSetOrganizationEnabled, useNeonStatus,
  useCreateAdminOrganization, useVerifyOrganizationDb, useReprovisionOrganization,
  queryKeys,
} from "./queries";

vi.mock("./api", () => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserApi: vi.fn(),
  deleteUserApi: vi.fn(),
  fetchAdminOrganizations: vi.fn(),
  setOrganizationEnabledApi: vi.fn(),
  fetchNeonStatus: vi.fn(),
  createAdminOrganization: vi.fn(),
  verifyOrganizationDb: vi.fn(),
  reprovisionOrganization: vi.fn(),
}));

import * as api from "./api";
const mocks = api as unknown as {
  fetchUsers: ReturnType<typeof vi.fn>;
  createUser: ReturnType<typeof vi.fn>;
  updateUserApi: ReturnType<typeof vi.fn>;
  deleteUserApi: ReturnType<typeof vi.fn>;
  fetchAdminOrganizations: ReturnType<typeof vi.fn>;
  setOrganizationEnabledApi: ReturnType<typeof vi.fn>;
  fetchNeonStatus: ReturnType<typeof vi.fn>;
  createAdminOrganization: ReturnType<typeof vi.fn>;
  verifyOrganizationDb: ReturnType<typeof vi.fn>;
  reprovisionOrganization: ReturnType<typeof vi.fn>;
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
  mocks.fetchAdminOrganizations.mockReset();
  mocks.setOrganizationEnabledApi.mockReset();
  mocks.fetchNeonStatus.mockReset();
  mocks.createAdminOrganization.mockReset();
  mocks.verifyOrganizationDb.mockReset();
  mocks.reprovisionOrganization.mockReset();
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

// ---------------------------------------------------------------------------
// Admin organizations & Neon status
// ---------------------------------------------------------------------------

describe("queryKeys", () => {
  it("adminOrganizations() and neonStatus() return stable key tuples", () => {
    expect(queryKeys.adminOrganizations()).toEqual(["admin-organizations"]);
    expect(queryKeys.neonStatus()).toEqual(["neon-status"]);
  });
});

describe("useAdminOrganizations", () => {
  it("fetches organizations via fetchAdminOrganizations", async () => {
    mocks.fetchAdminOrganizations.mockResolvedValue([
      { id: "org-1", name: "Acme", slug: "acme", enabled: true, created_at: "2024-01-01", tenant_status: "active", last_error: null },
    ]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAdminOrganizations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.slug).toBe("acme");
    expect(mocks.fetchAdminOrganizations).toHaveBeenCalled();
  });
});

describe("useSetOrganizationEnabled", () => {
  it("calls setOrganizationEnabledApi and invalidates the admin-organizations query", async () => {
    mocks.setOrganizationEnabledApi.mockResolvedValue({
      id: "org-1", name: "Acme", slug: "acme", enabled: false, created_at: "2024-01-01", tenant_status: "active", last_error: null,
    });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSetOrganizationEnabled(), { wrapper });
    const data = await result.current.mutateAsync({ id: "org-1", enabled: false });
    expect(data.enabled).toBe(false);
    expect(mocks.setOrganizationEnabledApi).toHaveBeenCalledWith("org-1", false);
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-organizations"] }));
  });
});

describe("useNeonStatus", () => {
  it("fetches Neon status via fetchNeonStatus", async () => {
    mocks.fetchNeonStatus.mockResolvedValue({ configured: true, reachable: true, provider: "neon" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useNeonStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.provider).toBe("neon");
    expect(mocks.fetchNeonStatus).toHaveBeenCalled();
  });
});

describe("useCreateAdminOrganization", () => {
  it("calls createAdminOrganization and invalidates the admin-organizations query", async () => {
    mocks.createAdminOrganization.mockResolvedValue({
      id: "org-2", name: "Beta", slug: "beta", enabled: true, created_at: "2024-01-01", tenant_status: "pending", last_error: null,
      initial_owner: { username: "admin-beta", password: "s3cret" },
    });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateAdminOrganization(), { wrapper });
    const data = await result.current.mutateAsync({ name: "Beta", slug: "beta" });
    expect(data.initial_owner).toEqual({ username: "admin-beta", password: "s3cret" });
    expect(mocks.createAdminOrganization).toHaveBeenCalledWith({ name: "Beta", slug: "beta" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-organizations"] }));
  });
});

describe("useVerifyOrganizationDb", () => {
  it("calls verifyOrganizationDb without invalidating other queries", async () => {
    mocks.verifyOrganizationDb.mockResolvedValue({ connected: true, latency_ms: 5, version: "16.1" });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useVerifyOrganizationDb(), { wrapper });
    const data = await result.current.mutateAsync("org-1");
    expect(data.connected).toBe(true);
    expect(mocks.verifyOrganizationDb).toHaveBeenCalledWith("org-1");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useReprovisionOrganization", () => {
  it("calls reprovisionOrganization and invalidates the admin-organizations query", async () => {
    mocks.reprovisionOrganization.mockResolvedValue({
      id: "org-1", name: "Acme", slug: "acme", enabled: true, created_at: "2024-01-01", tenant_status: "provisioning", last_error: null,
    });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useReprovisionOrganization(), { wrapper });
    const data = await result.current.mutateAsync("org-1");
    expect(data.tenant_status).toBe("provisioning");
    expect(mocks.reprovisionOrganization).toHaveBeenCalledWith("org-1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-organizations"] }));
  });
});
