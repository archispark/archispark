"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const SECTION_LABELS: Record<string, Parameters<ReturnType<typeof useT>["t"]>[0]> = {
  organizations: "settings.org.orgs_title",
  users: "users.title",
  postgres: "settings.tab_postgres",
  messages: "settings.tab_messages",
};

export function Nav({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const pathname = usePathname();
  const { t } = useT();

  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const sectionKey = SECTION_LABELS[segment];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 border-b border-border bg-secondary px-5 h-[var(--nav-h)]">
      <button
        onClick={onToggleSidebar}
        className="flex items-center justify-center size-8 rounded-md hover:bg-muted md:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="size-[18px]" />
      </button>

      <Link href="/organizations" className="flex items-center gap-2.5 no-underline shrink-0">
        <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="turbo-spark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
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
        <span className="text-[17px] leading-none tracking-tight" style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}>
          <span className="font-light text-foreground">Archi</span>
          <span className="font-bold text-primary">Spark</span>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
          Admin
        </span>
      </Link>

      {sectionKey && (
        <div className="flex items-center gap-1.5 text-[13px] overflow-hidden">
          <span className="text-border">/</span>
          <span className="text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{t(sectionKey)}</span>
        </div>
      )}

      <div className="flex-1" />

      <LocaleSwitcher />
      <ThemeToggle />
      <UserMenu />
    </nav>
  );
}
