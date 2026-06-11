import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
} from "./use-organization";

// ---------------------------------------------------------------------------
// Mock @/lib/auth-client
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth-client", () => {
  let mockOrgList: unknown[] | null = null;

  const organization = {
    create: vi.fn(),
    update: vi.fn(),
  };

  return {
    authClient: {
      useListOrganizations: () => ({ data: mockOrgList }),
      organization,
    },
    useSession: () => ({ data: null }),
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
    signUp: vi.fn(),
    getSession: vi.fn(),
    _setMockOrgList: (l: unknown[] | null) => { mockOrgList = l; },
    _organization: organization,
  };
});

import * as authClient from "@/lib/auth-client";
const mocks = authClient as unknown as {
  _setMockOrgList: (l: unknown[] | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _organization: Record<string, any>;
};

// ---------------------------------------------------------------------------
// Wrapper helper
// ---------------------------------------------------------------------------

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
  mocks._setMockOrgList(null);
  for (const fn of Object.values(mocks._organization)) fn.mockReset();
});

// ---------------------------------------------------------------------------
// useOrganizations
// ---------------------------------------------------------------------------

describe("useOrganizations", () => {
  it("returns an empty array when there is no data", () => {
    const { result } = renderHook(() => useOrganizations());
    expect(result.current).toEqual([]);
  });

  it("returns the list of organizations", () => {
    mocks._setMockOrgList([{ id: "org1", name: "Acme", slug: "acme", createdAt: new Date() }]);
    const { result } = renderHook(() => useOrganizations());
    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.id).toBe("org1");
  });
});

// ---------------------------------------------------------------------------
// useCreateOrganization
// ---------------------------------------------------------------------------

describe("useCreateOrganization", () => {
  it("calls organization.create", async () => {
    mocks._organization.create.mockResolvedValue({ data: { id: "org2", name: "Acme 2", slug: "acme-2" }, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    const data = await result.current.mutateAsync({ name: "Acme 2", slug: "acme-2" });
    expect(data).toEqual({ id: "org2", name: "Acme 2", slug: "acme-2" });
    expect(mocks._organization.create).toHaveBeenCalledWith({ name: "Acme 2", slug: "acme-2", metadata: undefined });
  });

  it("passes metadata.description when provided", async () => {
    mocks._organization.create.mockResolvedValue({ data: { id: "org3" }, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    await result.current.mutateAsync({ name: "Acme 3", slug: "acme-3", description: "A desc" });
    expect(mocks._organization.create).toHaveBeenCalledWith({
      name: "Acme 3", slug: "acme-3", metadata: { description: "A desc" },
    });
  });

  it("throws when the API returns an error", async () => {
    mocks._organization.create.mockResolvedValue({ data: null, error: { message: "slug taken" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    await expect(result.current.mutateAsync({ name: "Acme 2", slug: "acme" })).rejects.toThrow("slug taken");
  });
});

// ---------------------------------------------------------------------------
// useUpdateOrganization
// ---------------------------------------------------------------------------

describe("useUpdateOrganization", () => {
  it("calls organization.update and invalidates queries", async () => {
    mocks._organization.update.mockResolvedValue({ data: { id: "org1" }, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateOrganization(), { wrapper });
    await result.current.mutateAsync({
      organizationId: "org1",
      name: "Acme",
      slug: "acme",
      metadata: { description: "A description" },
    });
    expect(mocks._organization.update).toHaveBeenCalledWith({
      organizationId: "org1",
      data: { name: "Acme", slug: "acme", metadata: { description: "A description" } },
    });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
  });

  it("throws when the API returns an error", async () => {
    mocks._organization.update.mockResolvedValue({ data: null, error: { message: "not allowed" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateOrganization(), { wrapper });
    await expect(
      result.current.mutateAsync({ organizationId: "org1", name: "Acme", slug: "acme" }),
    ).rejects.toThrow("not allowed");
  });
});
