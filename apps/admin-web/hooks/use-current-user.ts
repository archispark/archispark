"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
}

export function useCurrentUser(): CurrentUser | null {
  const { data } = useSession();
  if (!data?.user) return null;
  const u = data.user as unknown as { id: string; name: string; email?: string | null; username?: string; role?: string };
  return {
    id: u.id,
    username: u.username ?? u.name,
    name: u.name,
    email: u.email ?? null,
    role: u.role ?? "user",
  };
}

export function useIsAdmin(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = useCurrentUser();
  return mounted && user?.role === "platform_admin";
}
