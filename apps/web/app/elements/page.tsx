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
import { useT } from "@/lib/i18n";
const LAYER_COLORS = LAYER_BADGE_COLORS;

export default function ElementsPage() {
  return (
    <Suspense>
      <ElementsPageInner />
    </Suspense>
  );
}

function ElementsPageInner() {
  const { t } = useT();
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
    for (const typ of types) {
      const layer = getLayer(typ);
      (groups[layer] ??= []).push(typ);
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
      header: t("common.name"),
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
      header: t("common.documentation"),
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
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(row.original)} aria-label={t("common.edit")}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label={t("common.delete")}>
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

  const layerLabel = layerFilter
    ? t(`layer.${layerFilter}` as Parameters<typeof t>[0]) || LAYER_LABELS[layerFilter] || layerFilter
    : "";

  const pageTitle = layerFilter ? t("elements.title_layer", { layer: layerLabel }) : t("elements.title");

  const pageDesc = layerFilter
    ? t("elements.layer_count", { n: filteredElements.length, s: filteredElements.length !== 1 ? "s" : "", layer: layerLabel })
    : t("elements.browse_all");

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {t("common.error")} : {(error as Error).message}
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
              <DialogTitle>{t("elements.new_btn")}</DialogTitle>
              <DialogDescription>{t("elements.new_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="el-name">{t("common.name")} *</Label>
                <Input id="el-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("elements.placeholder")} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.type")} *</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder={t("elements.choose_type")} /></SelectTrigger>
                  <SelectContent>
                    {Object.values(grouped).flat().map((typ) => (
                      <SelectItem key={typ} value={typ}>{typ}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="el-doc">{t("common.documentation")}</Label>
                <textarea id="el-doc" value={newDoc} onChange={(e) => setNewDoc(e.target.value)} placeholder={t("common.optional_desc")} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.properties")}</Label>
                <PropertiesEditor value={newProps} onChange={setNewProps} />
              </div>
            </div>
            {createMutation.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{(createMutation.error as Error).message}</div>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !newName.trim() || !newType}>{createMutation.isPending ? t("common.creating") : t("common.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder={t("common.search_by_name")} className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeFilter ?? ""} onValueChange={(val) => setTypeFilter(val || null)}>
          <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("common.all_types")}</SelectItem>
            {(layerFilter ? (grouped[layerFilter] ?? []) : Object.values(grouped).flat()).map((typ) => (
                      <SelectItem key={typ} value={typ}>{typ}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filteredElements} loading={loading} />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("elements.edit_title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">{t("common.name")} *</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEdit()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.type")} *</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(grouped).flat().map((typ) => (
                      <SelectItem key={typ} value={typ}>{typ}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-doc">{t("common.documentation")}</Label>
              <textarea id="edit-doc" value={editDoc} onChange={(e) => setEditDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.properties")}</Label>
              <PropertiesEditor value={editProps} onChange={setEditProps} />
            </div>
          </div>
          {updateMutation.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{(updateMutation.error as Error).message}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEdit} disabled={updateMutation.isPending || !editName.trim() || !editType}>{updateMutation.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("elements.delete_title")}</DialogTitle>
            <DialogDescription>
              {t("elements.delete_desc", { name: deleteTarget?.name || "?" })}
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{(deleteMutation.error as Error).message}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? t("common.deleting") : t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
