"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Pencil, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useActiveOrganization,
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
  type OrgMember,
  type OrgTeam,
  type OrgRoleName,
} from "@/hooks/use-organization";
import { useFormModal } from "@/hooks/use-form-modal";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose, DialogTrigger,
} from "@workspace/ui/components/dialog";

const ROLES = ["owner", "admin", "member"] as const;

function roleLabel(t: ReturnType<typeof useT>["t"], role: string): string {
  switch (role) {
    case "owner": return t("settings.org.role_owner");
    case "admin": return t("settings.org.role_admin");
    case "member": return t("settings.org.role_member");
    default: return role;
  }
}

export function OrganizationSettings() {
  const { t } = useT();
  const org = useActiveOrganization();

  if (!org) {
    return <div className="text-muted-foreground text-sm">{t("settings.org.no_org")}</div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <MembersSection />
      <InvitationsSection />
      <TeamsSection />
    </div>
  );
}

function MembersSection() {
  const { t } = useT();
  const user = useCurrentUser();
  const members = useOrgMembers();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const inviteMember = useInviteMember();

  const [inviteModal, inviteActions] = useFormModal<null>();
  const [removeModal, removeActions] = useFormModal<OrgMember>();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRoleName>("member");

  function openInvite() {
    setEmail(""); setRole("member");
    inviteActions.openNew();
  }

  async function handleInvite() {
    if (!email.trim()) return;
    const trimmed = email.trim();
    await inviteActions.run(async () => {
      await inviteMember.mutateAsync({ email: trimmed, role });
      toast.success(t("settings.org.invite_sent", { email: trimmed }));
    });
  }

  async function handleRoleChange(member: OrgMember, newRole: string) {
    if (newRole === member.role) return;
    try {
      await updateRole.mutateAsync({ userId: member.user_id, role: newRole as OrgRoleName });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRemove() {
    if (!removeModal.target) return;
    await removeActions.run(async () => {
      await removeMember.mutateAsync(removeModal.target!.user_id);
      toast.success(t("settings.org.member_removed"));
    });
  }

  const memberList = members.data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{t("settings.org.members_title")}</h2>
          <p className="text-muted-foreground text-[12px] mt-0.5">
            {t("settings.org.members_count", { n: memberList.length, s: memberList.length !== 1 ? "s" : "" })}
          </p>
        </div>

        <Dialog open={inviteModal.open} onOpenChange={(o) => !o && inviteActions.close()}>
          <DialogTrigger render={<Button size="sm" onClick={openInvite} />}>
            <Plus className="size-4" /> {t("settings.org.invite_btn")}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.org.invite_title")}</DialogTitle>
              <DialogDescription>{t("settings.org.invite_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-email">{t("settings.org.invite_email")} *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@example.com"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("settings.org.invite_role")}</Label>
                <Select value={role} onValueChange={(v) => setRole((v as OrgRoleName) ?? "member")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(t, r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {inviteModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{inviteModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleInvite} disabled={inviteModal.isPending || !email.trim()}>
                {inviteModal.isPending ? t("common.creating") : t("settings.org.invite_btn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
        {memberList.map((member) => (
          <div key={member.user_id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{member.username}</p>
              {member.email && <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>}
            </div>
            <Select value={member.role ?? "member"} onValueChange={(v) => v && handleRoleChange(member, v)}>
              <SelectTrigger size="sm" className="w-36" disabled={member.user_id === user?.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(t, r)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => removeActions.openWith(member)}
              disabled={member.user_id === user?.id}
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={removeModal.open} onOpenChange={(o) => !o && removeActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.org.remove_member_title")}</DialogTitle>
            <DialogDescription>
              {t("settings.org.remove_member_desc", { name: removeModal.target?.username || removeModal.target?.email || "" })}
            </DialogDescription>
          </DialogHeader>
          {removeModal.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{removeModal.error}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleRemove} disabled={removeModal.isPending}>
              {removeModal.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function InvitationsSection() {
  const { t } = useT();
  const invitations = useOrgInvitations();
  const cancelInvitation = useCancelInvitation();
  const pending = invitations.data ?? [];

  if (pending.length === 0) return null;

  async function handleCancel(id: string) {
    try {
      await cancelInvitation.mutateAsync(id);
      toast.success(t("settings.org.invitation_canceled"));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{t("settings.org.invitations_title")}</h2>
      <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
        {pending.map((inv) => (
          <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{inv.email}</p>
              <p className="text-[11px] text-muted-foreground truncate">{roleLabel(t, inv.roles[0] ?? "member")}</p>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => handleCancel(inv.id)} aria-label={t("settings.org.cancel_invitation")}>
              <X className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamsSection() {
  const { t } = useT();
  const teams = useTeams();
  const members = useOrgMembers();
  const createTeam = useCreateTeam();

  const [createModal, createActions] = useFormModal<null>();
  const [name, setName] = useState("");

  function openCreate() {
    setName("");
    createActions.openNew();
  }

  async function handleCreate() {
    if (!name.trim()) return;
    const trimmed = name.trim();
    await createActions.run(async () => {
      await createTeam.mutateAsync(trimmed);
      toast.success(t("settings.org.team_created", { name: trimmed }));
    });
  }

  const orgMembers = members.data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold">{t("settings.org.teams_title")}</h2>

        <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
          <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
            <Plus className="size-4" /> {t("settings.org.team_new_btn")}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.org.team_new_title")}</DialogTitle>
              <DialogDescription>{t("settings.org.team_new_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 py-2">
              <Label htmlFor="team-name">{t("settings.org.team_name")} *</Label>
              <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            {createModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={createModal.isPending || !name.trim()}>
                {createModal.isPending ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.isLoading ? (
        <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
      ) : teams.data && teams.data.length > 0 ? (
        <div className="space-y-3">
          {teams.data.map((team) => <TeamCard key={team.id} team={team} orgMembers={orgMembers} />)}
        </div>
      ) : (
        <p className="text-muted-foreground text-[13px]">{t("settings.org.teams_empty")}</p>
      )}
    </section>
  );
}

function TeamCard({ team, orgMembers }: { team: OrgTeam; orgMembers: OrgMember[] }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const teamMembers = useTeamMembers(expanded ? team.id : null);
  const updateTeam = useUpdateTeam();
  const removeTeam = useRemoveTeam();
  const addTeamMember = useAddTeamMember();
  const removeTeamMember = useRemoveTeamMember();

  const [renameModal, renameActions] = useFormModal<null>();
  const [deleteModal, deleteActions] = useFormModal<null>();
  const [name, setName] = useState(team.name);

  function openRename() {
    setName(team.name);
    renameActions.openNew();
  }

  async function handleRename() {
    if (!name.trim()) return;
    const trimmed = name.trim();
    await renameActions.run(async () => {
      await updateTeam.mutateAsync({ teamId: team.id, name: trimmed });
    });
  }

  async function handleDelete() {
    await deleteActions.run(async () => {
      await removeTeam.mutateAsync(team.id);
    });
  }

  const memberIds = new Set((teamMembers.data ?? []).map((m) => m.user_id));

  async function toggleMember(userId: string, inTeam: boolean) {
    try {
      if (inTeam) {
        await removeTeamMember.mutateAsync({ teamId: team.id, userId });
      } else {
        await addTeamMember.mutateAsync({ teamId: team.id, userId });
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2.5">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <ChevronDown className={`size-3.5 text-muted-foreground transition-transform shrink-0 ${expanded ? "" : "-rotate-90"}`} />
          <span className="text-[13px] font-medium truncate">{team.name}</span>
        </button>

        <Dialog open={renameModal.open} onOpenChange={(o) => !o && renameActions.close()}>
          <DialogTrigger render={<Button variant="ghost" size="icon-xs" onClick={openRename} aria-label={t("common.edit")} />}>
            <Pencil className="size-3.5" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.org.team_rename_title")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 py-2">
              <Label htmlFor={`team-name-${team.id}`}>{t("settings.org.team_name")} *</Label>
              <Input id={`team-name-${team.id}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            {renameModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{renameModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleRename} disabled={renameModal.isPending || !name.trim()}>
                {renameModal.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
          <DialogTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => deleteActions.openNew()} aria-label={t("common.delete")} />}>
            <Trash2 className="size-3.5 text-destructive" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("settings.org.team_delete_title")}</DialogTitle>
              <DialogDescription>{t("settings.org.team_delete_desc", { name: team.name })}</DialogDescription>
            </DialogHeader>
            {deleteModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteModal.isPending}>
                {deleteModal.isPending ? t("common.deleting") : t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {orgMembers.map((m) => {
            const inTeam = memberIds.has(m.user_id);
            return (
              <label key={m.user_id} className="flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted/50">
                <input type="checkbox" checked={inTeam} onChange={() => toggleMember(m.user_id, inTeam)} className="size-3.5" />
                <span className="flex-1 min-w-0 truncate">{m.username || m.email}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
