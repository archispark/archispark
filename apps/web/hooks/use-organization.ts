"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useIsAdmin } from "./use-current-user";

export type OrgRoleName = "owner" | "admin" | "member";

export interface OrgMember {
  id: string;
  organizationId: string;
  role: string;
  createdAt: string | Date;
  userId: string;
  teamId?: string;
  user: { id: string; email: string; name: string; image?: string | null };
}

export interface OrgInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  inviterId: string;
  expiresAt: string | Date;
  teamId?: string;
}

export interface OrgTeam {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
}

export interface OrgTeamMember {
  id: string;
  teamId: string;
  userId: string;
  createdAt: string | Date;
}

export interface OrgMetadata {
  description?: string;
  [key: string]: unknown;
}

export interface ActiveOrganization {
  id: string;
  name: string;
  createdAt: string | Date;
  logo?: string | null;
  metadata?: OrgMetadata | null;
  members: OrgMember[];
  invitations: OrgInvitation[];
}

export interface OrganizationListItem {
  id: string;
  name: string;
  createdAt: string | Date;
  logo?: string | null;
  metadata?: OrgMetadata | null;
}

async function unwrap<T>(
  promise: Promise<{ data: T | null; error: { message?: string } | null }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message ?? "Request failed");
  return data as T;
}

export function useActiveOrganization(): ActiveOrganization | null {
  const { data } = authClient.useActiveOrganization();
  return (data as unknown as ActiveOrganization | null) ?? null;
}

export function useOrganizations(): OrganizationListItem[] {
  const { data } = authClient.useListOrganizations();
  return (data as unknown as OrganizationListItem[] | null) ?? [];
}

export function useOrgRole(): string | null {
  const { data } = authClient.useActiveMemberRole();
  return data?.role ?? null;
}

export function useIsOrgAdmin(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isSuperAdmin = useIsAdmin();
  const role = useOrgRole();
  return mounted && (isSuperAdmin || role === "owner" || role === "admin");
}

export function useTeams() {
  const activeOrg = useActiveOrganization();
  const orgId = activeOrg?.id;
  return useQuery({
    queryKey: ["org-teams", orgId],
    queryFn: () => unwrap<OrgTeam[]>(authClient.organization.listTeams()),
    enabled: !!orgId,
  });
}

export function useTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: ["org-team-members", teamId],
    queryFn: () => unwrap<OrgTeamMember[]>(authClient.organization.listTeamMembers({ query: { teamId: teamId! } })),
    enabled: !!teamId,
  });
}

export function useSetActiveOrganization() {
  return useMutation({
    mutationFn: (organizationId: string) => unwrap(authClient.organization.setActive({ organizationId })),
  });
}

/**
 * Better Auth's org-scoped hooks (`useActiveOrganization`, `useActiveMemberRole`,
 * and therefore `useIsOrgAdmin`) all key off `session.activeOrganizationId`,
 * which stays unset until `organization.setActive` is called at least once.
 * `OrgSwitcher` only renders (and calls it) when a user belongs to 2+ orgs, so
 * single-org members/admins/owners never get an active org and silently fall
 * back to "no role" — e.g. an org admin/owner sees the read-only UI. Activate
 * the user's first organization automatically once, the first time none is set.
 */
export function useAutoActivateOrganization(): void {
  const organizations = useOrganizations();
  const activeOrg = useActiveOrganization();
  const setActiveOrg = useSetActiveOrganization();
  const qc = useQueryClient();
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current || activeOrg || organizations.length === 0) return;
    triedRef.current = true;
    setActiveOrg.mutate(organizations[0]!.id, {
      onSuccess: () => qc.invalidateQueries(),
    });
  }, [activeOrg, organizations, setActiveOrg, qc]);
}

export function useInviteMember() {
  return useMutation({
    mutationFn: (body: { email: string; role: OrgRoleName; teamId?: string }) =>
      unwrap(authClient.organization.inviteMember(body)),
  });
}

export function useCancelInvitation() {
  return useMutation({
    mutationFn: (invitationId: string) => unwrap(authClient.organization.cancelInvitation({ invitationId })),
  });
}

export function useUpdateMemberRole() {
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRoleName }) =>
      unwrap(authClient.organization.updateMemberRole({ memberId, role })),
  });
}

export function useRemoveMember() {
  return useMutation({
    mutationFn: (memberIdOrEmail: string) => unwrap(authClient.organization.removeMember({ memberIdOrEmail })),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(authClient.organization.createTeam({ name })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-teams"] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) =>
      unwrap(authClient.organization.updateTeam({ teamId, data: { name } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-teams"] }),
  });
}

export function useRemoveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => unwrap(authClient.organization.removeTeam({ teamId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-teams"] }),
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      unwrap(authClient.organization.addTeamMember({ teamId, userId })),
    onSuccess: (_data, { teamId }) => qc.invalidateQueries({ queryKey: ["org-team-members", teamId] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      unwrap(authClient.organization.removeTeamMember({ teamId, userId })),
    onSuccess: (_data, { teamId }) => qc.invalidateQueries({ queryKey: ["org-team-members", teamId] }),
  });
}
