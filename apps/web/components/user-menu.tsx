"use client"

import { useState, useRef, useEffect } from "react"
import { LogOut, User, Building2 } from "lucide-react"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useOrganizations } from "@/lib/queries"
import { useT } from "@/lib/i18n"
import Link from "next/link"

export function UserMenu() {
  const user = useCurrentUser()
  const { data: organizations = [] } = useOrganizations()
  const activeOrg = organizations.find((o) => o.active)
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function logout() {
    window.location.href = "/api/auth/logout"
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? "?"

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[13px] font-semibold text-primary transition-all hover:ring-2 hover:ring-primary/30"
        aria-label="Mon compte"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-popover py-1 shadow-lg">
          <div className="mb-1 border-b border-border px-3 py-2.5">
            <p className="truncate text-[13px] font-medium">
              {user?.name || user?.username}
            </p>
            {activeOrg && (
              <p className="truncate text-[11px] text-muted-foreground">
                {activeOrg.name}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground capitalize">
              {user?.role}
            </p>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground no-underline transition-colors hover:bg-muted"
          >
            <User className="size-3.5 shrink-0 text-muted-foreground" />
            Mon profil
          </Link>

          <Link
            href="/organizations"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground no-underline transition-colors hover:bg-muted"
          >
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            {t("sidebar.organizations")}
          </Link>

          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive/10"
              onClick={() => {
                setOpen(false)
                logout()
              }}
            >
              <LogOut className="size-3.5 shrink-0" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
