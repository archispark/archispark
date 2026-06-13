"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

export function UserMenu() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function logout() {
    window.location.href = "/api/auth/logout";
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center size-8 rounded-full overflow-hidden bg-primary/10 text-primary hover:ring-2 hover:ring-primary/30 transition-all text-[13px] font-semibold"
        aria-label="Mon compte"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-popover border border-border rounded-lg shadow-lg py-1">
          <div className="px-3 py-2.5 border-b border-border mb-1">
            <p className="text-[13px] font-medium truncate">{user?.name || user?.username}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
          </div>

          <div className="pt-1">
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-destructive/10 text-destructive text-left transition-colors"
              onClick={() => { setOpen(false); logout(); }}
            >
              <LogOut className="size-3.5 shrink-0" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
