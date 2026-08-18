"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Folder, LoaderCircle, Plus } from "lucide-react"
import type { WorkspaceInfo } from "@/lib/api"
import { useActivateWorkspace } from "@/lib/queries"

/**
 * Workspace picker inspired by shadcn's Sidebar 07 team switcher. It stays in
 * the sidebar header so the active model context is always visible.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  display = "full",
}: {
  workspaces: WorkspaceInfo[]
  activeWorkspace?: WorkspaceInfo
  display?: "full" | "compact"
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const switcherRef = useRef<HTMLDivElement>(null)
  const activateWorkspace = useActivateWorkspace()
  const router = useRouter()
  const activeName = activeWorkspace?.name ?? "Workspace"

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  async function selectWorkspace(workspace: WorkspaceInfo) {
    if (activateWorkspace.isPending) return

    setError(null)
    try {
      if (!workspace.active) await activateWorkspace.mutateAsync(workspace.id)
      setOpen(false)
      router.push("/overview")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de changer de workspace."
      )
    }
  }

  return (
    <div ref={switcherRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Changer de workspace — ${activeName}`}
        className={
          display === "compact"
            ? "flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            : "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        }
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Folder className="size-3.5" />
        </span>
        {display === "full" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {activeName}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Workspace
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choisir un workspace"
          className={`absolute z-50 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg ${
            display === "compact"
              ? "top-0 left-full ml-2 w-56"
              : "top-full right-0 left-0 mt-1.5"
          }`}
        >
          <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
            Workspaces
          </div>
          {workspaces.map((workspace) => {
            const selected = workspace.active
            return (
              <button
                key={workspace.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                disabled={activateWorkspace.isPending}
                onClick={() => selectWorkspace(workspace)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Folder className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {workspace.name}
                </span>
                {activateWorkspace.isPending && !selected ? (
                  <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
                ) : selected ? (
                  <Check
                    className="size-4 text-primary"
                    aria-label="Workspace actif"
                  />
                ) : null}
              </button>
            )
          })}
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href="/workspaces"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] text-foreground no-underline transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/50 text-muted-foreground">
                <Plus className="size-3.5" />
              </span>
              Ajouter un workspace
            </Link>
          </div>
          {error && (
            <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
