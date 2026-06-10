"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Users as UsersIcon, Shield, KeyRound, Database, MessageSquare, FolderOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { RailLink } from "@/components/sidebar";
import { useT } from "@/lib/i18n";

const ADMIN_TABS = [
  { key: "workspaces", icon: FolderOpen, labelKey: "settings.tab_workspaces" },
  { key: "messages", icon: MessageSquare, labelKey: "settings.tab_messages" },
  { key: "members", icon: UsersIcon, labelKey: "settings.tab_members" },
  { key: "roles", icon: Shield, labelKey: "settings.tab_roles" },
  { key: "authentication", icon: KeyRound, labelKey: "settings.tab_authentication" },
  { key: "redis", icon: Database, labelKey: "settings.tab_redis" },
] as const;

export function AdminSidebar({ open, onClose, collapsed, onToggleCollapse }: { open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <Suspense>
      <AdminSidebarInner open={open} onClose={onClose} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </Suspense>
  );
}

function AdminSidebarInner({ open, onClose, collapsed, onToggleCollapse }: { open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const searchParams = useSearchParams();
  const { t } = useT();
  const currentTab = searchParams.get("tab") ?? "members";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-foreground/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-[var(--nav-h)] bottom-0 left-0 z-40 w-[var(--sidebar-w)] ${collapsed ? "md:w-[var(--sidebar-w-collapsed,56px)]" : ""} bg-secondary border-r border-border flex flex-col overflow-y-auto transition-[width,transform] duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Full content — hidden on desktop when the sidebar is collapsed to an icon rail */}
        <div className={collapsed ? "contents md:hidden" : "contents"}>
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="text-[13px] font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              {t("admin.title")}
            </div>
          </div>

          <div className="flex-1 py-2 overflow-y-auto">
            {ADMIN_TABS.map(({ key, icon: Icon, labelKey }) => {
              const active = currentTab === key;
              return (
                <Link
                  key={key}
                  href={`/admin?tab=${key}`}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm no-underline transition-colors ${
                    active ? "bg-card text-foreground font-medium shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {t(labelKey)}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Icon rail — shown on desktop in place of the full content when collapsed */}
        <div className={`hidden flex-1 flex-col items-center gap-1 py-3 ${collapsed ? "md:flex" : ""}`}>
          {ADMIN_TABS.map(({ key, icon: Icon, labelKey }) => (
            <RailLink key={key} href={`/admin?tab=${key}`} icon={Icon} label={t(labelKey)} active={currentTab === key} onClick={onClose} />
          ))}
        </div>

        {/* Collapse / expand toggle — desktop only */}
        <div className="hidden md:block border-t border-border px-2 py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
            className={`flex items-center gap-2.5 rounded-md text-sm w-full transition-colors text-muted-foreground hover:bg-muted hover:text-foreground ${
              collapsed ? "justify-center size-9 mx-auto" : "px-3 py-2"
            }`}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
            {!collapsed && t("sidebar.collapse")}
          </button>
        </div>
      </aside>
    </>
  );
}
