"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrgRoleName } from "@workspace/auth";

export interface CurrentUserOrganization {
  id: string;
  name: string;
  role: OrgRoleName;
}

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  organizations: CurrentUserOrganization[];
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as CurrentUser;
}

export function useCurrentUserQuery(): { data: CurrentUser | null; isPending: boolean } {
  const { data, isPending } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
  return { data: data ?? null, isPending };
}

export function useCurrentUser(): CurrentUser | null {
  return useCurrentUserQuery().data;
}

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user?.role === "platform_admin";
}
