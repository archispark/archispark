"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronsUpDown, Folder, LoaderCircle } from "lucide-react"
import type { WorkspaceInfo } from "@/lib/api"
import { useActivateWorkspace } from "@/lib/queries"

/**
 * Workspace picker inspired by shadcn's Sidebar 07 team switcher. It stays in
 * the sidebar header so the active model context is always visible.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
}: {
  workspaces: WorkspaceInfo[]
  activeWorkspace?: WorkspaceInfo
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const switcherRef = useRef<HTMLDivElement>(null)
  const activateWorkspace = useActivateWorkspace()
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
    if (workspace.active || activateWorkspace.isPending) return

    setError(null)
    try {
      await activateWorkspace.mutateAsync(workspace.id)
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de changer de workspace.")
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
        className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient
                id="archispark-workspace-logo"
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
              fill="url(#archispark-workspace-logo)"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[17px] leading-tight tracking-tight"
            style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}
          >
            <span className="font-light text-foreground">Archi</span>
            <span className="font-bold text-primary">Spark</span>
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{activeName}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choisir un workspace"
          className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
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
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {activateWorkspace.isPending && !selected ? (
                  <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
                ) : selected ? (
                  <Check className="size-4 text-primary" aria-label="Workspace actif" />
                ) : null}
              </button>
            )
          })}
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
