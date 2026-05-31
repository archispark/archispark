"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import type { ColumnDef } from "@tanstack/react-table";
import { type ElementOut } from "@/lib/api";
import { getLayer, LAYER_BADGE_COLORS, LAYER_LABELS } from "@/lib/archimate-helpers";
import {
  useElements,
  useElementTypes,
  useCreateElement,
  useUpdateElement,
  useDeleteElement,
} from "@/lib/queries";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { DataTable } from "@/components/data-table";
import { PropertiesEditor } from "@/components/properties-editor";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Property } from "@/lib/api";
import { useIsAdmin } from "@/hooks/use-current-user";
const LAYER_COLORS = LAYER_BADGE_COLORS;

export default function ElementsPage() {
  return (
    <Suspense>
      <ElementsPageInner />
    </Suspense>
  );
}

function ElementsPageInner() {
  const isAdmin = useIsAdmin();
  const searchParams = useSearchParams();
  const layerFilter = searchParams.get("layer");

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: types = [] } = useElementTypes();
  const { data: elements = [], isLoading: loading, error } = useElements(typeFilter, debouncedSearch || null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newProps, setNewProps] = useState<Property[]>([]);
  const createMutation = useCreateElement();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ElementOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editDoc, setEditDoc] = useState("");
  const [editProps, setEditProps] = useState<Property[]>([]);
  const [, setEditError] = useState<string | null>(null);
  const updateMutation = useUpdateElement();

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ElementOut | null>(null);
  const [, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteElement();

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const t of types) {
      const layer = getLayer(t);
      (groups[layer] ??= []).push(t);
    }
    return groups;
  }, [types]);

  useEffect(() => {
    if (layerFilter && typeFilter && !(grouped[layerFilter] ?? []).includes(typeFilter)) {
      setTypeFilter(null);
    }
  }, [layerFilter, typeFilter, grouped]);

  function openEdit(el: ElementOut) {
    setEditTarget(el);
    setEditName(el.name);
    setEditType(el.type);
    setEditDoc(el.documentation ?? "");
    setEditProps(el.properties ?? []);
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(el: ElementOut) {
    setDeleteTarget(el);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim() || !newType) return;
    await createMutation.mutateAsync(
      { name: newName.trim(), type: newType, documentation: newDoc.trim() || null, properties: newProps },
      {
        onSuccess: () => { setCreateOpen(false); setNewName(""); setNewType(""); setNewDoc(""); setNewProps([]); },
      }
    );
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim() || !editType) return;
    await updateMutation.mutateAsync(
      { id: editTarget.identifier, body: { name: editName.trim(), type: editType, documentation: editDoc.trim() || null, properties: editProps } },
      { onSuccess: () => setEditOpen(false) }
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.identifier, { onSuccess: () => setDeleteOpen(false) });
  }

  const columns: ColumnDef<ElementOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name") || "—"}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono text-xs">{row.getValue("type")}</Badge>
      ),
    },
    {
      id: "layer",
      header: "Layer",
      accessorFn: (row) => getLayer(row.type),
      cell: ({ getValue }) => {
        const layer = getValue<string>();
        return (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_COLORS[layer] ?? ""}`}>
            {layer}
          </span>
        );
      },
    },
    {
      accessorKey: "documentation",
      header: "Documentation",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="max-w-xs truncate block text-muted-foreground">{row.getValue("documentation") || "—"}</span>
      ),
    },
    ...(isAdmin ? [{
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }: { row: { original: ElementOut } }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(row.original)} aria-label="Modifier">
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label="Supprimer">
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  ], [isAdmin]);

  const filteredElements = useMemo(() => {
    if (!layerFilter) return elements;
    return elements.filter((el) => getLayer(el.type) === layerFilter);
  }, [elements, layerFilter]);

  const pageTitle = layerFilter
    ? `Éléments — ${LAYER_LABELS[layerFilter] || layerFilter}`
    : "Éléments";

  const pageDesc = layerFilter
    ? `${filteredElements.length} élément${filteredElements.length !== 1 ? "s" : ""} de la couche ${LAYER_LABELS[layerFilter] || layerFilter}`
    : "Parcourir tous les éléments ArchiMate du modèle";

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{pageDesc}</p>
        </div>
        {isAdmin && <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouvel élément
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvel élément</DialogTitle>
              <DialogDescription>Créer un nouvel élément ArchiMate dans le modèle.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="el-name">Nom *</Label>
                <Input id="el-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Mon élément" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(grouped).flat().map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="el-doc">Documentation</Label>
                <textarea id="el-doc" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} placeholder="Description optionnelle" className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Propriétés</Label>
                <PropertiesEditor value={newProps} onChange={setNewProps} />
              </div>
            </div>
            {createMutation.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{(createMutation.error as Error).message}</div>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !newName.trim() || !newType}>{createMutation.isPending ? "Création…" : "Créer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Rechercher par nom..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeFilter ?? ""} onValueChange={(val) => setTypeFilter(val || null)}>
          <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les types</SelectItem>
            {(layerFilter ? (grouped[layerFilter] ?? []) : Object.values(grouped).flat()).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filteredElements} loading={loading} />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;élément</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Nom *</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEdit()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type *</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(grouped).flat().map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-doc">Documentation</Label>
              <textarea id="edit-doc" value={editDoc} onChange={(e) => setEditDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Propriétés</Label>
              <PropertiesEditor value={editProps} onChange={setEditProps} />
            </div>
          </div>
          {updateMutation.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{(updateMutation.error as Error).message}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleEdit} disabled={updateMutation.isPending || !editName.trim() || !editType}>{updateMutation.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;élément</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{deleteTarget?.name || "cet élément"}</strong> ? Les relations associées seront aussi supprimées. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{(deleteMutation.error as Error).message}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Suppression…" : "Supprimer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
