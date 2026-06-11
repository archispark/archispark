"use client";

import Link from "next/link";

/** Single icon-only link shown in the collapsed sidebar rail. */
export function RailLink({ href, icon: Icon, label, active, onClick, badge }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: "amber" | "destructive";
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center size-9 rounded-md transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {badge && (
        <span className={`absolute top-1 right-1 size-1.5 rounded-full ${badge === "amber" ? "bg-amber-500" : "bg-destructive"}`} />
      )}
    </Link>
  );
}
