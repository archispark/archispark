"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useElement, useElementRelationships, useElements, useElementTypes,
  useUpdateElement, useDeleteElement, useElementsInViews, useElementViews,
  useCreateRelationship, useUpdateRelationship, useDeleteRelationship,
  useRelationshipTypes, usePropertyDefinitions, useRelationships,
} from "@/lib/queries";
import { type RelationshipOut, type Property, type RelationshipCreateIn, type RelationshipUpdateIn, type PropertyDefinitionOut, type ElementUpdateIn, type ViewOut } from "@/lib/api";
import { getLayer, LAYER_BADGE_COLORS } from "@/lib/archimate-helpers";
import { allowedRelationships } from "@/lib/archimate-rules";
import { DataTable } from "@/components/data-table";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@workspace/ui/components/dialog";
import { ChevronLeft, ChevronDown, ChevronRight, Trash2, Plus, Pencil } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-current-user";
import { useFormModal } from "@/hooks/use-form-modal";
import { useT } from "@/lib/i18n";
import type { ElementOut } from "@/lib/api";
import { ElementGraphTab } from "@/components/element-graph-tab";

// ── Simple tab bar ────────────────────────────────────────────────────────────

function Tabs({
  tabs, active, onChange,
}: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
            active === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Inline editable text ──────────────────────────────────────────────────────

function InlineText({
  value, onSave, className = "", placeholder = "—", multiline = false, disabled = false,
}: {
  value: string; onSave: (v: string) => void; className?: string; placeholder?: string;
  multiline?: boolean; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  }
  function cancel() { setEditing(false); setDraft(value); }

  if (!editing) {
    return (
      <span
        onDoubleClick={() => { if (!disabled) { setDraft(value); setEditing(true); } }}
        className={`${className} ${disabled ? "" : "cursor-text hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"} group relative`}
        title={disabled ? undefined : "Double-cliquer pour modifier"}
      >
        {value || <span className="text-muted-foreground/50 italic">{placeholder}</span>}
        {!disabled && <span className="ml-1 opacity-0 group-hover:opacity-40 text-[10px] align-middle">✎</span>}
      </span>
    );
  }

  const sharedProps = {
    ref,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      if (!multiline && e.key === "Enter") { e.preventDefault(); commit(); }
    },
    className: `${className} border border-ring rounded px-1 -mx-1 bg-background outline-none w-full`,
  };

  return multiline
    ? <textarea {...sharedProps} rows={3} style={{ resize: "vertical" }} />
    : <input {...sharedProps} />;
}

// ── Element picker select ─────────────────────────────────────────────────────

function ElementSelect({ options, value, onChange, placeholder }: {
  options: ElementOut[]; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((el) => (
          <SelectItem key={el.identifier} value={el.identifier}>
            {el.name || el.identifier}
            <span className="ml-1.5 text-[10px] text-muted-foreground">{el.type}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Element header (badges, name, description, specialization) ────────────────

function ElementHeader({
  element, isAdmin, editingType, setEditingType, groupedTypes, saveField,
  layer, layerColor, isInViews, t, editingSpec, setEditingSpec,
  elementSelectOpts, specializes, saveSpecialization, onDelete,
}: {
  element: ElementOut;
  isAdmin: boolean;
  editingType: boolean;
  setEditingType: (v: boolean) => void;
  groupedTypes: Record<string, string[]>;
  saveField: (patch: ElementUpdateIn) => Promise<void>;
  layer: string;
  layerColor: string;
  isInViews: boolean;
  t: ReturnType<typeof useT>["t"];
  editingSpec: boolean;
  setEditingSpec: (v: boolean) => void;
  elementSelectOpts: ElementOut[];
  specializes: RelationshipOut[];
  saveSpecialization: (targetId: string) => Promise<void>;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 shrink-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1 min-w-0">

          {/* Badges: type (inline-editable) + layer + status */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && editingType ? (
              <Select value={element.type} onValueChange={async (v) => { if (v) { await saveField({ type: v }); } setEditingType(false); }}>
                <SelectTrigger className="h-6 text-xs w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedTypes).map(([groupLayer, types]) =>
                    types.map((typ) => (
                      <SelectItem key={typ} value={typ}>
                        {typ}
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{groupLayer}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="secondary"
                className={`font-mono text-xs ${isAdmin ? "cursor-pointer hover:ring-1 hover:ring-ring" : ""}`}
                onDoubleClick={() => isAdmin && setEditingType(true)}
                title={isAdmin ? "Double-cliquer pour modifier le type" : undefined}
              >
                {element.type}
              </Badge>
            )}
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${layerColor}`}>{layer}</span>
            {isInViews ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700">
                ✓ {t("elements.in_views")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-600">
                ⚠ {t("elements.not_in_views")}
              </span>
            )}
          </div>

          {/* Name */}
          <InlineText
            value={element.name}
            onSave={(v) => saveField({ name: v })}
            className="text-xl sm:text-2xl font-semibold leading-tight block w-full"
            placeholder={t("elements.placeholder")}
            disabled={!isAdmin}
          />
        </div>

        {/* Delete button */}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            {t("common.delete")}
          </Button>
        )}
      </div>

      {/* Description */}
      <InlineText
        value={element.documentation ?? ""}
        onSave={(v) => saveField({ documentation: v || null })}
        className="text-sm text-muted-foreground leading-relaxed block w-full"
        placeholder={t("elements.no_documentation")}
        multiline
        disabled={!isAdmin}
      />

      {/* Not-in-views warning */}
      {!isInViews && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-700/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <span className="shrink-0">⚠</span>
          {t("elements.not_in_views_hint")}
        </div>
      )}

      {/* Specialization */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground shrink-0">{t("elements.specialization")} :</span>
        {isAdmin && editingSpec ? (
          <div className="flex items-center gap-2">
            <div className="w-56">
              <ElementSelect
                options={elementSelectOpts}
                value={specializes[0]?.target ?? ""}
                onChange={saveSpecialization}
                placeholder="— aucune —"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditingSpec(false)}>{t("common.cancel")}</Button>
          </div>
        ) : (
          <span
            onDoubleClick={() => isAdmin && setEditingSpec(true)}
            className={`${isAdmin ? "cursor-text hover:bg-muted/40 rounded px-1 -mx-1 transition-colors group" : ""}`}
            title={isAdmin ? "Double-cliquer pour modifier" : undefined}
          >
            {specializes.length > 0 ? specializes.map((r) => (
              <Link key={r.identifier} href={`/elements/${encodeURIComponent(r.target)}`}
                className="text-primary hover:underline font-medium">
                {r.target_name || r.target}
              </Link>
            )) : <span className="text-muted-foreground/60">—</span>}
            {isAdmin && <span className="ml-1 opacity-0 group-hover:opacity-40 text-[10px] align-middle">✎</span>}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ElementDetailPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const isAdmin = useIsAdmin();
  const router = useRouter();

  const { data: element, isLoading: elLoading, error: elError } = useElement(id);
  const { data: relationships = [], isLoading: relLoading } = useElementRelationships(id);
  const { data: allElements = [] } = useElements();
  const { data: allRelationships = [] } = useRelationships();
  const { data: elementTypes = [] } = useElementTypes();
  const { data: relTypes = [] } = useRelationshipTypes();
  const { data: propDefs = [] } = usePropertyDefinitions();
  const { data: inViews = [] } = useElementsInViews();
  const isInViews = useMemo(() => inViews.includes(id), [inViews, id]);
  const { data: elementViews = [] } = useElementViews(id);

  const updateMutation = useUpdateElement();
  const deleteMutation = useDeleteElement();
  const createRelMutation = useCreateRelationship();
  const updateRelMutation = useUpdateRelationship();
  const deleteRelMutation = useDeleteRelationship();

  const [activeTab, setActiveTab] = useState<"properties" | "relations" | "canvas" | "views">("canvas");

  // ── Delete element ────────────────────────────────────────────────────────
  const [deleteModal, deleteActions] = useFormModal<ElementOut>();
  const [deletePropRef, setDeletePropRef] = useState<string | null>(null);
  async function handleDeleteElement() {
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(id);
      router.push("/elements");
    });
  }

  // ── Inline save helpers ────────────────────────────────────────────────────
  const saveField = useCallback(async (patch: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) => {
    await updateMutation.mutateAsync({ id, body: patch });
  }, [id, updateMutation]);

  // ── Type inline editing ───────────────────────────────────────────────────
  const [editingType, setEditingType] = useState(false);

  const groupedTypes = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const typ of elementTypes) {
      const layer = getLayer(typ);
      (groups[layer] ??= []).push(typ);
    }
    return groups;
  }, [elementTypes]);

  // ── Specialization ────────────────────────────────────────────────────────
  const specializes = useMemo(
    () => relationships.filter((r) => r.type === "Specialization" && r.source === id),
    [relationships, id],
  );
  const [editingSpec, setEditingSpec] = useState(false);

  async function saveSpecialization(targetId: string) {
    setEditingSpec(false);
    const existing = specializes[0];
    if (!targetId) {
      if (existing) await deleteRelMutation.mutateAsync(existing.identifier);
      return;
    }
    if (existing) {
      if (existing.target === targetId) return;
      await updateRelMutation.mutateAsync({ id: existing.identifier, body: { target: targetId } });
    } else {
      await createRelMutation.mutateAsync({ type: "Specialization", source: id, target: targetId });
    }
  }

  // ── byId for relation status ──────────────────────────────────────────────
  const byId = useMemo(
    () => new Map<string, ElementOut>(allElements.map((e) => [e.identifier, e])),
    [allElements],
  );

  const relCounts = useMemo(() => {
    let ok = 0, bad = 0;
    for (const rel of relationships) {
      const src = byId.get(rel.source); const tgt = byId.get(rel.target);
      if (allowedRelationships(src?.type, tgt?.type).includes(rel.type)) ok++; else bad++;
    }
    return { ok, bad };
  }, [relationships, byId]);

  const viewCounts = useMemo(() => {
    let ok = 0, bad = 0;
    for (const v of elementViews) {
      if (v.conflict_count > 0) bad++; else ok++;
    }
    return { ok, bad };
  }, [elementViews]);

  // ── Properties inline CRUD ────────────────────────────────────────────────
  const properties: Property[] = element?.properties ?? [];
  const usedRefs = useMemo(() => new Set(properties.map((p) => p.property_definition_ref)), [properties]);
  const availableDefs = useMemo(() => propDefs.filter((d) => !usedRefs.has(d.identifier)), [propDefs, usedRefs]);

  const [addingProp, setAddingProp] = useState(false);
  const [newPropRef, setNewPropRef] = useState("");
  const [newPropVal, setNewPropVal] = useState("");

  async function savePropAdd() {
    if (!newPropRef) return;
    await updateMutation.mutateAsync({ id, body: { properties: [...properties, { property_definition_ref: newPropRef, value: newPropVal }] } });
    setNewPropRef(""); setNewPropVal(""); setAddingProp(false);
  }
  async function savePropValue(ref: string, val: string) {
    await updateMutation.mutateAsync({ id, body: { properties: properties.map((p) => p.property_definition_ref === ref ? { ...p, value: val } : p) } });
  }
  async function deleteProp(ref: string) {
    await updateMutation.mutateAsync({ id, body: { properties: properties.filter((p) => p.property_definition_ref !== ref) } });
  }

  // ── Relations CRUD ────────────────────────────────────────────────────────
  const [createRelModal, createRelActions] = useFormModal<null>();
  const [editRelModal, editRelActions] = useFormModal<RelationshipOut>();
  const [deleteRelModal, deleteRelActions] = useFormModal<RelationshipOut>();

  const [relType, setRelType] = useState("");
  const [relSource, setRelSource] = useState(id);
  const [relTarget, setRelTarget] = useState("");
  const [relName, setRelName] = useState("");
  const [relDoc, setRelDoc] = useState("");

  function openCreateRel() {
    setRelType(""); setRelSource(id); setRelTarget(""); setRelName(""); setRelDoc("");
    createRelActions.openNew();
  }
  function openEditRel(rel: RelationshipOut) {
    setRelType(rel.type); setRelSource(rel.source); setRelTarget(rel.target);
    setRelName(rel.name ?? ""); setRelDoc(rel.documentation ?? "");
    editRelActions.openWith(rel);
  }

  async function handleCreateRel() {
    if (!relType || !relSource || !relTarget) return;
    await createRelActions.run(async () => {
      await createRelMutation.mutateAsync({ type: relType, source: relSource, target: relTarget, name: relName.trim() || undefined, documentation: relDoc.trim() || null } as RelationshipCreateIn);
    });
  }
  async function handleEditRel() {
    if (!editRelModal.target || !relType || !relSource || !relTarget) return;
    await editRelActions.run(async () => {
      await updateRelMutation.mutateAsync({ id: editRelModal.target!.identifier, body: { type: relType, source: relSource, target: relTarget, name: relName.trim() || null, documentation: relDoc.trim() || null } as RelationshipUpdateIn });
    });
  }
  async function handleDeleteRel() {
    if (!deleteRelModal.target) return;
    await deleteRelActions.run(async () => {
      await deleteRelMutation.mutateAsync(deleteRelModal.target!.identifier);
    });
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  interface PropRow extends Property { _def?: PropertyDefinitionOut }
  const propColumns: ColumnDef<PropRow>[] = useMemo(() => [
    {
      accessorKey: "property_definition_ref",
      header: t("elements.prop_definition"),
      cell: ({ row }) => {
        const def = propDefs.find((d) => d.identifier === row.original.property_definition_ref);
        return <span className="text-xs text-muted-foreground">{def?.name ?? row.original.property_definition_ref}</span>;
      },
    },
    {
      accessorKey: "value",
      header: t("elements.prop_value"),
      cell: ({ row }) => isAdmin ? (
        <InlineText
          value={row.original.value}
          onSave={(v) => savePropValue(row.original.property_definition_ref, v)}
          className="text-sm"
          placeholder="—"
        />
      ) : <span className="text-sm">{row.original.value || "—"}</span>,
    },
    ...(isAdmin ? [{
      id: "prop_actions",
      header: "",
      enableSorting: false,
      cell: ({ row }: { row: { original: PropRow } }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => setDeletePropRef(row.original.property_definition_ref)} aria-label={t("common.delete")}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdmin, propDefs, properties]);

  const relColumns: ColumnDef<RelationshipOut>[] = useMemo(() => [
    {
      id: "expand", header: "", enableSorting: false,
      cell: ({ row }) => (
        <button type="button" onClick={() => row.toggleExpanded()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={row.getIsExpanded() ? t("common.collapse") : t("common.expand")}>
          {row.getIsExpanded() ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ),
    },
    {
      id: "status", header: t("relationships.status"), enableSorting: true,
      accessorFn: (rel) => {
        const src = byId.get(rel.source); const tgt = byId.get(rel.target);
        return allowedRelationships(src?.type, tgt?.type).includes(rel.type) ? "OK" : "Conflit";
      },
      cell: ({ row }) => {
        const rel = row.original;
        const src = byId.get(rel.source); const tgt = byId.get(rel.target);
        const ok = allowedRelationships(src?.type, tgt?.type).includes(rel.type);
        return ok
          ? <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px]">✓</span>
          : <span className="inline-flex items-center justify-center size-5 rounded-full bg-destructive/15 text-destructive text-[11px]">✕</span>;
      },
    },
    {
      accessorKey: "type", header: t("common.type"),
      cell: ({ row }) => <Badge variant="secondary" className="font-mono text-xs">{row.getValue("type")}</Badge>,
    },
    {
      accessorKey: "name", header: t("common.name"),
      cell: ({ row }) => <span className="font-medium">{(row.getValue("name") as string | null) || "—"}</span>,
    },
    {
      id: "source", header: t("common.source"), accessorFn: (r) => r.source_name || r.source,
      cell: ({ row }) => {
        const rel = row.original; const el = byId.get(rel.source);
        const label = rel.source_name || el?.name || rel.source;
        const isThis = rel.source === id;
        return (
          <div className="text-xs max-w-[130px]">
            {isThis ? <div className="truncate font-semibold">{label}</div> :
              <Link href={`/elements/${encodeURIComponent(rel.source)}`} className="truncate block hover:underline text-muted-foreground">{label}</Link>}
            {el?.type && <div className="text-muted-foreground">{el.type}</div>}
          </div>
        );
      },
    },
    {
      id: "target", header: t("common.target"), accessorFn: (r) => r.target_name || r.target,
      cell: ({ row }) => {
        const rel = row.original; const el = byId.get(rel.target);
        const label = rel.target_name || el?.name || rel.target;
        const isThis = rel.target === id;
        return (
          <div className="text-xs max-w-[130px]">
            {isThis ? <div className="truncate font-semibold">{label}</div> :
              <Link href={`/elements/${encodeURIComponent(rel.target)}`} className="truncate block hover:underline text-muted-foreground">{label}</Link>}
            {el?.type && <div className="text-muted-foreground">{el.type}</div>}
          </div>
        );
      },
    },
    ...(isAdmin ? [{
      id: "rel_actions", header: "", enableSorting: false,
      cell: ({ row }: { row: { original: RelationshipOut } }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => openEditRel(row.original)} aria-label={t("common.edit")}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => deleteRelActions.openWith(row.original)} aria-label={t("common.delete")}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdmin, byId, id]);

  const viewColumns: ColumnDef<ViewOut>[] = useMemo(() => [
    {
      id: "expand", header: "", enableSorting: false,
      cell: ({ row }) => (
        <button type="button" onClick={() => row.toggleExpanded()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={row.getIsExpanded() ? t("common.collapse") : t("common.expand")}>
          {row.getIsExpanded() ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ),
    },
    {
      id: "status", header: t("relationships.status"), enableSorting: true,
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
      accessorKey: "name", header: t("common.name"),
      cell: ({ row }) => (
        <Link href={`/views/${encodeURIComponent(row.original.identifier)}`} className="font-medium text-foreground hover:text-primary no-underline">
          {row.original.name || t("views.unnamed")}
        </Link>
      ),
    },
    {
      accessorKey: "viewpoint", header: t("views.viewpoint"),
      cell: ({ row }) => <span className="text-[13px] text-muted-foreground">{row.original.viewpoint || "—"}</span>,
    },
    {
      accessorKey: "node_count", header: t("views.nodes"),
      cell: ({ row }) => <span className="text-[13px] text-muted-foreground">{row.original.node_count}</span>,
    },
    {
      accessorKey: "connection_count", header: t("views.connections"),
      cell: ({ row }) => <span className="text-[13px] text-muted-foreground">{row.original.connection_count}</span>,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  // ── Element select options (excludes self) ────────────────────────────────
  const elementSelectOpts = useMemo(
    () => allElements.filter((e) => e.identifier !== id),
    [allElements, id],
  );

  // ── Loading / error ────────────────────────────────────────────────────────
  if (elLoading) return <div className="px-4 sm:px-7 pt-6 text-muted-foreground text-sm">{t("common.loading")}</div>;
  if (elError || !element) {
    return (
      <div className="px-4 sm:px-7 pt-6">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {t("common.error")}: {(elError as Error | null)?.message ?? "Élément introuvable"}
        </div>
      </div>
    );
  }

  const layer = getLayer(element.type);
  const layerColor = LAYER_BADGE_COLORS[layer] ?? "";
  const tabs = [
    { id: "canvas",     label: t("elements.tab_canvas") },
    { id: "relations",  label: t("elements.tab_relations"),  count: relationships.length },
    { id: "properties", label: t("elements.tab_properties"), count: properties.length },
    { id: "views",      label: t("elements.tab_views"),      count: elementViews.length },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-var(--nav-h))] overflow-hidden px-4 sm:px-7 pt-4 sm:pt-6 pb-0">

      {/* Back */}
      <Link href="/elements" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-3">
        <ChevronLeft className="size-3.5" />{t("breadcrumb.elements")}
      </Link>

      {/* Header */}
      <ElementHeader
        element={element}
        isAdmin={isAdmin}
        editingType={editingType}
        setEditingType={setEditingType}
        groupedTypes={groupedTypes}
        saveField={saveField}
        layer={layer}
        layerColor={layerColor}
        isInViews={isInViews}
        t={t}
        editingSpec={editingSpec}
        setEditingSpec={setEditingSpec}
        elementSelectOpts={elementSelectOpts}
        specializes={specializes}
        saveSpecialization={saveSpecialization}
        onDelete={() => deleteActions.openWith(element)}
      />

      {/* Tabs — fills remaining vertical space */}
      <div className="flex flex-col flex-1 min-h-0 mt-4">
        <Tabs tabs={tabs} active={activeTab} onChange={(v) => setActiveTab(v as "properties" | "relations" | "canvas" | "views")} />

        {/* ── Properties tab ──────────────────────────────────────────────── */}
        {activeTab === "properties" && (
          <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-4">
            <div className="space-y-3">
              {isAdmin && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAddingProp(true)} disabled={addingProp || availableDefs.length === 0}>
                    <Plus className="size-3.5 mr-1" />{t("common.create")}
                  </Button>
                </div>
              )}

              {addingProp && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Select value={newPropRef} onValueChange={(v) => setNewPropRef(v ?? "")}>
                    <SelectTrigger className="flex-1 min-w-[140px] h-8 text-sm">
                      <SelectValue placeholder={t("properties.property_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDefs.map((d) => (
                        <SelectItem key={d.identifier} value={d.identifier}>
                          {d.name}<span className="ml-1.5 text-[10px] text-muted-foreground">{d.type}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 min-w-[140px] h-8 text-sm"
                    placeholder={t("properties.value_placeholder")}
                    value={newPropVal}
                    onChange={(e) => setNewPropVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") savePropAdd(); if (e.key === "Escape") setAddingProp(false); }}
                  />
                  <Button size="sm" onClick={savePropAdd} disabled={!newPropRef || updateMutation.isPending}>
                    {t("common.create")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddingProp(false); setNewPropRef(""); setNewPropVal(""); }}>
                    {t("common.cancel")}
                  </Button>
                </div>
              )}

              <DataTable<PropRow, unknown>
                columns={propColumns}
                data={properties as PropRow[]}
                pageSize={25}
              />
            </div>
          </div>
        )}

        {/* ── Relations tab ────────────────────────────────────────────────── */}
        {activeTab === "relations" && (
          <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-4">
            <div className="space-y-3">
              {isAdmin && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={openCreateRel}>
                    <Plus className="size-3.5 mr-1" />{t("common.create")}
                  </Button>
                </div>
              )}
              <DataTable<RelationshipOut, unknown>
                columns={relColumns}
                data={relationships}
                loading={relLoading}
                pageSize={25}
                searchable
                footerStats={<>
                  <span className="text-emerald-600">{relCounts.ok} OK</span>
                  {" · "}
                  <span className={relCounts.bad > 0 ? "text-destructive" : ""}>{relCounts.bad} {t("common.conflicts").toLowerCase()}</span>
                </>}
                renderSubRow={(row) => {
                  const rel = row.original as RelationshipOut;
                  const src = byId.get(rel.source); const tgt = byId.get(rel.target);
                  const allowed = allowedRelationships(src?.type, tgt?.type);
                  const ok = allowed.includes(rel.type);
                  return (
                    <div className="text-[12px] text-muted-foreground space-y-0.5">
                      {ok ? (
                        <p><span className="text-emerald-700 font-medium">{t("relationships.allowed")}</span>{" — "}{rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}</p>
                      ) : (
                        <>
                          <p><span className="text-destructive font-medium">{t("relationships.not_allowed")}</span>{" — "}{rel.type} entre {src?.type ?? "?"} et {tgt?.type ?? "?"}</p>
                          <p>{t("relationships.suggestions")} : {allowed.length > 0 ? allowed.join(", ") : t("common.none")}</p>
                        </>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          </div>
        )}

        {/* ── Canvas tab ───────────────────────────────────────────────────── */}
        {activeTab === "canvas" && (
          <div className="flex-1 min-h-0 pt-3 pb-4 flex flex-col">
            <ElementGraphTab element={element} allRelationships={allRelationships} byId={byId} />
          </div>
        )}

        {/* ── Views tab ────────────────────────────────────────────────────── */}
        {activeTab === "views" && (
          <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-4">
            {elementViews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("elements.not_in_views_hint")}</p>
            ) : (
              <DataTable<ViewOut, unknown>
                columns={viewColumns}
                data={elementViews}
                pageSize={10}
                searchable
                searchPlaceholder={t("views.search")}
                initialSorting={[{ id: "status", desc: true }]}
                getRowId={(row) => row.identifier}
                footerStats={<>
                  <span className="text-emerald-600">{viewCounts.ok} {t("common.ok")}</span>
                  {viewCounts.bad > 0 && <> · <span className="text-destructive">{viewCounts.bad} {t("common.conflicts").toLowerCase()}</span></>}
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
            )}
          </div>
        )}
      </div>

      {/* ── Delete property confirmation ──────────────────────────────────── */}
      <Dialog open={!!deletePropRef} onOpenChange={(o) => !o && setDeletePropRef(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("common.delete")}</DialogTitle>
            <DialogDescription>{t("common.irreversible")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={() => { deleteProp(deletePropRef!); setDeletePropRef(null); }}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete element dialog ──────────────────────────────────────────── */}
      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("elements.delete_title")}</DialogTitle>
            <DialogDescription>{t("elements.delete_desc", { name: element.name || "?" })}</DialogDescription>
          </DialogHeader>
          {deleteModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDeleteElement} disabled={deleteModal.isPending}>
              {deleteModal.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create relation dialog ─────────────────────────────────────────── */}
      <Dialog open={createRelModal.open} onOpenChange={(o) => !o && createRelActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("relationships.new_title")}</DialogTitle>
            <DialogDescription>{t("relationships.new_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.type")} *</Label>
              <Select value={relType} onValueChange={(v) => setRelType(v ?? "")}>
                <SelectTrigger><SelectValue placeholder={t("relationships.choose_type")} /></SelectTrigger>
                <SelectContent>{relTypes.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.source")} *</Label>
              <ElementSelect options={elementSelectOpts} value={relSource} onChange={setRelSource} placeholder={t("common.source")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.target")} *</Label>
              <ElementSelect options={elementSelectOpts} value={relTarget} onChange={setRelTarget} placeholder={t("common.target")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crel-name">{t("common.name")} <span className="text-muted-foreground text-[11px]">{t("common.optional")}</span></Label>
              <Input id="crel-name" value={relName} onChange={(e) => setRelName(e.target.value)} placeholder={t("relationships.optional_name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crel-doc">{t("common.documentation")} <span className="text-muted-foreground text-[11px]">{t("common.optional")}</span></Label>
              <textarea id="crel-doc" value={relDoc} onChange={(e) => setRelDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[60px]" />
            </div>
          </div>
          {createRelModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createRelModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleCreateRel} disabled={createRelModal.isPending || !relType || !relSource || !relTarget}>
              {createRelModal.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit relation dialog ───────────────────────────────────────────── */}
      <Dialog open={editRelModal.open} onOpenChange={(o) => !o && editRelActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("relationships.edit_title")}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.type")} *</Label>
              <Select value={relType} onValueChange={(v) => setRelType(v ?? "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{relTypes.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.source")} *</Label>
              <ElementSelect options={elementSelectOpts} value={relSource} onChange={setRelSource} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.target")} *</Label>
              <ElementSelect options={elementSelectOpts} value={relTarget} onChange={setRelTarget} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="erel-name">{t("common.name")}</Label>
              <Input id="erel-name" value={relName} onChange={(e) => setRelName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="erel-doc">{t("common.documentation")}</Label>
              <textarea id="erel-doc" value={relDoc} onChange={(e) => setRelDoc(e.target.value)} className="bg-background border border-input rounded-md text-foreground text-sm px-3 py-2 outline-none focus:border-ring resize-vertical min-h-[60px]" />
            </div>
          </div>
          {editRelModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editRelModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEditRel} disabled={editRelModal.isPending || !relType || !relSource || !relTarget}>
              {editRelModal.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete relation dialog ─────────────────────────────────────────── */}
      <Dialog open={deleteRelModal.open} onOpenChange={(o) => !o && deleteRelActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("relationships.delete_title")}</DialogTitle>
            <DialogDescription>{t("relationships.delete_desc", { type: deleteRelModal.target?.type ?? "" })}</DialogDescription>
          </DialogHeader>
          {deleteRelModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteRelModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDeleteRel} disabled={deleteRelModal.isPending}>
              {deleteRelModal.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
