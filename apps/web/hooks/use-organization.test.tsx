import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useActiveOrganization,
  useOrganizations,
  useOrgRole,
  useIsOrgAdmin,
  useTeams,
  useTeamMembers,
  useSetActiveOrganization,
  useAutoActivateOrganization,
  useInviteMember,
  useCancelInvitation,
  useUpdateMemberRole,
  useRemoveMember,
  useCreateTeam,
  useUpdateTeam,
  useRemoveTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  type ActiveOrganization,
} from "./use-organization";

// ---------------------------------------------------------------------------
// Mock @/lib/auth-client
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
  user: null as { id: string; name: string; username?: string; role?: string } | null,
}));

vi.mock("./use-current-user", () => ({
  useIsAdmin: () => mockState.user?.role === "platform_admin",
}));

vi.mock("@/lib/auth-client", () => {
  let mockActiveOrg: unknown = null;
  let mockOrgList: unknown[] | null = null;
  let mockMemberRole: { role: string } | null = null;

  const organization = {
    listTeams: vi.fn(),
    listTeamMembers: vi.fn(),
    setActive: vi.fn(),
    inviteMember: vi.fn(),
    cancelInvitation: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    removeTeam: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
  };

  return {
    authClient: {
      useActiveOrganization: () => ({ data: mockActiveOrg }),
      useListOrganizations: () => ({ data: mockOrgList }),
      useActiveMemberRole: () => ({ data: mockMemberRole }),
      organization,
    },
    useSession: () => ({
      data: mockState.user ? { user: mockState.user, session: {} } : null,
    }),
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
    signUp: vi.fn(),
    getSession: vi.fn(),
    _setMockActiveOrg: (o: unknown) => { mockActiveOrg = o; },
    _setMockOrgList: (l: unknown[] | null) => { mockOrgList = l; },
    _setMockMemberRole: (r: { role: string } | null) => { mockMemberRole = r; },
    _setMockUser: (u: typeof mockState.user) => { mockState.user = u; },
    _organization: organization,
  };
});

import * as authClient from "@/lib/auth-client";
const mocks = authClient as unknown as {
  _setMockActiveOrg: (o: unknown) => void;
  _setMockOrgList: (l: unknown[] | null) => void;
  _setMockMemberRole: (r: { role: string } | null) => void;
  _setMockUser: (u: { id: string; name: string; username?: string; role?: string } | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _organization: Record<string, any>;
};

const sampleOrg: ActiveOrganization = {
  id: "org1",
  name: "Acme",
  createdAt: new Date("2024-01-01"),
  members: [],
  invitations: [],
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
  mocks._setMockActiveOrg(null);
  mocks._setMockOrgList(null);
  mocks._setMockMemberRole(null);
  mocks._setMockUser(null);
  for (const fn of Object.values(mocks._organization)) fn.mockReset();
});

// ---------------------------------------------------------------------------
// Simple selector hooks
// ---------------------------------------------------------------------------

describe("useActiveOrganization", () => {
  it("returns null when there is no active organization", () => {
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current).toBeNull();
  });

  it("returns the active organization", () => {
    mocks._setMockActiveOrg(sampleOrg);
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current?.id).toBe("org1");
  });
});

describe("useOrganizations", () => {
  it("returns an empty array when there is no data", () => {
    const { result } = renderHook(() => useOrganizations());
    expect(result.current).toEqual([]);
  });

  it("returns the list of organizations", () => {
    mocks._setMockOrgList([{ id: "org1", name: "Acme", createdAt: new Date() }]);
    const { result } = renderHook(() => useOrganizations());
    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.id).toBe("org1");
  });
});

describe("useOrgRole", () => {
  it("returns null when there is no active member role", () => {
    const { result } = renderHook(() => useOrgRole());
    expect(result.current).toBeNull();
  });

  it("returns the active member role", () => {
    mocks._setMockMemberRole({ role: "admin" });
    const { result } = renderHook(() => useOrgRole());
    expect(result.current).toBe("admin");
  });
});

describe("useIsOrgAdmin", () => {
  it("returns false when there is no user and no org role", () => {
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(false);
  });

  it("returns false for a plain member", () => {
    mocks._setMockMemberRole({ role: "member" });
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(false);
  });

  it("returns true for an org owner", () => {
    mocks._setMockMemberRole({ role: "owner" });
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(true);
  });

  it("returns true for an org admin", () => {
    mocks._setMockMemberRole({ role: "admin" });
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(true);
  });

  it("returns true for a platform super admin regardless of org role", () => {
    mocks._setMockUser({ id: "u1", name: "alice", username: "alice", role: "platform_admin" });
    mocks._setMockMemberRole({ role: "member" });
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe("useTeams", () => {
  it("is disabled when there is no active organization", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks._organization.listTeams).not.toHaveBeenCalled();
  });

  it("fetches teams for the active organization", async () => {
    mocks._setMockActiveOrg(sampleOrg);
    mocks._organization.listTeams.mockResolvedValue({
      data: [{ id: "t1", name: "Team 1", organizationId: "org1", createdAt: new Date() }],
      error: null,
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.name).toBe("Team 1");
  });

  it("propagates errors from the API", async () => {
    mocks._setMockActiveOrg(sampleOrg);
    mocks._organization.listTeams.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");
  });
});

describe("useTeamMembers", () => {
  it("is disabled when teamId is null", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMembers(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks._organization.listTeamMembers).not.toHaveBeenCalled();
  });

  it("fetches members for a team", async () => {
    mocks._organization.listTeamMembers.mockResolvedValue({
      data: [{ id: "m1", teamId: "team1", userId: "u1", createdAt: new Date() }],
      error: null,
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMembers("team1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.userId).toBe("u1");
    expect(mocks._organization.listTeamMembers).toHaveBeenCalledWith({ query: { teamId: "team1" } });
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe("useSetActiveOrganization", () => {
  it("calls organization.setActive", async () => {
    mocks._organization.setActive.mockResolvedValue({ data: { id: "org1" }, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetActiveOrganization(), { wrapper });
    const data = await result.current.mutateAsync("org1");
    expect(data).toEqual({ id: "org1" });
    expect(mocks._organization.setActive).toHaveBeenCalledWith({ organizationId: "org1" });
  });

  it("throws when the API returns an error", async () => {
    mocks._organization.setActive.mockResolvedValue({ data: null, error: { message: "nope" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetActiveOrganization(), { wrapper });
    await expect(result.current.mutateAsync("org1")).rejects.toThrow("nope");
  });
});

describe("useAutoActivateOrganization", () => {
  it("activates the user's first organization when none is active", async () => {
    mocks._setMockOrgList([{ id: "org1", name: "Acme", createdAt: new Date() }]);
    mocks._organization.setActive.mockResolvedValue({ data: { id: "org1" }, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useAutoActivateOrganization(), { wrapper });
    await waitFor(() => expect(mocks._organization.setActive).toHaveBeenCalledWith({ organizationId: "org1" }));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
  });

  it("does nothing when an organization is already active", () => {
    mocks._setMockActiveOrg(sampleOrg);
    mocks._setMockOrgList([{ id: "org1", name: "Acme", createdAt: new Date() }]);
    const { wrapper } = createWrapper();
    renderHook(() => useAutoActivateOrganization(), { wrapper });
    expect(mocks._organization.setActive).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no organizations", () => {
    const { wrapper } = createWrapper();
    renderHook(() => useAutoActivateOrganization(), { wrapper });
    expect(mocks._organization.setActive).not.toHaveBeenCalled();
  });
});

describe("useInviteMember", () => {
  it("calls organization.inviteMember", async () => {
    mocks._organization.inviteMember.mockResolvedValue({ data: { id: "inv1" }, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInviteMember(), { wrapper });
    const body = { email: "a@b.com", role: "member" as const };
    const data = await result.current.mutateAsync(body);
    expect(data).toEqual({ id: "inv1" });
    expect(mocks._organization.inviteMember).toHaveBeenCalledWith(body);
  });
});

describe("useCancelInvitation", () => {
  it("calls organization.cancelInvitation", async () => {
    mocks._organization.cancelInvitation.mockResolvedValue({ data: {}, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelInvitation(), { wrapper });
    await result.current.mutateAsync("inv1");
    expect(mocks._organization.cancelInvitation).toHaveBeenCalledWith({ invitationId: "inv1" });
  });
});

describe("useUpdateMemberRole", () => {
  it("calls organization.updateMemberRole", async () => {
    mocks._organization.updateMemberRole.mockResolvedValue({ data: {}, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateMemberRole(), { wrapper });
    await result.current.mutateAsync({ memberId: "m1", role: "admin" });
    expect(mocks._organization.updateMemberRole).toHaveBeenCalledWith({ memberId: "m1", role: "admin" });
  });
});

describe("useRemoveMember", () => {
  it("calls organization.removeMember", async () => {
    mocks._organization.removeMember.mockResolvedValue({ data: {}, error: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveMember(), { wrapper });
    await result.current.mutateAsync("m1");
    expect(mocks._organization.removeMember).toHaveBeenCalledWith({ memberIdOrEmail: "m1" });
  });
});

describe("useCreateTeam", () => {
  it("creates a team and invalidates org-teams", async () => {
    mocks._organization.createTeam.mockResolvedValue({ data: { id: "t1" }, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateTeam(), { wrapper });
    await result.current.mutateAsync("Team 1");
    expect(mocks._organization.createTeam).toHaveBeenCalledWith({ name: "Team 1" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-teams"] }));
  });
});

describe("useUpdateTeam", () => {
  it("updates a team and invalidates org-teams", async () => {
    mocks._organization.updateTeam.mockResolvedValue({ data: { id: "t1" }, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateTeam(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", name: "New Name" });
    expect(mocks._organization.updateTeam).toHaveBeenCalledWith({ teamId: "t1", data: { name: "New Name" } });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-teams"] }));
  });
});

describe("useRemoveTeam", () => {
  it("removes a team and invalidates org-teams", async () => {
    mocks._organization.removeTeam.mockResolvedValue({ data: {}, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveTeam(), { wrapper });
    await result.current.mutateAsync("t1");
    expect(mocks._organization.removeTeam).toHaveBeenCalledWith({ teamId: "t1" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-teams"] }));
  });
});

describe("useAddTeamMember", () => {
  it("adds a team member and invalidates that team's members", async () => {
    mocks._organization.addTeamMember.mockResolvedValue({ data: {}, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAddTeamMember(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", userId: "u1" });
    expect(mocks._organization.addTeamMember).toHaveBeenCalledWith({ teamId: "t1", userId: "u1" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-team-members", "t1"] }));
  });
});

describe("useRemoveTeamMember", () => {
  it("removes a team member and invalidates that team's members", async () => {
    mocks._organization.removeTeamMember.mockResolvedValue({ data: {}, error: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveTeamMember(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", userId: "u1" });
    expect(mocks._organization.removeTeamMember).toHaveBeenCalledWith({ teamId: "t1", userId: "u1" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-team-members", "t1"] }));
  });
});
