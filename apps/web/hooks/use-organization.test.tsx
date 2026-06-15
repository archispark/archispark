import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OrgRoleName } from "@workspace/auth";
import {
  useOrganizations,
  useActiveOrganization,
  useOrgRole,
  useIsOrgAdmin,
  useIsOrgOwner,
  useSetActiveOrganization,
  useAutoActivateOrganization,
  useOrgMembers,
  useOrgInvitations,
  useTeams,
  useTeamMembers,
  useInviteMember,
  useCancelInvitation,
  useUpdateMemberRole,
  useRemoveMember,
  useCreateTeam,
  useUpdateTeam,
  useRemoveTeam,
  useAddTeamMember,
  useRemoveTeamMember,
} from "./use-organization";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface MockOrg {
  id: string;
  name: string;
  role: OrgRoleName;
}

const mockState = vi.hoisted(() => ({
  user: null as { organizations: MockOrg[] } | null,
  isAdmin: false,
}));

vi.mock("./use-current-user", () => ({
  useCurrentUser: () => mockState.user,
  useIsAdmin: () => mockState.isAdmin,
}));

vi.mock("@/lib/api", () => ({
  fetchOrgMembers: vi.fn(),
  updateOrgMemberRole: vi.fn(),
  removeOrgMember: vi.fn(),
  fetchOrgInvitations: vi.fn(),
  createOrgInvitation: vi.fn(),
  cancelOrgInvitation: vi.fn(),
  fetchOrgTeams: vi.fn(),
  createOrgTeam: vi.fn(),
  updateOrgTeam: vi.fn(),
  removeOrgTeam: vi.fn(),
  fetchOrgTeamMembers: vi.fn(),
  addOrgTeamMember: vi.fn(),
  removeOrgTeamMember: vi.fn(),
}));

import * as api from "@/lib/api";

const org1: MockOrg = { id: "org1", name: "Acme", role: "owner" };
const org2: MockOrg = { id: "org2", name: "Globex", role: "member" };

function setOrganizations(orgs: MockOrg[]): void {
  mockState.user = { organizations: orgs };
}

function setActiveOrgCookie(id: string): void {
  document.cookie = `active_org=${id}; path=/`;
}

function clearActiveOrgCookie(): void {
  document.cookie = "active_org=; path=/; max-age=0";
}

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
  mockState.user = null;
  mockState.isAdmin = false;
  clearActiveOrgCookie();
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Simple selector hooks
// ---------------------------------------------------------------------------

describe("useOrganizations", () => {
  it("returns an empty array when there is no current user", () => {
    const { result } = renderHook(() => useOrganizations());
    expect(result.current).toEqual([]);
  });

  it("returns the user's organizations", () => {
    setOrganizations([org1, org2]);
    const { result } = renderHook(() => useOrganizations());
    expect(result.current).toEqual([org1, org2]);
  });
});

describe("useActiveOrganization", () => {
  it("returns null when the user has no organizations", () => {
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current).toBeNull();
  });

  it("returns the first organization when no active_org cookie is set", () => {
    setOrganizations([org1, org2]);
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current?.id).toBe("org1");
  });

  it("returns the organization matching the active_org cookie", () => {
    setOrganizations([org1, org2]);
    setActiveOrgCookie("org2");
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current?.id).toBe("org2");
  });

  it("falls back to the first organization when the cookie matches none", () => {
    setOrganizations([org1, org2]);
    setActiveOrgCookie("org-unknown");
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current?.id).toBe("org1");
  });
});

describe("useOrgRole", () => {
  it("returns null when there is no active organization", () => {
    const { result } = renderHook(() => useOrgRole());
    expect(result.current).toBeNull();
  });

  it("returns the active organization's role", () => {
    setOrganizations([org1]);
    const { result } = renderHook(() => useOrgRole());
    expect(result.current).toBe("owner");
  });
});

describe("useIsOrgAdmin", () => {
  it("returns false when there is no user and no org role", () => {
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(false);
  });

  it("returns false for a plain member", () => {
    setOrganizations([org2]);
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(false);
  });

  it("returns true for an org owner", () => {
    setOrganizations([org1]);
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(true);
  });

  it("returns true for an org admin", () => {
    setOrganizations([{ id: "org3", name: "Initech", role: "admin" }]);
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(true);
  });

  it("returns true for a platform super admin regardless of org role", () => {
    mockState.isAdmin = true;
    setOrganizations([org2]);
    const { result } = renderHook(() => useIsOrgAdmin());
    expect(result.current).toBe(true);
  });
});

describe("useIsOrgOwner", () => {
  it("returns false when there is no user and no org role", () => {
    const { result } = renderHook(() => useIsOrgOwner());
    expect(result.current).toBe(false);
  });

  it("returns false for a plain member", () => {
    setOrganizations([org2]);
    const { result } = renderHook(() => useIsOrgOwner());
    expect(result.current).toBe(false);
  });

  it("returns true for an org owner", () => {
    setOrganizations([org1]);
    const { result } = renderHook(() => useIsOrgOwner());
    expect(result.current).toBe(true);
  });

  it("returns false for an org admin (organization administration is owner-only)", () => {
    setOrganizations([{ id: "org3", name: "Initech", role: "admin" }]);
    const { result } = renderHook(() => useIsOrgOwner());
    expect(result.current).toBe(false);
  });

  it("returns true for a platform super admin regardless of org role", () => {
    mockState.isAdmin = true;
    setOrganizations([org2]);
    const { result } = renderHook(() => useIsOrgOwner());
    expect(result.current).toBe(true);
  });
});

describe("useSetActiveOrganization", () => {
  it("writes the active_org cookie and invalidates queries", () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSetActiveOrganization(), { wrapper });
    act(() => {
      result.current("org2");
    });
    expect(document.cookie).toContain("active_org=org2");
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe("useAutoActivateOrganization", () => {
  it("activates the user's first organization when no cookie is set", async () => {
    setOrganizations([org1, org2]);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useAutoActivateOrganization(), { wrapper });
    await waitFor(() => expect(document.cookie).toContain("active_org=org1"));
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("does nothing when the active_org cookie is already set", () => {
    setOrganizations([org1, org2]);
    setActiveOrgCookie("org2");
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useAutoActivateOrganization(), { wrapper });
    expect(document.cookie).toContain("active_org=org2");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no organizations", () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useAutoActivateOrganization(), { wrapper });
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("active_org=");
  });
});

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe("useOrgMembers", () => {
  it("is disabled when there is no active organization", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOrgMembers(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.fetchOrgMembers).not.toHaveBeenCalled();
  });

  it("fetches members for the active organization", async () => {
    setOrganizations([org1]);
    vi.mocked(api.fetchOrgMembers).mockResolvedValue([
      { user_id: "u1", username: "alice", email: "alice@example.com", role: "owner" },
    ]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOrgMembers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.username).toBe("alice");
    expect(api.fetchOrgMembers).toHaveBeenCalledWith("org1");
  });
});

describe("useOrgInvitations", () => {
  it("is disabled when there is no active organization", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOrgInvitations(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.fetchOrgInvitations).not.toHaveBeenCalled();
  });

  it("fetches invitations for the active organization", async () => {
    setOrganizations([org1]);
    vi.mocked(api.fetchOrgInvitations).mockResolvedValue([
      { id: "inv1", email: "bob@example.com", roles: ["member"], created_at: null },
    ]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOrgInvitations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.email).toBe("bob@example.com");
    expect(api.fetchOrgInvitations).toHaveBeenCalledWith("org1");
  });
});

describe("useTeams", () => {
  it("is disabled when there is no active organization", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.fetchOrgTeams).not.toHaveBeenCalled();
  });

  it("fetches teams for the active organization", async () => {
    setOrganizations([org1]);
    vi.mocked(api.fetchOrgTeams).mockResolvedValue([
      { id: "t1", name: "Team 1", organization_id: "org1", created_at: "2024-01-01T00:00:00Z" },
    ]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.name).toBe("Team 1");
    expect(api.fetchOrgTeams).toHaveBeenCalledWith("org1");
  });
});

describe("useTeamMembers", () => {
  it("is disabled when teamId is null", () => {
    setOrganizations([org1]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMembers(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.fetchOrgTeamMembers).not.toHaveBeenCalled();
  });

  it("is disabled when there is no active organization", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMembers("t1"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.fetchOrgTeamMembers).not.toHaveBeenCalled();
  });

  it("fetches members for a team in the active organization", async () => {
    setOrganizations([org1]);
    vi.mocked(api.fetchOrgTeamMembers).mockResolvedValue([{ user_id: "u1", username: "alice", email: "alice@example.com" }]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMembers("t1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]!.username).toBe("alice");
    expect(api.fetchOrgTeamMembers).toHaveBeenCalledWith("org1", "t1");
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe("useInviteMember", () => {
  it("creates an invitation and invalidates org-invitations", async () => {
    setOrganizations([org1]);
    vi.mocked(api.createOrgInvitation).mockResolvedValue({ id: "inv1", email: "bob@example.com", roles: ["member"], created_at: null });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useInviteMember(), { wrapper });
    await result.current.mutateAsync({ email: "bob@example.com", role: "member" });
    expect(api.createOrgInvitation).toHaveBeenCalledWith("org1", "bob@example.com", "member");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-invitations", "org1"] }));
  });
});

describe("useCancelInvitation", () => {
  it("cancels an invitation and invalidates org-invitations", async () => {
    setOrganizations([org1]);
    vi.mocked(api.cancelOrgInvitation).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCancelInvitation(), { wrapper });
    await result.current.mutateAsync("inv1");
    expect(api.cancelOrgInvitation).toHaveBeenCalledWith("org1", "inv1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-invitations", "org1"] }));
  });
});

describe("useUpdateMemberRole", () => {
  it("updates a member's role and invalidates org-members", async () => {
    setOrganizations([org1]);
    vi.mocked(api.updateOrgMemberRole).mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateMemberRole(), { wrapper });
    await result.current.mutateAsync({ userId: "u1", role: "admin" });
    expect(api.updateOrgMemberRole).toHaveBeenCalledWith("org1", "u1", "admin");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-members", "org1"] }));
  });
});

describe("useRemoveMember", () => {
  it("removes a member and invalidates org-members", async () => {
    setOrganizations([org1]);
    vi.mocked(api.removeOrgMember).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveMember(), { wrapper });
    await result.current.mutateAsync("u1");
    expect(api.removeOrgMember).toHaveBeenCalledWith("org1", "u1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-members", "org1"] }));
  });
});

describe("useCreateTeam", () => {
  it("creates a team and invalidates org-teams", async () => {
    setOrganizations([org1]);
    vi.mocked(api.createOrgTeam).mockResolvedValue({ id: "t1", name: "Team 1", organization_id: "org1", created_at: "2024-01-01T00:00:00Z" });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCreateTeam(), { wrapper });
    await result.current.mutateAsync("Team 1");
    expect(api.createOrgTeam).toHaveBeenCalledWith("org1", "Team 1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-teams", "org1"] }));
  });
});

describe("useUpdateTeam", () => {
  it("updates a team and invalidates org-teams", async () => {
    setOrganizations([org1]);
    vi.mocked(api.updateOrgTeam).mockResolvedValue({ id: "t1", name: "New Name", organization_id: "org1", created_at: "2024-01-01T00:00:00Z" });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateTeam(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", name: "New Name" });
    expect(api.updateOrgTeam).toHaveBeenCalledWith("org1", "t1", "New Name");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-teams", "org1"] }));
  });
});

describe("useRemoveTeam", () => {
  it("removes a team and invalidates org-teams", async () => {
    setOrganizations([org1]);
    vi.mocked(api.removeOrgTeam).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveTeam(), { wrapper });
    await result.current.mutateAsync("t1");
    expect(api.removeOrgTeam).toHaveBeenCalledWith("org1", "t1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-teams", "org1"] }));
  });
});

describe("useAddTeamMember", () => {
  it("adds a team member and invalidates that team's members", async () => {
    setOrganizations([org1]);
    vi.mocked(api.addOrgTeamMember).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAddTeamMember(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", userId: "u1" });
    expect(api.addOrgTeamMember).toHaveBeenCalledWith("org1", "t1", "u1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-team-members", "org1", "t1"] }));
  });
});

describe("useRemoveTeamMember", () => {
  it("removes a team member and invalidates that team's members", async () => {
    setOrganizations([org1]);
    vi.mocked(api.removeOrgTeamMember).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveTeamMember(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", userId: "u1" });
    expect(api.removeOrgTeamMember).toHaveBeenCalledWith("org1", "t1", "u1");
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["org-team-members", "org1", "t1"] }));
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks — no active organization (covers the `?? null` fallback
// branch of `useActiveOrganization()?.id` shared by every mutation hook)
// ---------------------------------------------------------------------------

describe("mutation hooks with no active organization", () => {
  it("useUpdateMemberRole passes null as the organization id", async () => {
    vi.mocked(api.updateOrgMemberRole).mockResolvedValue({ ok: true });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateMemberRole(), { wrapper });
    await result.current.mutateAsync({ userId: "u1", role: "admin" });
    expect(api.updateOrgMemberRole).toHaveBeenCalledWith(null, "u1", "admin");
  });

  it("useRemoveMember passes null as the organization id", async () => {
    vi.mocked(api.removeOrgMember).mockResolvedValue(undefined);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveMember(), { wrapper });
    await result.current.mutateAsync("u1");
    expect(api.removeOrgMember).toHaveBeenCalledWith(null, "u1");
  });

  it("useInviteMember passes null as the organization id", async () => {
    vi.mocked(api.createOrgInvitation).mockResolvedValue({ id: "inv1", email: "bob@example.com", roles: ["member"], created_at: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInviteMember(), { wrapper });
    await result.current.mutateAsync({ email: "bob@example.com", role: "member" });
    expect(api.createOrgInvitation).toHaveBeenCalledWith(null, "bob@example.com", "member");
  });

  it("useCancelInvitation passes null as the organization id", async () => {
    vi.mocked(api.cancelOrgInvitation).mockResolvedValue(undefined);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelInvitation(), { wrapper });
    await result.current.mutateAsync("inv1");
    expect(api.cancelOrgInvitation).toHaveBeenCalledWith(null, "inv1");
  });

  it("useCreateTeam passes null as the organization id", async () => {
    vi.mocked(api.createOrgTeam).mockResolvedValue({ id: "t1", name: "Team 1", organization_id: "org1", created_at: "2024-01-01T00:00:00Z" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateTeam(), { wrapper });
    await result.current.mutateAsync("Team 1");
    expect(api.createOrgTeam).toHaveBeenCalledWith(null, "Team 1");
  });

  it("useUpdateTeam passes null as the organization id", async () => {
    vi.mocked(api.updateOrgTeam).mockResolvedValue({ id: "t1", name: "New Name", organization_id: "org1", created_at: "2024-01-01T00:00:00Z" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateTeam(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", name: "New Name" });
    expect(api.updateOrgTeam).toHaveBeenCalledWith(null, "t1", "New Name");
  });

  it("useRemoveTeam passes null as the organization id", async () => {
    vi.mocked(api.removeOrgTeam).mockResolvedValue(undefined);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveTeam(), { wrapper });
    await result.current.mutateAsync("t1");
    expect(api.removeOrgTeam).toHaveBeenCalledWith(null, "t1");
  });

  it("useAddTeamMember passes null as the organization id", async () => {
    vi.mocked(api.addOrgTeamMember).mockResolvedValue(undefined);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddTeamMember(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", userId: "u1" });
    expect(api.addOrgTeamMember).toHaveBeenCalledWith(null, "t1", "u1");
  });

  it("useRemoveTeamMember passes null as the organization id", async () => {
    vi.mocked(api.removeOrgTeamMember).mockResolvedValue(undefined);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemoveTeamMember(), { wrapper });
    await result.current.mutateAsync({ teamId: "t1", userId: "u1" });
    expect(api.removeOrgTeamMember).toHaveBeenCalledWith(null, "t1", "u1");
  });
});
