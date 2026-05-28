"use client";

import { useState, useEffect } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/api";

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    setUser(getCurrentUser());
  }, []);
  return user;
}

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  return user?.role === "admin";
}
