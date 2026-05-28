"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
import { Menu, Moon, Sun, LogOut, ChevronDown, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  fetchWorkspaces,
  activateWorkspaceApi,
  createWorkspaceApi,
  deleteWorkspaceApi,
  type WorkspaceInfo,
} from "@/lib/api";

const BREADCRUMBS: Record<string, string> = {
  elements: "Éléments",
  relationships: "Relations",
  views: "Vues",
  capabilities: "App par Capability",
  strategy: "Stratégie par Capability",
  composition: "Composition",
  properties: "Propriétés",
  users: "Utilisateurs",
  login: "Connexion",
};

export function Nav({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsPath, setNewWsPath] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(() => {
    fetchWorkspaces()
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  function logout() {
    document.cookie = "auth_token=; path=/; max-age=0";
    router.push("/login");
  }

  async function activate(id: string) {
    try {
      await activateWorkspaceApi(id);
      setWsMenuOpen(false);
      loadWorkspaces();
      router.refresh();
    } catch (err) {
      setWsError((err as Error).message);
    }
  }

  async function addWorkspace() {
    if (!newWsName.trim()) return;
    try {
      await createWorkspaceApi({ name: newWsName.trim(), path: newWsPath.trim() || undefined });
      setNewWsName("");
      setNewWsPath("");
      setShowNewForm(false);
      setWsError(null);
      loadWorkspaces();
    } catch (err) {
      setWsError((err as Error).message);
    }
  }

  async function removeWorkspace(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Supprimer ce workspace ?")) return;
    try {
      await deleteWorkspaceApi(id);
      setWsError(null);
      loadWorkspaces();
    } catch (err) {
      setWsError((err as Error).message);
    }
  }

  const activeWs = workspaces.find((w) => w.active);
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 border-b border-border bg-secondary px-5 h-[var(--nav-h)]">
      <button
        onClick={onToggleSidebar}
        className="flex items-center justify-center size-8 rounded-md hover:bg-muted md:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="size-[18px]" />
      </button>

      <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0">
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <polygon points="16,2 27,8 27,22 16,28 5,22 5,8" fill="#2563eb" />
          <polygon
            points="16,9 22,13 22,21 16,25 10,21 10,13"
            fill="none"
            stroke="white"
            strokeWidth="0.8"
            strokeLinejoin="round"
            opacity="0.4"
          />
          <polygon points="16,14 19,16 19,19 16,21 13,19 13,16" fill="white" opacity="0.15" />
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
                    {ws.active && <span className="text-[10px] text-primary ml-2 shrink-0">actif</span>}
                    {!ws.active && (
                      <button
                        onClick={(e) => removeWorkspace(ws.id, e)}
                        className="opacity-0 group-hover:opacity-100 ml-2 text-muted-foreground hover:text-destructive shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="border-t border-border mt-1 pt-1">
                  {showNewForm ? (
                    <div className="px-3 py-2 flex flex-col gap-1.5">
                      <input
                        autoFocus
                        placeholder="Nom du workspace"
                        value={newWsName}
                        onChange={(e) => setNewWsName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addWorkspace(); if (e.key === "Escape") setShowNewForm(false); }}
                        className="text-[12px] px-2 py-1 border border-border rounded bg-background text-foreground outline-none focus:border-primary"
                      />
                      <input
                        placeholder="Chemin XML (optionnel)"
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
                          Créer
                        </button>
                        <button
                          onClick={() => setShowNewForm(false)}
                          className="flex-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-muted text-foreground"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewForm(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Plus className="size-3.5" />
                      Nouveau workspace
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
          <span className="text-muted-foreground">Vue d&apos;ensemble</span>
        ) : (
          <>
            <Link href="/" className="text-muted-foreground hover:text-foreground no-underline whitespace-nowrap">
              Accueil
            </Link>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              const label = BREADCRUMBS[seg] || decodeURIComponent(seg);
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

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Déconnexion">
        <LogOut className="size-4" />
      </Button>
    </nav>
  );
}
