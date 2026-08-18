"use client"

import { useState, useRef, useEffect } from "react"
import {
  LogOut,
  User,
  Building2,
  ShieldAlert,
  ChevronsUpDown,
} from "lucide-react"
import { useCurrentUser, useIsAdmin } from "@/hooks/use-current-user"
import { useMounted } from "@/hooks/use-mounted"
import { useOrganizations } from "@/lib/queries"
import { useT } from "@/lib/i18n"
import Link from "next/link"

export function UserMenu({
  placement = "down",
  display = "compact",
  align = "right",
}: {
  placement?: "up" | "down"
  display?: "compact" | "full"
  align?: "left" | "right"
}) {
  const user = useCurrentUser()
  const isAdmin = useIsAdmin()
  const { data: organizations = [] } = useOrganizations()
  const activeOrg = organizations.find((o) => o.active)
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mounted = useMounted()

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

  // React Query can restore the signed-in user from the browser cache before
  // hydration, while the server has no such cache. Defer user-specific text
  // until after the first client render so it matches the server markup.
  const currentUser = mounted ? user : null
  const initial = currentUser?.username?.[0]?.toUpperCase() ?? "?"

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Mon compte"
        className={
          display === "full"
            ? `flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted ${
                open ? "bg-muted" : ""
              }`
            : "flex size-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[13px] font-semibold text-primary transition-all hover:ring-2 hover:ring-primary/30"
        }
      >
        <span
          className={`flex size-8 shrink-0 items-center justify-center overflow-hidden bg-primary/10 text-[13px] font-semibold text-primary ${
            display === "full" ? "rounded-lg" : "rounded-full"
          }`}
        >
          {initial}
        </span>
        {display === "full" && (
          <>
            <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {currentUser?.name || currentUser?.username || "Mon compte"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {currentUser?.email || currentUser?.username || ""}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 w-56 rounded-lg border border-border bg-popover py-1 shadow-lg ${
            align === "left" ? "left-0" : "right-0"
          } ${placement === "up" ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          <div className="mb-1 border-b border-border px-3 py-2.5">
            <p className="truncate text-[13px] font-medium">
              {currentUser?.name || currentUser?.username}
            </p>
            {activeOrg && (
              <p className="truncate text-[11px] text-muted-foreground">
                {activeOrg.name}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground capitalize">
              {currentUser?.role}
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

          {isAdmin && (
            <Link
              href="/platform"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground no-underline transition-colors hover:bg-muted"
            >
              <ShieldAlert className="size-3.5 shrink-0 text-muted-foreground" />
              {t("platform.sidebar_badge")}
            </Link>
          )}

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
