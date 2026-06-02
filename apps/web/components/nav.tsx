"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, LogOut, ChevronDown, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { type ElementOut } from "@/lib/api";
import {
  useWorkspaces,
  useCreateWorkspace,
  useDeleteWorkspace,
  useActivateWorkspace,
} from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export function Nav({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();

  const { data: workspaces = [], isSuccess: wsLoaded } = useWorkspaces();
  const createWs = useCreateWorkspace();
  const deleteWs = useDeleteWorkspace();
  const activateWs = useActivateWorkspace();

  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsPath, setNewWsPath] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // No workspace exists (the user deleted them all) → redirect to the overview
  // page where one can be created.
  useEffect(() => {
    if (wsLoaded && workspaces.length === 0 && pathname !== "/workspaces") {
      router.push("/workspaces");
    }
  }, [wsLoaded, workspaces.length, pathname, router]);

  async function logout() {
    const { signOut } = await import("@/lib/auth-client");
    await signOut();
    router.push("/login");
    router.refresh();
  }

  async function activate(id: string) {
    try {
      await activateWs.mutateAsync(id);
      setWsMenuOpen(false);
      router.refresh();
    } catch (err) {
      setWsError((err as Error).message);
    }
  }

  async function addWorkspace() {
    if (!newWsName.trim()) return;
    try {
      const ws = await createWs.mutateAsync({ name: newWsName.trim(), path: newWsPath.trim() || undefined });
      // Switch into the new workspace and open its overview.
      if (!ws.active) await activateWs.mutateAsync(ws.id);
      setNewWsName("");
      setNewWsPath("");
      setShowNewForm(false);
      setWsMenuOpen(false);
      setWsError(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      setWsError((err as Error).message);
    }
  }

  async function removeWorkspace(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(t("common.delete") + " ?")) return;
    try {
      await deleteWs.mutateAsync(id);
      setWsError(null);
      router.refresh();
    } catch (err) {
      setWsError((err as Error).message);
    }
  }

  const qc = useQueryClient();

  const activeWs = workspaces.find((w) => w.active);
  const segments = pathname.split("/").filter(Boolean);

  // For /elements/[id], show the element name from the React Query cache.
  function segmentLabel(seg: string, index: number): string {
    const bcKeys: Record<string, Parameters<typeof t>[0]> = {
      elements: "breadcrumb.elements",
      relationships: "breadcrumb.relationships",
      views: "breadcrumb.views",
      validator: "breadcrumb.validator",
      capabilities: "breadcrumb.capabilities",
      strategy: "breadcrumb.strategy",
      composition: "breadcrumb.composition",
      properties: "breadcrumb.properties",
      users: "breadcrumb.users",
      settings: "breadcrumb.settings",
      workspaces: "breadcrumb.workspaces",
      login: "breadcrumb.login",
    };
    if (bcKeys[seg]) return t(bcKeys[seg]);
    if (segments[index - 1] === "elements") {
      const id = decodeURIComponent(seg);
      const cached = qc.getQueryData<ElementOut>(["element", id]);
      if (cached?.name) return cached.name;
    }
    return decodeURIComponent(seg);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 border-b border-border bg-secondary px-5 h-[var(--nav-h)]">
      <button
        onClick={onToggleSidebar}
        className="flex items-center justify-center size-8 rounded-md hover:bg-muted md:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="size-[18px]" />
      </button>

      <Link href="/workspaces" className="flex items-center gap-2.5 no-underline shrink-0">
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
      </Link>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Workspace selector */}
      {workspaces.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setWsMenuOpen((o) => !o); setWsError(null); setShowNewForm(false); }}
            className="flex items-center gap-1.5 text-[13px] px-2 py-1 rounded hover:bg-muted text-foreground"
          >
            <FolderOpen className="size-3.5 text-primary shrink-0" />
            <span className="max-w-[160px] truncate">{activeWs?.name ?? "—"}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          {wsMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setWsMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] bg-popover border border-border rounded-lg shadow-lg py-1 overflow-hidden">
                {wsError && (
                  <div className="mx-2 my-1 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1">{wsError}</div>
                )}
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => !ws.active && activate(ws.id)}
                    className={`flex items-center justify-between px-3 py-2 text-[13px] cursor-pointer hover:bg-muted group ${ws.active ? "text-primary font-medium" : "text-foreground"}`}
                  >
                    <span className="truncate flex-1">{ws.name}</span>
                    <span className="flex items-center gap-1.5 ml-2 shrink-0">
                      {ws.active && <span className="text-[10px] text-primary">{t("nav.workspace_active")}</span>}
                      <button
                        onClick={(e) => removeWorkspace(ws.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        title={t("common.delete")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </span>
                  </div>
                ))}

                <div className="border-t border-border mt-1 pt-1">
                  {showNewForm ? (
                    <div className="px-3 py-2 flex flex-col gap-1.5">
                      <input
                        autoFocus
                        placeholder={t("nav.workspace_name")}
                        value={newWsName}
                        onChange={(e) => setNewWsName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addWorkspace(); if (e.key === "Escape") setShowNewForm(false); }}
                        className="text-[12px] px-2 py-1 border border-border rounded bg-background text-foreground outline-none focus:border-primary"
                      />
                      <input
                        placeholder={t("nav.workspace_path")}
                        value={newWsPath}
                        onChange={(e) => setNewWsPath(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addWorkspace(); if (e.key === "Escape") setShowNewForm(false); }}
                        className="text-[12px] px-2 py-1 border border-border rounded bg-background text-foreground outline-none focus:border-primary"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={addWorkspace}
                          className="flex-1 text-[11px] bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90"
                        >
                          {t("common.create")}
                        </button>
                        <button
                          onClick={() => setShowNewForm(false)}
                          className="flex-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-muted text-foreground"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewForm(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Plus className="size-3.5" />
                      {t("nav.workspace_new")}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground overflow-hidden">
        {segments.length === 0 ? (
          <span className="text-muted-foreground">{t("nav.overview")}</span>
        ) : (
          <>
            <Link href="/" className="text-muted-foreground hover:text-foreground no-underline whitespace-nowrap">
              {t("nav.home")}
            </Link>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              const label = segmentLabel(seg, i);
              const href = "/" + segments.slice(0, i + 1).join("/");
              return (
                <span key={seg} className="flex items-center gap-1.5">
                  <span className="text-border">/</span>
                  {isLast ? (
                    <span className="text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                  ) : (
                    <Link href={href} className="text-muted-foreground hover:text-foreground no-underline whitespace-nowrap">
                      {label}
                    </Link>
                  )}
                </span>
              );
            })}
          </>
        )}
      </div>

      <div className="flex-1" />

      <LocaleSwitcher />
      <ThemeToggle />
      <Button variant="ghost" size="icon-sm" onClick={logout} aria-label={t("nav.logout")}>
        <LogOut className="size-4" />
      </Button>
    </nav>
  );
}
