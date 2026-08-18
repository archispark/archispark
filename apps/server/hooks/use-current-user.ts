"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
}

// Goes through the shared `get()` helper so an expired access_token cookie
// (15min TTL) gets silently refreshed and retried, same as every other API
// call — a bare fetch() here would 401 on the first background refetch after
// 15min on one page and misreport platform_admin as logged out.
async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await get<CurrentUser>("/auth/me");
  } catch {
    return null;
  }
}

export function useCurrentUser(): CurrentUser | null {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
  return data ?? null;
}

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user?.role === "platform_admin";
}
