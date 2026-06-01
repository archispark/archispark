"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "use-debounce";
import type { ColumnDef } from "@tanstack/react-table";
import { type RelationshipOut, type ElementOut, type Property } from "@/lib/api";
import {
  useRelationships, useRelationshipTypes, useElements,
  useCreateRelationship, useUpdateRelationship, useDeleteRelationship,
} from "@/lib/queries";
import { useFormModal } from "@/hooks/use-form-modal";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@workspace/ui/components/dialog";
import { DataTable } from "@/components/data-table";
import { PropertiesEditor } from "@/components/properties-editor";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-current-user";
import { useT } from "@/lib/i18n";
import { allowedRelationships } from "@/lib/archimate-rules";

export default function RelationshipsPage() {
  const { t } = useT();
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "conflict">("all");

  // Form fields shared between create/edit
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [doc, setDoc] = useState("");
  const [props, setProps] = useState<Property[]>([]);

  const { data: types = [] } = useRelationshipTypes();
  const { data: relationships = [], isLoading: loading, error } = useRelationships(typeFilter, debouncedSearch || null);
  const { data: allElements = [] } = useElements();

  const createMutation = useCreateRelationship();
  const updateMutation = useUpdateRelationship();
  const deleteMutation = useDeleteRelationship();

  const [createModal, createActions] = useFormModal<null>();
  const [editModal, editActions] = useFormModal<RelationshipOut>();
  const [deleteModal, deleteActions] = useFormModal<RelationshipOut>();

  const byId = useMemo(() => new Map<string, ElementOut>(allElements.map((e) => [e.identifier, e])), [allElements]);
  const byRelId = useMemo(() => new Map<string, RelationshipOut>(relationships.map((r) => [r.identifier, r])), [relationships]);

  function openCreate() {
    setName(""); setType(""); setSource(""); setTarget(""); setDoc(""); setProps([]);
    createActions.openNew();
  }

  function openEdit(rel: RelationshipOut) {
    setName(rel.name ?? ""); setType(rel.type); setSource(rel.source);
    setTarget(rel.target); setDoc(rel.documentation ?? ""); setProps(rel.properties ?? []);
    editActions.openWith(rel);
  }

  async function handleCreate() {
    if (!type || !source || !target) return;
    await createActions.run(async () => {
      await createMutation.mutateAsync({ name: name.trim() || null, type, source, target, documentation: doc.trim() || null, properties: props });
    });
  }

  async function handleEdit() {
    if (!editModal.target || !type || !source || !target) return;
    await editActions.run(async () => {
      await updateMutation.mutateAsync({ id: editModal.target!.identifier, body: { name: name.trim() || null, type, source, target, documentation: doc.trim() || null, properties: props } });
    });
  }

  async function handleDelete() {
    if (!deleteModal.target) return;
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(deleteModal.target!.identifier);
    });
  }

  const elementSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allElements.map((el) => (
          <SelectItem key={el.identifier} value={el.identifier}>
            {el.name || el.identifier} ({el.type})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const validationStats = useMemo(() => {
    let ok = 0, bad = 0;
    for (const rel of relationships) {
      const src = byId.get(rel.source);
      const tgt = byId.get(rel.target);
      if (allowedRelationships(src?.type, tgt?.type).includes(rel.type)) ok++; else bad++;
    }
    return { ok, bad };
  }, [relationships, byId]);

  const filteredRelationships = useMemo(() => {
    if (statusFilter === "all") return relationships;
    return relationships.filter((rel) => {
      const src = byId.get(rel.source);
      const tgt = byId.get(rel.target);
      const ok = allowedRelationships(src?.type, tgt?.type).includes(rel.type);
      return statusFilter === "ok" ? ok : !ok;
    });
  }, [relationships, byId, statusFilter]);

  const columns: ColumnDef<RelationshipOut>[] = useMemo(() => [
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <button type="button" onClick={() => row.toggleExpanded()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={row.getIsExpanded() ? t("common.collapse") : t("common.expand")}>
          {row.getIsExpanded() ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ),
    },
    {
      id: "status",
      header: t("relationships.status"),
      enableSorting: true,
      accessorFn: (rel) => {
        const src = byId.get(rel.source);
        const tgt = byId.get(rel.target);
        return allowedRelationships(src?.type, tgt?.type).includes(rel.type) ? "OK" : "Conflit";
      },
      cell: ({ row }) => {
        const src = byId.get(row.original.source);
        const tgt = byId.get(row.original.target);
        const ok = allowedRelationships(src?.type, tgt?.type).includes(row.original.type);
        return ok ? (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px]">✓</span>
        ) : (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-destructive/15 text-destructive text-[11px]">✕</span>
        );
      },
    },
    {
      accessorKey: "type",
      header: t("common.type"),
      cell: ({ row }) => <Badge variant="secondary" className="font-mono text-xs">{row.getValue("type")}</Badge>,
    },
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name") || "—"}</span>,
    },
    {
      accessorKey: "source",
      header: t("common.source"),
      cell: ({ row }) => {
        const rel = row.original;
        const el = byId.get(rel.source);
        const refRel = !el ? byRelId.get(rel.source) : undefined;
        const label = rel.source_name || el?.name || refRel?.name || refRel?.type || rel.source;
        const sub = el?.type ?? (refRel ? t("relationships.title") : undefined);
        return (
          <div className="text-xs max-w-[150px]">
            <div className="truncate">{label}</div>
            {sub && <div className="text-muted-foreground">{sub}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "target",
      header: t("common.target"),
      cell: ({ row }) => {
        const rel = row.original;
        const el = byId.get(rel.target);
        const refRel = !el ? byRelId.get(rel.target) : undefined;
        const label = rel.target_name || el?.name || refRel?.name || refRel?.type || rel.target;
        const sub = el?.type ?? (refRel ? t("relationships.title") : undefined);
        return (
          <div className="text-xs max-w-[150px]">
            <div className="truncate">{label}</div>
            {sub && <div className="text-muted-foreground">{sub}</div>}
          </div>
        );
      },
    },
    ...(isAdmin ? [{
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }: { row: { original: RelationshipOut } }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(row.original)} aria-label={t("common.edit")}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => deleteActions.openWith(row.original)} aria-label={t("common.delete")}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdmin, byId, byRelId, openEdit, deleteActions]);

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{t("common.error")} : {(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("relationships.title")}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            ${relationships.length}
            {" · "}
            <span className="text-emerald-600">{validationStats.ok} OK</span>
            {validationStats.bad > 0 && <span className="text-destructive"> · {validationStats.bad} conflit{validationStats.bad > 1 ? "s" : ""}</span>}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
            <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
              <Plus className="size-4" /> Nouvelle relation
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("relationships.new_title")}</DialogTitle>
                <DialogDescription>{t("relationships.new_desc")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Type *</Label>
                  <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder={t("elements.choose_type")} /></SelectTrigger>
                    <SelectContent>{types.map((rtype) => <SelectItem key={rtype} value={rtype}>{rtype}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5"><Label>Source *</Label>{elementSelect(source, setSource, "Élément source")}</div>
                <div className="flex flex-col gap-1.5"><Label>Cible *</Label>{elementSelect(target, setTarget, "Élément cible")}</div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rel-name">Nom</Label>
                  <Input id="rel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("relationships.optional_name")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rel-doc">Documentation</Label>
                  <textarea id="rel-doc" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Description optionnelle" className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
                </div>
                <div className="flex flex-col gap-1.5"><Label>Propriétés</Label><PropertiesEditor value={props} onChange={setProps} /></div>
              </div>
              {createModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
                <Button onClick={handleCreate} disabled={createModal.isPending || !type || !source || !target}>{createModal.isPending ? t("common.creating") : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder={t("common.search_by_name")} className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeFilter ?? ""} onValueChange={(val) => setTypeFilter(val || null)}>
          <SelectTrigger className="min-w-[180px]"><SelectValue placeholder={t("common.all_types")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("common.all_types")}</SelectItem>
            {types.map((rtype) => <SelectItem key={rtype} value={rtype}>{rtype}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          {(["all", "ok", "conflict"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setStatusFilter(f)}
              className={`text-[12px] px-2.5 py-1 rounded-md border transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-muted"}`}>
              {f === "all" ? t("common.all") : f === "ok" ? t("common.ok") : t("common.conflicts")}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRelationships}
        loading={loading}
        renderSubRow={(row) => {
          const rel = row.original as RelationshipOut;
          const src = byId.get(rel.source);
          const tgt = byId.get(rel.target);
          const allowed = allowedRelationships(src?.type, tgt?.type);
          const ok = allowed.includes(rel.type);
          return (
            <div className="text-[12px] text-muted-foreground space-y-0.5">
              {ok ? (
                <p><span className="text-emerald-700 font-medium">Autorisé</span> — {rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}</p>
              ) : (
                <>
                  <p><span className="text-destructive font-medium">Non autorisé</span> — {rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}</p>
                  <p>Suggestions : {allowed.length > 0 ? allowed.join(", ") : "aucune"}</p>
                </>
              )}
            </div>
          );
        }}
      />

      {/* Edit dialog */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && editActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("relationships.edit_title")}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((rtype) => <SelectItem key={rtype} value={rtype}>{rtype}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5"><Label>Source *</Label>{elementSelect(source, setSource, "Élément source")}</div>
            <div className="flex flex-col gap-1.5"><Label>Cible *</Label>{elementSelect(target, setTarget, "Élément cible")}</div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-rel-name">Nom</Label>
              <Input id="edit-rel-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-rel-doc">Documentation</Label>
              <textarea id="edit-rel-doc" value={doc} onChange={(e) => setDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[72px]" />
            </div>
            <div className="flex flex-col gap-1.5"><Label>Propriétés</Label><PropertiesEditor value={props} onChange={setProps} /></div>
          </div>
          {editModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEdit} disabled={editModal.isPending || !type || !source || !target}>{editModal.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("relationships.delete_title")}</DialogTitle>
            <DialogDescription>
              {t("relationships.delete_desc", { type: deleteModal.target?.type ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {deleteModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModal.isPending}>{deleteModal.isPending ? t("common.deleting") : t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
