"use client";

import { useSession } from "@/lib/auth-client";

export interface CurrentUser {
  id: string;
  username: string;
  role: string;
}

export function useCurrentUser(): CurrentUser | null {
  const { data } = useSession();
  if (!data?.user) return null;
  const u = data.user as unknown as { id: string; name: string; username?: string; role?: string };
  return {
    id: u.id,
    username: u.username ?? u.name,
    role: u.role ?? "user",
  };
}

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user?.role === "admin";
}
