"use client"

import Link from "next/link"
import { useId } from "react"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  Puzzle,
  Settings2,
  CircleHelp,
} from "lucide-react"
import { useT } from "@/lib/i18n"
import { RailLink } from "@/components/sidebar-section"
import { UserMenu } from "@/components/user-menu"

const NAV_ITEMS = [
  { href: "/platform", icon: LayoutDashboard, labelKey: "sidebar.overview" },
  {
    href: "/platform/organizations",
    icon: Building2,
    labelKey: "platform.title",
  },
  { href: "/platform/users", icon: Users, labelKey: "platform.users.title" },
  {
    href: "/platform/plugins",
    icon: Puzzle,
    labelKey: "platform.plugins.title",
  },
  {
    href: "/platform/settings",
    icon: Settings2,
    labelKey: "platform.settings.title",
  },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === "/platform"
    ? pathname === "/platform"
    : pathname === href || pathname.startsWith(`${href}/`)
}

/** Nav for the platform_admin administration area (/platform/*) — replaces the workspace Sidebar there, see client-layout.tsx. */
export function PlatformSidebar({
  open,
  onClose,
  collapsed,
}: {
  open: boolean
  onClose: () => void
  collapsed: boolean
}) {
  const pathname = usePathname()!
  const { t } = useT()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-[var(--sidebar-w)] ${collapsed ? "md:w-[var(--sidebar-w-collapsed,56px)] md:overflow-visible" : ""} flex flex-col overflow-y-auto border-r border-border bg-secondary transition-[width,transform] duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className={collapsed ? "contents md:hidden" : "contents"}>
          <div className="border-b border-border px-4 pt-4 pb-3">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center gap-2.5 no-underline"
            >
              <PlatformLogo size={22} />
              <span
                className="text-[17px] leading-none tracking-tight"
                style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
              >
                <span className="font-light text-foreground">Archi</span>
                <span className="font-bold text-primary">Spark</span>
              </span>
            </Link>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              {t("platform.sidebar_badge")}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`mx-2 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm no-underline transition-colors ${
                  isActive(pathname, href)
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {t(labelKey)}
              </Link>
            ))}
          </div>

          <div className="border-t border-border px-2 py-2">
            <a
              href="https://archispark.io/docs/"
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
            >
              <CircleHelp className="size-4 shrink-0" />
              Aide
            </a>
            <div className="mt-1 px-1">
              <UserMenu placement="up" display="full" />
            </div>
          </div>
        </div>

        <div
          className={`hidden flex-1 flex-col items-center gap-1 overflow-y-auto py-3 ${collapsed ? "md:flex md:overflow-visible" : ""}`}
        >
          <Link
            href="/"
            onClick={onClose}
            title="ArchiSpark"
            aria-label="ArchiSpark"
            className="mb-2 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
          >
            <PlatformLogo size={22} />
          </Link>
          <div className="mb-1 w-6 border-t border-border" />
          {NAV_ITEMS.map(({ href, icon, labelKey }) => (
            <RailLink
              key={href}
              href={href}
              icon={icon}
              label={t(labelKey)}
              active={isActive(pathname, href)}
              onClick={onClose}
            />
          ))}
        </div>

        <div
          className={`hidden flex-col items-center gap-1 border-t border-border py-2 ${collapsed ? "md:flex" : ""}`}
        >
          <a
            href="https://archispark.io/docs/"
            target="_blank"
            rel="noreferrer"
            title="Aide"
            aria-label="Aide"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CircleHelp className="size-4" />
          </a>
          <UserMenu placement="up" align="left" />
        </div>
      </aside>
    </>
  )
}

function PlatformLogo({ size }: { size: number }) {
  // Unique per instance — this component renders twice at once (expanded
  // header + collapsed rail, toggled with CSS, not unmount/remount). A
  // shared id would duplicate the <linearGradient>'s id in the DOM, and
  // Chrome resolves url(#id) to the first match — which is display:none
  // while collapsed, so the rail logo would paint with no fill at all.
  const gradientId = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FF1D5D" />
          <stop offset="50%" stopColor="#892FE8" />
          <stop offset="100%" stopColor="#1A87FF" />
        </linearGradient>
      </defs>
      <path
        d="M12 0 C12 7 13 11 24 12 C13 13 12 17 12 24 C12 17 11 13 0 12 C11 11 12 7 12 0 Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  )
}
