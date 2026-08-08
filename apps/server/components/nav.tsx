"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Menu, FolderOpen } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { type ElementOut } from "@/lib/api"
import { useWorkspaces, useElement, useView } from "@/lib/queries"
import { useT } from "@/lib/i18n"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"

export function Nav({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  // usePathname() is typed nullable only for pages/-router compat (this app
  // only calls it from app/ client components, where it's always populated).
  const pathname = usePathname()!
  const router = useRouter()
  const { t } = useT()

  const { data: workspaces = [], isSuccess: wsLoaded } = useWorkspaces()

  // No workspace exists (the user deleted them all) → redirect to the overview
  // page where one can be created.
  useEffect(() => {
    if (wsLoaded && workspaces.length === 0 && pathname !== "/workspaces") {
      router.push("/workspaces")
    }
  }, [wsLoaded, workspaces.length, pathname, router])

  const qc = useQueryClient()

  const activeWs = workspaces.find((w) => w.active)
  const segments = pathname.split("/").filter(Boolean)

  // On /elements/[id], resolve the element so the breadcrumb shows its name, not
  // the raw id. useElement is reactive (unlike qc.getQueryData), so the breadcrumb
  // updates as soon as it loads — fixing the intermittent id display.
  const elementId =
    segments[0] === "elements" && segments.length === 2
      ? decodeURIComponent(segments[1]!)
      : ""
  const { data: breadcrumbElement } = useElement(elementId)

  const viewId =
    segments[0] === "views" && segments.length === 2
      ? decodeURIComponent(segments[1]!)
      : ""
  const { data: breadcrumbView } = useView(viewId)

  function segmentLabel(seg: string, index: number): string {
    const bcKeys: Record<string, Parameters<typeof t>[0]> = {
      elements: "breadcrumb.elements",
      relationships: "breadcrumb.relationships",
      views: "breadcrumb.views",
      validator: "breadcrumb.validator",
      properties: "breadcrumb.properties",
      users: "breadcrumb.users",
      settings: "breadcrumb.settings",
      workspaces: "breadcrumb.workspaces",
      login: "breadcrumb.login",
      profile: "breadcrumb.profile",
    }
    if (bcKeys[seg]) return t(bcKeys[seg])
    if (segments[index - 1] === "elements") {
      const id = decodeURIComponent(seg)
      const name =
        (breadcrumbElement?.identifier === id
          ? breadcrumbElement?.name
          : undefined) ?? qc.getQueryData<ElementOut>(["element", id])?.name
      if (name) return name
      if (id === elementId) return "…"
    }
    if (segments[index - 1] === "views") {
      const id = decodeURIComponent(seg)
      const name =
        (breadcrumbView?.identifier === id
          ? breadcrumbView?.name
          : undefined) ??
        (
          qc.getQueryData<{ uuid: string; name: string }>(["view", id]) as
            | { name?: string }
            | undefined
        )?.name
      if (name) return name
      if (id === viewId) return "…"
    }
    return decodeURIComponent(seg)
  }

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 flex h-[var(--nav-h)] items-center gap-3 border-b border-border bg-secondary px-5">
      <button
        onClick={onToggleSidebar}
        className="flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="size-[18px]" />
      </button>

      <Link
        href="/workspaces"
        className="flex shrink-0 items-center gap-2.5 no-underline"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="turbo-spark"
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
            fill="url(#turbo-spark)"
          />
        </svg>
        <span
          className="text-[17px] leading-none tracking-tight"
          style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
        >
          <span className="font-light text-foreground">Archi</span>
          <span className="font-bold text-primary">Spark</span>
        </span>
      </Link>

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Unified breadcrumb: Workspaces / nom projet / Section / leaf */}
      {workspaces.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-hidden text-[13px] text-muted-foreground">
          <Link
            href="/workspaces"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap no-underline hover:text-foreground"
          >
            <FolderOpen className="size-3.5 shrink-0 text-primary" />
            {t("breadcrumb.workspaces")}
          </Link>

          {/* At the /workspaces root we are not inside a specific workspace. */}
          {pathname !== "/workspaces" && (
            <>
              <span className="text-border">/</span>
              {/* Active workspace = the workspace root: a plain link to its overview. */}
              <Link
                href="/"
                className="max-w-[160px] shrink-0 truncate no-underline hover:text-foreground"
              >
                {activeWs?.name ?? "—"}
              </Link>
              {segments.map((seg, i) => {
                const isLast = i === segments.length - 1
                const label = segmentLabel(seg, i)
                const href = "/" + segments.slice(0, i + 1).join("/")
                return (
                  <span
                    key={seg}
                    className="flex items-center gap-1.5 overflow-hidden"
                  >
                    <span className="shrink-0 text-border">/</span>
                    {isLast ? (
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
                        {label}
                      </span>
                    ) : (
                      <Link
                        href={href}
                        className="whitespace-nowrap no-underline hover:text-foreground"
                      >
                        {label}
                      </Link>
                    )}
                  </span>
                )
              })}
            </>
          )}
        </div>
      )}

      <div className="flex-1" />

      <LocaleSwitcher />
      <ThemeToggle />
      <UserMenu />
    </nav>
  )
}
