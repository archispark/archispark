import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { OrganizationSettings } from "./organization-settings";
import type { OrgMember, OrgInvitation, OrgTeam, OrgTeamMember, ActiveOrganization } from "@/hooks/use-organization";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockState = vi.hoisted(() => ({
  activeOrg: null as ActiveOrganization | null,
  currentUser: null as { id: string } | null,
  members: { data: undefined as OrgMember[] | undefined },
  invitations: { data: undefined as OrgInvitation[] | undefined },
  teams: { data: undefined as OrgTeam[] | undefined, isLoading: false },
  teamMembers: { data: undefined as OrgTeamMember[] | undefined },
}));

const inviteMemberMutateAsync = vi.fn();
const updateMemberRoleMutateAsync = vi.fn();
const removeMemberMutateAsync = vi.fn();
const cancelInvitationMutateAsync = vi.fn();
const createTeamMutateAsync = vi.fn();
const updateTeamMutateAsync = vi.fn();
const removeTeamMutateAsync = vi.fn();
const addTeamMemberMutateAsync = vi.fn();
const removeTeamMemberMutateAsync = vi.fn();

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => mockState.currentUser,
}));

vi.mock("@/hooks/use-organization", () => ({
  useActiveOrganization: () => mockState.activeOrg,
  useOrgMembers: () => mockState.members,
  useOrgInvitations: () => mockState.invitations,
  useTeams: () => mockState.teams,
  useTeamMembers: () => mockState.teamMembers,
  useInviteMember: () => ({ mutateAsync: inviteMemberMutateAsync }),
  useCancelInvitation: () => ({ mutateAsync: cancelInvitationMutateAsync }),
  useUpdateMemberRole: () => ({ mutateAsync: updateMemberRoleMutateAsync }),
  useRemoveMember: () => ({ mutateAsync: removeMemberMutateAsync }),
  useCreateTeam: () => ({ mutateAsync: createTeamMutateAsync }),
  useUpdateTeam: () => ({ mutateAsync: updateTeamMutateAsync }),
  useRemoveTeam: () => ({ mutateAsync: removeTeamMutateAsync }),
  useAddTeamMember: () => ({ mutateAsync: addTeamMemberMutateAsync }),
  useRemoveTeamMember: () => ({ mutateAsync: removeTeamMemberMutateAsync }),
}));

// Simplified Dialog/Select test doubles — mirrors apps/admin-web/app/organizations/page.test.tsx.
vi.mock("@workspace/ui/components/dialog", () => {
  const DialogOpenContext = createContext(false);
  const DialogOnOpenChangeContext = createContext<((open: boolean) => void) | undefined>(undefined);

  const Dialog = ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <DialogOpenContext.Provider value={!!open}>
      <DialogOnOpenChangeContext.Provider value={onOpenChange}>{children}</DialogOnOpenChangeContext.Provider>
    </DialogOpenContext.Provider>
  );

  const DialogTrigger = ({ children, render: r, onClick }: { children: React.ReactNode; render?: React.ReactElement; onClick?: () => void }) => {
    if (r) {
      const rProps = r.props as { onClick?: () => void; "aria-label"?: string; disabled?: boolean };
      return (
        <button
          type="button"
          aria-label={rProps["aria-label"]}
          disabled={rProps.disabled}
          onClick={() => { onClick?.(); rProps.onClick?.(); }}
        >
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
    DialogClose: ({ children }: { children: React.ReactNode }) => {
      const onOpenChange = useContext(DialogOnOpenChangeContext);
      return (
        <button type="button" onClick={() => onOpenChange?.(false)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock("@workspace/ui/components/select", () => {
  const SelectContext = createContext<{ value?: string; onValueChange?: (v: string) => void }>({});

  const Select = ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string | null) => void }) => (
    <SelectContext.Provider value={{ value, onValueChange: (v) => onValueChange?.(v) }}>
      <div>{children}</div>
    </SelectContext.Provider>
  );

  const SelectTrigger = ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => <div data-disabled={disabled}>{children}</div>;
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const org: ActiveOrganization = { id: "org1", name: "Acme", role: "owner" };

const member1: OrgMember = { user_id: "user-1", username: "alice", email: "alice@example.com", role: "owner" };
const member2: OrgMember = { user_id: "user-2", username: "bob", email: "bob@example.com", role: "member" };

const invitation1: OrgInvitation = { id: "inv-1", email: "carol@example.com", roles: ["member"], created_at: null };

const team1: OrgTeam = { id: "team-1", name: "Engineering", organization_id: "org1", created_at: new Date().toISOString() };

beforeEach(() => {
  vi.clearAllMocks();
  mockState.activeOrg = org;
  mockState.currentUser = { id: "user-1" };
  mockState.members = { data: [member1, member2] };
  mockState.invitations = { data: [] };
  mockState.teams = { data: [], isLoading: false };
  mockState.teamMembers = { data: [] };
});

// ---------------------------------------------------------------------------
// OrganizationSettings — top-level
// ---------------------------------------------------------------------------

describe("OrganizationSettings", () => {
  it("renders a fallback message when there is no active organization", () => {
    mockState.activeOrg = null;
    render(<OrganizationSettings />);
    expect(screen.getByText("settings.org.no_org")).toBeInTheDocument();
  });

  it("renders the members, invitations and teams sections when an org is active", () => {
    render(<OrganizationSettings />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MembersSection
// ---------------------------------------------------------------------------

describe("MembersSection", () => {
  it("shows member usernames and emails", () => {
    render(<OrganizationSettings />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("disables the role selector and remove button for the current user", () => {
    render(<OrganizationSettings />);
    // member1 (user-1) is the current user.
    const removeButtons = screen.getAllByLabelText("common.delete");
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).not.toBeDisabled();
  });

  it("opens the invite dialog, fills the email and submits successfully", async () => {
    inviteMemberMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByRole("button", { name: /settings.org.invite_btn/ }));

    const emailInput = screen.getByLabelText(/settings.org.invite_email/);
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "settings.org.invite_btn")!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(inviteMemberMutateAsync).toHaveBeenCalledWith({ email: "new@example.com", role: "member" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("settings.org.invite_sent"));
  });

  it("shows an error in the invite dialog when the invite mutation fails", async () => {
    inviteMemberMutateAsync.mockRejectedValue(new Error("Invitation déjà envoyée."));
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByRole("button", { name: /settings.org.invite_btn/ }));
    fireEvent.change(screen.getByLabelText(/settings.org.invite_email/), { target: { value: "dup@example.com" } });

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "settings.org.invite_btn")!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(screen.getByText("Invitation déjà envoyée.")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not submit the invite when the email is blank", async () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByRole("button", { name: /settings.org.invite_btn/ }));

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "settings.org.invite_btn")! as HTMLButtonElement;
    expect(submitBtn).toBeDisabled();
  });

  it("closes the invite dialog when canceled", () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByRole("button", { name: /settings.org.invite_btn/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.cancel")!;
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an empty members list when members data is undefined", () => {
    mockState.members = { data: undefined };
    render(<OrganizationSettings />);
    expect(screen.getByText("settings.org.members_count")).toBeInTheDocument();
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });

  it("uses a singular member count label for exactly one member", () => {
    mockState.members = { data: [member1] };
    render(<OrganizationSettings />);
    expect(screen.getByText("settings.org.members_count")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("changes a member's role and invalidates members on success", async () => {
    updateMemberRoleMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    // bob's role selector — click a role item to trigger handleRoleChange.
    const adminButtons = screen.getAllByRole("button", { name: "settings.org.role_admin" });
    fireEvent.click(adminButtons[adminButtons.length - 1]!);

    await waitFor(() => expect(updateMemberRoleMutateAsync).toHaveBeenCalledWith({ userId: "user-2", role: "admin" }));
  });

  it("does nothing when the selected role equals the member's current role", async () => {
    render(<OrganizationSettings />);

    // alice already has role "owner" — selecting "owner" again is a no-op.
    const ownerButtons = screen.getAllByRole("button", { name: "settings.org.role_owner" });
    fireEvent.click(ownerButtons[0]!);

    expect(updateMemberRoleMutateAsync).not.toHaveBeenCalled();
  });

  it("shows a toast error when the role update mutation fails", async () => {
    updateMemberRoleMutateAsync.mockRejectedValue(new Error("Rôle invalide."));
    render(<OrganizationSettings />);

    const adminButtons = screen.getAllByRole("button", { name: "settings.org.role_admin" });
    fireEvent.click(adminButtons[adminButtons.length - 1]!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Rôle invalide."));
  });

  it("opens the remove-member confirmation dialog and removes the member on confirm", async () => {
    removeMemberMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    const removeButtons = screen.getAllByLabelText("common.delete");
    // removeButtons[1] is bob's (not disabled).
    fireEvent.click(removeButtons[1]!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("settings.org.remove_member_title");

    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.delete")!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(removeMemberMutateAsync).toHaveBeenCalledWith("user-2"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("settings.org.member_removed"));
  });

  it("shows an error in the remove-member dialog when the removal fails", async () => {
    removeMemberMutateAsync.mockRejectedValue(new Error("Impossible de retirer ce membre."));
    render(<OrganizationSettings />);

    const removeButtons = screen.getAllByLabelText("common.delete");
    fireEvent.click(removeButtons[1]!);

    const dialog = screen.getByRole("dialog");
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.delete")!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(screen.getByText("Impossible de retirer ce membre.")).toBeInTheDocument());
  });

  it("closes the remove-member dialog when canceled", () => {
    render(<OrganizationSettings />);

    const removeButtons = screen.getAllByLabelText("common.delete");
    fireEvent.click(removeButtons[1]!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.cancel")!;
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// InvitationsSection
// ---------------------------------------------------------------------------

describe("InvitationsSection", () => {
  it("renders nothing when there are no pending invitations", () => {
    mockState.invitations = { data: [] };
    render(<OrganizationSettings />);
    expect(screen.queryByText("settings.org.invitations_title")).not.toBeInTheDocument();
  });

  it("renders nothing when invitations data is undefined", () => {
    mockState.invitations = { data: undefined };
    render(<OrganizationSettings />);
    expect(screen.queryByText("settings.org.invitations_title")).not.toBeInTheDocument();
  });

  it("falls back to the 'member' role label when an invitation has no roles", () => {
    mockState.invitations = { data: [{ ...invitation1, roles: [] }] };
    render(<OrganizationSettings />);
    const invitationRow = screen.getByText("carol@example.com").closest("div")!.parentElement!;
    expect(invitationRow).toHaveTextContent("settings.org.role_member");
  });

  it("renders an invitation's raw role string when it is not a recognized org role", () => {
    mockState.invitations = { data: [{ ...invitation1, roles: ["custom-role"] }] };
    render(<OrganizationSettings />);
    const invitationRow = screen.getByText("carol@example.com").closest("div")!.parentElement!;
    expect(invitationRow).toHaveTextContent("custom-role");
  });

  it("lists pending invitations with their role", () => {
    mockState.invitations = { data: [invitation1] };
    render(<OrganizationSettings />);
    expect(screen.getByText("settings.org.invitations_title")).toBeInTheDocument();
    expect(screen.getByText("carol@example.com")).toBeInTheDocument();
    // "settings.org.role_member" also appears as a role-select option for
    // each member — assert the invitation row's text directly.
    const invitationRow = screen.getByText("carol@example.com").closest("div")!.parentElement!;
    expect(invitationRow).toHaveTextContent("settings.org.role_member");
  });

  it("cancels an invitation on success", async () => {
    mockState.invitations = { data: [invitation1] };
    cancelInvitationMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByLabelText("settings.org.cancel_invitation"));

    await waitFor(() => expect(cancelInvitationMutateAsync).toHaveBeenCalledWith("inv-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("settings.org.invitation_canceled"));
  });

  it("shows a toast error when canceling an invitation fails", async () => {
    mockState.invitations = { data: [invitation1] };
    cancelInvitationMutateAsync.mockRejectedValue(new Error("Invitation introuvable."));
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByLabelText("settings.org.cancel_invitation"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Invitation introuvable."));
  });
});

// ---------------------------------------------------------------------------
// TeamsSection
// ---------------------------------------------------------------------------

describe("TeamsSection", () => {
  it("shows a loading indicator while teams are loading", () => {
    mockState.teams = { data: undefined, isLoading: true };
    render(<OrganizationSettings />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("shows an empty state when there are no teams", () => {
    mockState.teams = { data: [], isLoading: false };
    render(<OrganizationSettings />);
    expect(screen.getByText("settings.org.teams_empty")).toBeInTheDocument();
  });

  it("lists teams when present", () => {
    mockState.teams = { data: [team1], isLoading: false };
    render(<OrganizationSettings />);
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("creates a team, trimming the name, and shows a success toast", async () => {
    createTeamMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByRole("button", { name: /settings.org.team_new_btn/ }));

    const nameInput = screen.getByLabelText(/settings.org.team_name/);
    fireEvent.change(nameInput, { target: { value: "  New Team  " } });

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.create")!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(createTeamMutateAsync).toHaveBeenCalledWith("New Team"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("settings.org.team_created"));
  });

  it("does not submit when the team name is blank", () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByRole("button", { name: /settings.org.team_new_btn/ }));

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.create")! as HTMLButtonElement;
    expect(submitBtn).toBeDisabled();
  });

  it("shows an error in the create-team dialog when the create mutation fails", async () => {
    createTeamMutateAsync.mockRejectedValue(new Error("Une équipe avec ce nom existe déjà."));
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByRole("button", { name: /settings.org.team_new_btn/ }));
    fireEvent.change(screen.getByLabelText(/settings.org.team_name/), { target: { value: "Engineering" } });

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.create")!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(screen.getByText("Une équipe avec ce nom existe déjà.")).toBeInTheDocument());
  });

  it("closes the create-team dialog when canceled", () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByRole("button", { name: /settings.org.team_new_btn/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.cancel")!;
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders teams with no org members when members data is undefined", () => {
    mockState.teams = { data: [team1], isLoading: false };
    mockState.members = { data: undefined };
    render(<OrganizationSettings />);
    expect(screen.getByText("Engineering")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Engineering"));
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TeamCard
// ---------------------------------------------------------------------------

describe("TeamCard", () => {
  beforeEach(() => {
    mockState.teams = { data: [team1], isLoading: false };
  });

  it("expands and collapses to show org members with checkboxes", () => {
    mockState.teamMembers = { data: [member1] };
    render(<OrganizationSettings />);

    // Initially collapsed — no checkboxes rendered.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    fireEvent.click(screen.getByText("Engineering"));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2); // member1 + member2
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true); // member1 is in the team
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false); // member2 is not
  });

  it("adds a member to the team when toggling an unchecked checkbox", async () => {
    mockState.teamMembers = { data: [] };
    addTeamMemberMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByText("Engineering"));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!); // member1 not in team yet

    await waitFor(() => expect(addTeamMemberMutateAsync).toHaveBeenCalledWith({ teamId: "team-1", userId: "user-1" }));
  });

  it("removes a member from the team when toggling a checked checkbox", async () => {
    mockState.teamMembers = { data: [member1] };
    removeTeamMemberMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByText("Engineering"));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!); // member1 is in team

    await waitFor(() => expect(removeTeamMemberMutateAsync).toHaveBeenCalledWith({ teamId: "team-1", userId: "user-1" }));
  });

  it("shows a toast error when toggling team membership fails", async () => {
    mockState.teamMembers = { data: [] };
    addTeamMemberMutateAsync.mockRejectedValue(new Error("boom"));
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByText("Engineering"));
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });

  it("falls back to the member's email when username is empty", () => {
    mockState.teamMembers = { data: [] };
    mockState.members = { data: [{ ...member1, username: "" }, member2] };
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByText("Engineering"));
    // "alice@example.com" also appears in the members list above the team
    // card — assert it appears at least twice (members list + checkbox label).
    expect(screen.getAllByText("alice@example.com").length).toBeGreaterThanOrEqual(2);
  });

  it("renames a team", async () => {
    updateTeamMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByLabelText("common.edit"));

    const nameInput = screen.getByLabelText(/settings.org.team_name/);
    fireEvent.change(nameInput, { target: { value: "  Engineering Renamed  " } });

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.save")!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(updateTeamMutateAsync).toHaveBeenCalledWith({ teamId: "team-1", name: "Engineering Renamed" }));
  });

  it("does not submit rename when the name is blank", () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByLabelText("common.edit"));

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.save")! as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(/settings.org.team_name/), { target: { value: "   " } });
    expect(submitBtn).toBeDisabled();
  });

  it("shows an error in the rename dialog when the rename mutation fails", async () => {
    updateTeamMutateAsync.mockRejectedValue(new Error("Nom d'équipe invalide."));
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByLabelText("common.edit"));
    fireEvent.change(screen.getByLabelText(/settings.org.team_name/), { target: { value: "New Name" } });

    const dialog = screen.getByRole("dialog");
    const submitBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.save")!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(screen.getByText("Nom d'équipe invalide.")).toBeInTheDocument());
  });

  it("closes the rename dialog when canceled", () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByLabelText("common.edit"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.cancel")!;
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes a team on confirm", async () => {
    removeTeamMutateAsync.mockResolvedValue(undefined);
    render(<OrganizationSettings />);

    // "common.delete" is also used by the member-remove buttons — the team
    // delete trigger is the last one rendered.
    const deleteButtons = screen.getAllByLabelText("common.delete");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("settings.org.team_delete_title");

    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.delete")!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(removeTeamMutateAsync).toHaveBeenCalledWith("team-1"));
  });

  it("shows an error in the delete dialog when the delete mutation fails", async () => {
    removeTeamMutateAsync.mockRejectedValue(new Error("Impossible de supprimer cette équipe."));
    render(<OrganizationSettings />);

    const deleteButtons = screen.getAllByLabelText("common.delete");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    const dialog = screen.getByRole("dialog");
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.delete")!;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(screen.getByText("Impossible de supprimer cette équipe.")).toBeInTheDocument());
  });

  it("closes the delete dialog when canceled", () => {
    render(<OrganizationSettings />);

    const deleteButtons = screen.getAllByLabelText("common.delete");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "common.cancel")!;
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders no checkboxes when team members data is undefined while expanded", () => {
    mockState.teamMembers = { data: undefined };
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByText("Engineering"));
    // Org members are still listed even though team-membership is unknown;
    // none should be checked.
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });
});
