"use client";

import { useEffect, useState, useCallback, useMemo } from "react"; // eslint-disable-line
import Link from "next/link";
import {
  fetchViews,
  createView, updateView, deleteView,
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-current-user";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";

export default function ViewsPage() {
  const isAdmin = useIsAdmin();
  const { data: viewpoints = [] } = useViewpoints();
  const [views, setViews] = useState<ViewOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [viewpoint, setViewpoint] = useState("");
  const [doc, setDoc] = useState("");

  const [createModal, createActions] = useFormModal<null>();
  const [editModal, editActions] = useFormModal<ViewOut>();
  const [deleteModal, deleteActions] = useFormModal<ViewOut>();

  const reload = useCallback(() => {
    setLoading(true);
    fetchViews()
      .then(setViews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function openEdit(view: ViewOut, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setName(view.name); setViewpoint(view.viewpoint ?? ""); setDoc(view.documentation ?? "");
    editActions.openWith(view);
  }

  function openDelete(view: ViewOut, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    deleteActions.openWith(view);
  }

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

  async function handleEdit() {
    if (!editModal.target || !name.trim()) return;
    await editActions.run(async () => {
      await updateView(editModal.target!.identifier, { name: name.trim(), viewpoint: viewpoint || null, documentation: doc.trim() || null });
      reload();
    });
  }

  async function handleDelete() {
    if (!deleteModal.target) return;
    await deleteActions.run(async () => {
      await deleteView(deleteModal.target!.identifier);
      reload();
    });
  }

  const viewColumns: ColumnDef<ViewOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => (
        <Link
          href={`/views/${encodeURIComponent(row.original.identifier)}`}
          className="font-medium text-foreground hover:text-primary no-underline"
        >
          {row.original.name || "Sans nom"}
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
      header: "Nœuds",
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{row.original.node_count}</span>
      ),
    },
    {
      accessorKey: "connection_count",
      header: "Connexions",
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{row.original.connection_count}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        isAdmin ? (
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="icon-xs" onClick={(e) => openEdit(row.original, e)} aria-label="Modifier">
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={(e) => openDelete(row.original, e)} aria-label="Supprimer">
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ], [isAdmin]);

  if (loading && views.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">Erreur : {error}</div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Vues</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {views.length} diagramme{views.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
            <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
              <Plus className="size-4" /> Nouvelle vue
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle vue</DialogTitle>
                <DialogDescription>Créer une nouvelle vue dans le modèle.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="view-name">Nom *</Label>
                  <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma vue" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Viewpoint</Label>
                  <Select value={viewpoint} onValueChange={(v) => setViewpoint(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Aucun (vue libre)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun</SelectItem>
                      {viewpoints.map((vp) => <SelectItem key={vp} value={vp}>{vp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="view-doc">Documentation</Label>
                  <textarea id="view-doc" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Description optionnelle" className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
                </div>
              </div>
              {createModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
                <Button onClick={handleCreate} disabled={createModal.isPending || !name.trim()}>{createModal.isPending ? "Création…" : "Créer"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {views.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[40px] mb-3.5">📭</div>
          <p className="text-sm">Aucune vue dans le modèle.</p>
        </div>
      ) : (
        <DataTable columns={viewColumns} data={views} pageSize={10} searchable searchPlaceholder="Rechercher une vue…" />
      )}

      {/* Edit dialog */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && editActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Modifier la vue</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-view-name">Nom *</Label>
              <Input id="edit-view-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEdit()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Viewpoint</Label>
              <Select value={viewpoint} onValueChange={(v) => setViewpoint(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {viewpoints.map((vp) => <SelectItem key={vp} value={vp}>{vp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-view-doc">Documentation</Label>
              <textarea id="edit-view-doc" value={doc} onChange={(e) => setDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
          </div>
          {editModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleEdit} disabled={editModal.isPending || !name.trim()}>{editModal.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la vue</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{deleteModal.target?.name || "cette vue"}</strong> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          {deleteModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModal.isPending}>{deleteModal.isPending ? "Suppression…" : "Supprimer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
