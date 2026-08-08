"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Check } from "lucide-react";
import {
  useWorkspaces,
  useCreateWorkspace,
  useActivateWorkspace,
} from "@/lib/queries";
import { useT } from "@/lib/i18n";

export default function WorkspacesPage() {
  const { t } = useT();
  const router = useRouter();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const createWs = useCreateWorkspace();
  const activateWs = useActivateWorkspace();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    try {
      const ws = await createWs.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      if (!ws.active) await activateWs.mutateAsync(ws.id);
      setName("");
      setDescription("");
      setShowForm(false);
      setError(null);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Click a workspace to enter it: activate it (unless already active) and open
  // its overview.
  async function enter(id: string, active: boolean) {
    try {
      if (!active) await activateWs.mutateAsync(id);
      setError(null);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="p-7 max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="size-5 text-primary" />
            {t("breadcrumb.workspaces")}
          </h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{t("workspaces.subtitle")}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setError(null); }}
            className="flex items-center gap-1.5 text-[13px] bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 shrink-0"
          >
            <Plus className="size-4" />
            {t("nav.workspace_new")}
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-col gap-2.5">
          <input
            autoFocus
            placeholder={t("nav.workspace_name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setShowForm(false); }}
            className="text-[13px] px-3 py-2 border border-border rounded-md bg-background text-foreground outline-none focus:border-primary"
          />
          <textarea
            placeholder={t("common.optional_desc")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setShowForm(false); }}
            rows={2}
            className="text-[13px] px-3 py-2 border border-border rounded-md bg-background text-foreground outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={createWs.isPending}
              className="text-[13px] bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 disabled:opacity-60"
            >
              {t("common.create")}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="text-[13px] border border-border rounded-md px-3 py-1.5 hover:bg-muted text-foreground"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
          {t("common.loading")}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <FolderOpen className="size-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm font-medium text-foreground">{t("workspaces.empty_title")}</div>
          <p className="text-[13px] text-muted-foreground mt-1">{t("workspaces.empty_desc")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              role="button"
              tabIndex={0}
              onClick={() => enter(ws.id, ws.active)}
              onKeyDown={(e) => { if (e.key === "Enter") enter(ws.id, ws.active); }}
              className={`flex items-center gap-3 px-4 py-3 bg-card border rounded-lg cursor-pointer transition-colors hover:border-primary/50 ${
                ws.active ? "border-primary/50" : "border-border"
              }`}
            >
              <FolderOpen className={`size-4 shrink-0 ${ws.active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`flex-1 truncate text-[14px] ${ws.active ? "font-medium text-foreground" : "text-foreground"}`}>
                {ws.name}
              </span>
              {ws.active && (
                <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                  <Check className="size-3.5" />
                  {t("nav.workspace_active")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
