"use client"

import Link from "next/link"
import { useT } from "@/lib/i18n"
import { Section } from "@/components/sidebar-section"
import { GitBranch, LayoutGrid, List, Tag } from "lucide-react"

/** Model navigation section. */
export function ElementsNavSection({
  pathname,
  onClose,
  t,
}: {
  pathname: string
  onClose: () => void
  t: ReturnType<typeof useT>["t"]
}) {
  return (
    <Section title={t("sidebar.models")}>
      <Link
        href="/elements"
        onClick={onClose}
        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
          pathname === "/elements"
            ? "bg-card font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <List className="size-3.5 shrink-0" />
          {t("sidebar.elements")}
        </span>
      </Link>
      <Link
        href="/relationships"
        onClick={onClose}
        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
          pathname === "/relationships"
            ? "bg-card font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <GitBranch className="size-3.5 shrink-0" />
          {t("sidebar.relationships")}
        </span>
      </Link>
      <Link
        href="/views"
        onClick={onClose}
        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
          pathname === "/views" || pathname.startsWith("/views/")
            ? "bg-card font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <LayoutGrid className="size-3.5 shrink-0" />
          {t("sidebar.views")}
        </span>
      </Link>
      <Link
        href="/properties"
        onClick={onClose}
        className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors ${
          pathname === "/properties"
            ? "bg-card font-medium text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <Tag className="size-3.5 shrink-0" />
          {t("sidebar.properties")}
        </span>
      </Link>
    </Section>
  )
}
