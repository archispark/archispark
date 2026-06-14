"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrgRoleName } from "@workspace/auth";
import {
  fetchOrgMembers,
  updateOrgMemberRole,
  removeOrgMember,
  fetchOrgInvitations,
  createOrgInvitation,
  cancelOrgInvitation,
  fetchOrgTeams,
  createOrgTeam,
  updateOrgTeam,
  removeOrgTeam,
  fetchOrgTeamMembers,
  addOrgTeamMember,
  removeOrgTeamMember,
  type OrgMemberOut,
  type OrgInvitationOut,
  type OrgTeamOut,
  type OrgTeamMemberOut,
} from "@/lib/api";
import { useCurrentUser, useIsAdmin, type CurrentUserOrganization } from "./use-current-user";

export type { OrgRoleName };
export type OrgMember = OrgMemberOut;
export type OrgInvitation = OrgInvitationOut;
export type OrgTeam = OrgTeamOut;
export type OrgTeamMember = OrgTeamMemberOut;
export type ActiveOrganization = CurrentUserOrganization;

const ACTIVE_ORG_COOKIE = "active_org";

function readActiveOrgCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )active_org=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function writeActiveOrgCookie(id: string): void {
  document.cookie = `${ACTIVE_ORG_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** All organizations the current user belongs to (from `/api/auth/me`). */
export function useOrganizations(): CurrentUserOrganization[] {
  const user = useCurrentUser();
  return user?.organizations ?? [];
}

/**
 * The organization the current request should operate in: the one matching
 * the non-httpOnly `active_org` cookie (org switcher), or the user's first
 * organization if none is set yet.
 */
export function useActiveOrganization(): ActiveOrganization | null {
  const organizations = useOrganizations();
  if (organizations.length === 0) return null;
  const activeId = readActiveOrgCookie();
  return organizations.find((o) => o.id === activeId) ?? organizations[0]!;
}

export function useOrgRole(): OrgRoleName | null {
  return useActiveOrganization()?.role ?? null;
}

export function useIsOrgAdmin(): boolean {
  const isSuperAdmin = useIsAdmin();
  const role = useOrgRole();
  return isSuperAdmin || role === "owner" || role === "admin";
}

/** Switches the active organization by writing the `active_org` cookie and refreshing queries. */
export function useSetActiveOrganization(): (organizationId: string) => void {
  const qc = useQueryClient();
  return useCallback(
    (organizationId: string) => {
      writeActiveOrgCookie(organizationId);
      qc.invalidateQueries();
    },
    [qc],
  );
}

/**
 * Ensures the `active_org` cookie is set once the user's organizations are
 * known, so the org-scoped UI (and `X-Org-Id` requests) has a workspace to
 * operate in even before the user ever opens the org switcher.
 */
export function useAutoActivateOrganization(): void {
  const organizations = useOrganizations();
  const setActiveOrg = useSetActiveOrganization();
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current || organizations.length === 0) return;
    if (readActiveOrgCookie()) return;
    triedRef.current = true;
    setActiveOrg(organizations[0]!.id);
  }, [organizations, setActiveOrg]);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function useOrgMembers() {
  const orgId = useActiveOrganization()?.id ?? null;
  return useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => fetchOrgMembers(orgId!),
    enabled: !!orgId,
  });
}

export function useUpdateMemberRole() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRoleName }) => updateOrgMemberRole(orgId!, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}

export function useRemoveMember() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeOrgMember(orgId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export function useOrgInvitations() {
  const orgId = useActiveOrganization()?.id ?? null;
  return useQuery({
    queryKey: ["org-invitations", orgId],
    queryFn: () => fetchOrgInvitations(orgId!),
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRoleName }) => createOrgInvitation(orgId!, email, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invitations", orgId] }),
  });
}

export function useCancelInvitation() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => cancelOrgInvitation(orgId!, invitationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invitations", orgId] }),
  });
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function useTeams() {
  const orgId = useActiveOrganization()?.id ?? null;
  return useQuery({
    queryKey: ["org-teams", orgId],
    queryFn: () => fetchOrgTeams(orgId!),
    enabled: !!orgId,
  });
}

export function useTeamMembers(teamId: string | null) {
  const orgId = useActiveOrganization()?.id ?? null;
  return useQuery({
    queryKey: ["org-team-members", orgId, teamId],
    queryFn: () => fetchOrgTeamMembers(orgId!, teamId!),
    enabled: !!orgId && !!teamId,
  });
}

export function useCreateTeam() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createOrgTeam(orgId!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-teams", orgId] }),
  });
}

export function useUpdateTeam() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) => updateOrgTeam(orgId!, teamId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-teams", orgId] }),
  });
}

export function useRemoveTeam() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => removeOrgTeam(orgId!, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-teams", orgId] }),
  });
}

export function useAddTeamMember() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => addOrgTeamMember(orgId!, teamId, userId),
    onSuccess: (_data, { teamId }) => qc.invalidateQueries({ queryKey: ["org-team-members", orgId, teamId] }),
  });
}

export function useRemoveTeamMember() {
  const orgId = useActiveOrganization()?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => removeOrgTeamMember(orgId!, teamId, userId),
    onSuccess: (_data, { teamId }) => qc.invalidateQueries({ queryKey: ["org-team-members", orgId, teamId] }),
  });
}
