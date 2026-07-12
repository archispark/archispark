"use client";

import { useEffect, useState, useCallback, useMemo } from "react"; // eslint-disable-line
import Link from "next/link";
import {
  fetchViews,
  createView, deleteView,
  type ViewOut,
} from "@/lib/api";
import { useViewpoints } from "@/lib/queries";
import { useFormModal } from "@/hooks/use-form-modal";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@workspace/ui/components/dialog";
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useT } from "@/lib/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";

export default function ViewsPage() {
  const { t } = useT();
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true;
  const { data: viewpoints = [] } = useViewpoints();
  const [views, setViews] = useState<ViewOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [viewpoint, setViewpoint] = useState("");
  const [doc, setDoc] = useState("");

  const [createModal, createActions] = useFormModal<null>();
  const [pendingDeleteView, setPendingDeleteView] = useState<ViewOut | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetchViews()
      .then(setViews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useKeyboardShortcut("n", () => { if (isAdmin) openCreate(); }, { enabled: !createModal.open });

  function openCreate() {
    setName(""); setViewpoint(""); setDoc("");
    createActions.openNew();
  }

  async function handleCreate() {
    if (!name.trim()) return;
    await createActions.run(async () => {
      await createView({ name: name.trim(), viewpoint: viewpoint || null, documentation: doc.trim() || null });
      reload();
    });
  }

  async function handleBulkDelete(rows: ViewOut[]) {
    await Promise.all(rows.map((v) => deleteView(v.identifier)));
    reload();
  }

  async function handleDeleteSingle() {
    if (!pendingDeleteView) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteView(pendingDeleteView.identifier);
      setPendingDeleteView(null);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "conflict">("all");

  const viewStats = useMemo(() => {
    let ok = 0, conflict = 0;
    for (const v of views) {
      if (v.conflict_count > 0) conflict++;
      else if (v.connection_count > 0) ok++;
    }
    return { ok, conflict };
  }, [views]);

  const filteredViews = useMemo(() => {
    if (statusFilter === "all") return views;
    if (statusFilter === "ok") return views.filter((v) => v.conflict_count === 0);
    return views.filter((v) => v.conflict_count > 0);
  }, [views, statusFilter]);

  const viewColumns: ColumnDef<ViewOut>[] = useMemo(() => [
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); row.toggleExpanded(); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={row.getIsExpanded() ? t("common.collapse") : t("common.expand")}
        >
          {row.getIsExpanded()
            ? <ChevronDown className="size-3.5" />
            : <ChevronRight className="size-3.5" />}
        </button>
      ),
    },
    {
      id: "status",
      header: "Statut",
      enableSorting: true,
      accessorFn: (row) => row.conflict_count,
      cell: ({ row }) => {
        const { connection_count, ok_count, conflict_count } = row.original;
        if (connection_count === 0) {
          return <span className="text-[13px] text-muted-foreground">—</span>;
        }
        if (conflict_count === 0) {
          return (
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px]" title={`${ok_count} relations valides`}>
              ✓
            </span>
          );
        }
        return (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-destructive/15 text-destructive text-[11px]" title={`${conflict_count} conflit(s)`}>
            ✕
          </span>
        );
      },
    },
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => (
        <Link
          href={`/views/${encodeURIComponent(row.original.identifier)}`}
          className="font-medium text-foreground hover:text-primary no-underline"
        >
          {row.original.name || t("views.unnamed")}
        </Link>
      ),
    },
    {
      accessorKey: "viewpoint",
      header: "Viewpoint",
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{row.original.viewpoint || "—"}</span>
      ),
    },
    {
      accessorKey: "node_count",
      header: t("views.nodes"),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{row.original.node_count}</span>
      ),
    },
    {
      accessorKey: "connection_count",
      header: t("views.connections"),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{row.original.connection_count}</span>
      ),
    },
    ...(isAdmin ? [{
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }: { row: { original: ViewOut } }) => (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDeleteView(row.original); }}
          className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={t("common.delete")}
        >
          <Trash2 className="size-3.5" />
        </button>
      ),
    } as ColumnDef<ViewOut>] : []),
  ], [isAdmin, t]);

  if (loading && views.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{t("common.error")} : {error}</div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("views.title")}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {t("views.count", { n: views.length, s: views.length !== 1 ? "s" : "" })}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
            <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
              <Plus className="size-4" /> Nouvelle vue
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("views.new_btn")}</DialogTitle>
                <DialogDescription>{t("views.new_desc")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="view-name">Nom *</Label>
                  <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("views.unnamed")} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("views.viewpoint")}</Label>
                  <Select value={viewpoint} onValueChange={(v) => setViewpoint(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder={t("views.no_viewpoint")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t("views.no_viewpoint_short")}</SelectItem>
                      {viewpoints.map((vp) => <SelectItem key={vp} value={vp}>{vp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="view-doc">Documentation</Label>
                  <textarea id="view-doc" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={t("common.optional_desc")} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
                </div>
              </div>
              {createModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
                <Button onClick={handleCreate} disabled={createModal.isPending || !name.trim()}>{createModal.isPending ? t("common.creating") : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {views.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[40px] mb-3.5">📭</div>
          <p className="text-sm">{t("views.empty")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            {(["all", "ok", "conflict"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setStatusFilter(f)}
                className={`text-[12px] px-2.5 py-1 rounded-md border transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-muted"}`}>
                {f === "all" ? t("common.all") : f === "ok" ? t("common.ok") : t("common.conflicts")}
              </button>
            ))}
          </div>
          <DataTable
            columns={viewColumns}
            data={filteredViews}
          pageSize={10}
          searchable
          searchPlaceholder={t("views.search")}
          initialSorting={[{ id: "status", desc: true }]}
          selectable={isAdmin}
          onBulkDelete={isAdmin ? handleBulkDelete : undefined}
          getRowId={(row) => row.identifier}
          footerStats={<>
            <span className="text-emerald-600">{viewStats.ok} {t("common.ok")}</span>
            {viewStats.conflict > 0 && <> · <span className="text-destructive">{viewStats.conflict} {t("common.conflicts").toLowerCase()}</span></>}
          </>}
          renderSubRow={(row) => {
            const { ok_count, conflict_count } = row.original;
            return (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-0.5">
                <span className="font-medium">Relations :</span>
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px]">✓</span>
                  <span className="text-emerald-700 font-medium">{ok_count} valide{ok_count !== 1 ? "s" : ""}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center size-4 rounded-full bg-destructive/15 text-destructive text-[10px]">✕</span>
                  <span className={conflict_count > 0 ? "text-destructive font-medium" : ""}>{conflict_count} conflit{conflict_count !== 1 ? "s" : ""}</span>
                </span>
              </div>
            );
          }}
        />
        </>
      )}

      <Dialog open={!!pendingDeleteView} onOpenChange={(o) => { if (!o) { setPendingDeleteView(null); setDeleteError(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("common.delete")} « {pendingDeleteView?.name || t("views.unnamed")} »</DialogTitle>
            <DialogDescription>{t("common.irreversible")}</DialogDescription>
          </DialogHeader>
          {deleteError && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteError}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={deleteLoading} />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDeleteSingle} disabled={deleteLoading}>
              {deleteLoading ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
