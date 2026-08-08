"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

/** Collapsible sidebar section with a clickable header (open by default). */
export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="px-2 pt-2 pb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1 flex min-h-6 w-full items-center justify-between gap-2 px-2 text-[10px] font-bold tracking-[0.8px] text-muted-foreground uppercase transition-colors hover:text-foreground"
      >
        <span>{title}</span>
        <ChevronDown
          className={`size-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && children}
    </div>
  )
}

/** Single icon-only link shown in the collapsed sidebar rail. */
export function RailLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
  badge?: "amber" | "destructive"
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex size-9 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {badge && (
        <span
          className={`absolute top-1 right-1 size-1.5 rounded-full ${badge === "amber" ? "bg-amber-500" : "bg-destructive"}`}
        />
      )}
    </Link>
  )
}
