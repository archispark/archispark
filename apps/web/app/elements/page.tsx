"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import type { ColumnDef } from "@tanstack/react-table";
import { type ElementOut } from "@/lib/api";
import { getLayer, LAYER_BADGE_COLORS, LAYER_LABELS, ALL_ELEMENT_TYPES } from "@/lib/archimate-helpers";
import {
  useElements,
  useElementTypes,
  useCreateElement,
  useDeleteElement,
  useElementsInViews,
  useRelationships,
} from "@/lib/queries";
import { isRelationshipAllowed } from "@/lib/archimate-rules";
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
  SelectGroup,
  SelectLabel,
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
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { Property } from "@/lib/api";
import { allowedRelationships } from "@/lib/archimate-rules";
import { useIsAdmin } from "@/hooks/use-current-user";
import { useFormModal } from "@/hooks/use-form-modal";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "conflict" | "absent">("all");

  const { data: types = [] } = useElementTypes();
  const { data: elements = [], isLoading: loading, error } = useElements(typeFilter, debouncedSearch || null);
  const { data: allElements = [] } = useElements();
  const { data: allRelationships = [] } = useRelationships();
  const { data: inViews = [] } = useElementsInViews();
  const inViewsSet = useMemo(() => new Set(inViews), [inViews]);

  const byId = useMemo(
    () => new Map(allElements.map((e) => [e.identifier, e])),
    [allElements],
  );

  // Per-element relationship counts (ok / conflict)
  const relStats = useMemo(() => {
    const map = new Map<string, { ok: number; conflict: number }>();
    for (const rel of allRelationships) {
      const src = byId.get(rel.source);
      const tgt = byId.get(rel.target);
      const ok = isRelationshipAllowed(rel.type, src?.type, tgt?.type);
      for (const id of [rel.source, rel.target]) {
        const entry = map.get(id) ?? { ok: 0, conflict: 0 };
        if (ok) entry.ok += 1; else entry.conflict += 1;
        map.set(id, entry);
      }
    }
    return map;
  }, [allRelationships, byId]);

  const deleteMutation = useDeleteElement();
  const [deleteModal, deleteActions] = useFormModal<ElementOut>();

  async function handleBulkDelete(rows: ElementOut[]) {
    await Promise.all(rows.map((el) => deleteMutation.mutateAsync(el.identifier)));
  }

  async function handleDeleteSingle() {
    if (!deleteModal.target) return;
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(deleteModal.target!.identifier);
    });
  }

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newProps, setNewProps] = useState<Property[]>([]);
  const createMutation = useCreateElement();

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

  const searchRef = useRef<HTMLInputElement>(null);
  useKeyboardShortcut("n", () => { if (isAdmin) setCreateOpen(true); }, { enabled: !createOpen });
  useKeyboardShortcut("/", (e) => { e.preventDefault(); searchRef.current?.focus(); }, { enabled: true });

  async function handleCreate() {
    if (!newName.trim() || !newType) return;
    await createMutation.mutateAsync(
      { name: newName.trim(), type: newType, documentation: newDoc.trim() || null, properties: newProps },
      {
        onSuccess: () => { setCreateOpen(false); setNewName(""); setNewType(""); setNewDoc(""); setNewProps([]); },
      }
    );
  }

  const columns: ColumnDef<ElementOut>[] = useMemo(() => [
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => row.toggleExpanded()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={row.getIsExpanded() ? t("common.collapse") : t("common.expand")}
        >
          {row.getIsExpanded() ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ),
    },
    {
      id: "status",
      header: "Statut",
      enableSorting: true,
      accessorFn: (row) => {
        const stats = relStats.get(row.identifier);
        return (stats?.conflict ?? 0) * 1000 + (inViewsSet.has(row.identifier) ? 0 : 100);
      },
      cell: ({ row }) => {
        const inView = inViewsSet.has(row.original.identifier);
        const stats = relStats.get(row.original.identifier) ?? { ok: 0, conflict: 0 };
        if (stats.conflict > 0) {
          return <span className="inline-flex items-center justify-center size-5 rounded-full bg-destructive/15 text-destructive text-[11px]" title={t("elements.not_in_views")}>✕</span>;
        }
        if (!inView) {
          return <span className="inline-flex items-center justify-center size-5 rounded-full bg-amber-500/15 text-amber-600 text-[11px]" title={t("elements.not_in_views")}>⚠</span>;
        }
        return <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px]" title={t("elements.in_views")}>✓</span>;
      },
    },
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => (
        <Link
          href={`/elements/${encodeURIComponent(row.original.identifier)}`}
          className="font-medium hover:underline text-foreground"
        >
          {row.getValue("name") || "—"}
        </Link>
      ),
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
    ...(isAdmin ? [{
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }: { row: { original: ElementOut } }) => (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteActions.openWith(row.original); }}
          className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={t("common.delete")}
        >
          <Trash2 className="size-3.5" />
        </button>
      ),
    } as ColumnDef<ElementOut>] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [inViewsSet, relStats, isAdmin]);

  const filteredElements = useMemo(() => {
    let result = layerFilter ? elements.filter((el) => getLayer(el.type) === layerFilter) : elements;
    if (statusFilter !== "all") {
      result = result.filter((el) => {
        const stats = relStats.get(el.identifier);
        const inView = inViewsSet.has(el.identifier);
        if (statusFilter === "conflict") return (stats?.conflict ?? 0) > 0;
        if (statusFilter === "absent") return !inView;
        return (stats?.conflict ?? 0) === 0 && inView;
      });
    }
    return result;
  }, [elements, layerFilter, statusFilter, relStats, inViewsSet]);

  const elementStats = useMemo(() => {
    let ok = 0, conflict = 0, absent = 0;
    for (const el of filteredElements) {
      const stats = relStats.get(el.identifier);
      const inView = inViewsSet.has(el.identifier);
      if ((stats?.conflict ?? 0) > 0) conflict++;
      else if (!inView) absent++;
      else ok++;
    }
    return { ok, conflict, absent };
  }, [filteredElements, relStats, inViewsSet]);

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
                    {layerFilter
                      ? (grouped[layerFilter] ?? []).map((typ) => (
                          <SelectItem key={typ} value={typ}>{typ}</SelectItem>
                        ))
                      : Object.entries(grouped).map(([layer, typs]) => (
                          <SelectGroup key={layer}>
                            <SelectLabel>{layer}</SelectLabel>
                            {typs.map((typ) => (
                              <SelectItem key={typ} value={typ}>{typ}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))
                    }
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

      <div className="flex items-center gap-3">
        <Input ref={searchRef} placeholder={t("common.search_by_name")} className="flex-1 min-w-0" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeFilter ?? ""} onValueChange={(val) => setTypeFilter(val || null)}>
          <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("common.all_types")}</SelectItem>
            {(layerFilter ? (grouped[layerFilter] ?? []) : Object.values(grouped).flat()).map((typ) => (
                      <SelectItem key={typ} value={typ}>{typ}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          {(["all", "ok", "conflict", "absent"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setStatusFilter(f)}
              className={`text-[12px] px-2.5 py-1 rounded-md border transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-muted"}`}>
              {f === "all" ? t("common.all") : f === "ok" ? t("common.ok") : f === "conflict" ? t("common.conflicts") : "Absents"}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredElements}
        loading={loading}
        initialSorting={[{ id: "status", desc: true }]}
        selectable={isAdmin}
        onBulkDelete={isAdmin ? handleBulkDelete : undefined}
        getRowId={(row) => row.identifier}
        footerStats={<>
          <span className="text-emerald-600">{elementStats.ok} {t("common.ok")}</span>
          {elementStats.conflict > 0 && <> · <span className="text-destructive">{elementStats.conflict} {t("common.conflicts").toLowerCase()}</span></>}
          {elementStats.absent > 0 && <> · <span className="text-amber-600">{elementStats.absent} {t("common.absent")}</span></>}
        </>}
        renderSubRow={(row) => {
          const el = row.original as ElementOut;
          const inView = inViewsSet.has(el.identifier);
          const rels = allRelationships.filter((r) => r.source === el.identifier || r.target === el.identifier);
          const conflictCount = rels.filter((r) => {
            const src = byId.get(r.source);
            const tgt = byId.get(r.target);
            return !allowedRelationships(src?.type, tgt?.type).includes(r.type);
          }).length;
          const okCount = rels.length - conflictCount;
          return (
            <div className="flex items-center gap-3 text-[12px] py-0.5">
              <span className="font-medium text-muted-foreground">Vues :</span>
              {inView ? (
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px]">✓</span>
                  <span className="text-emerald-700 font-medium">présent</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center size-4 rounded-full bg-amber-500/15 text-amber-600 text-[10px]">⚠</span>
                  <span className="text-amber-600 font-medium">absent</span>
                </span>
              )}
              <span className="text-muted-foreground">—</span>
              <span className="font-medium text-muted-foreground">Relations :</span>
              <span className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px]">✓</span>
                <span className="text-emerald-700 font-medium">{okCount} valide{okCount !== 1 ? "s" : ""}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-destructive/15 text-destructive text-[10px]">✕</span>
                <span className={conflictCount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{conflictCount} conflit{conflictCount !== 1 ? "s" : ""}</span>
              </span>
            </div>
          );
        }}
      />

      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("elements.delete_title")}</DialogTitle>
            <DialogDescription>{t("elements.delete_desc", { name: deleteModal.target?.name || "?" })}</DialogDescription>
          </DialogHeader>
          {deleteModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDeleteSingle} disabled={deleteModal.isPending}>
              {deleteModal.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
