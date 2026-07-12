"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useRelationship, useRelationshipViews, useRelationshipTypes, useElements,
  useUpdateRelationship, useDeleteRelationship, usePropertyDefinitions,
} from "@/lib/queries";
import { type Property, type ViewOut, type PropertyDefinitionOut, type RelationshipOut, type RelationshipUpdateIn, type ElementOut } from "@/lib/api";
import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers";
import { allowedRelationships } from "@/lib/archimate-rules";
import { DataTable } from "@/components/data-table";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@workspace/ui/components/dialog";
import { ChevronLeft, ChevronDown, ChevronRight, Trash2, Plus } from "lucide-react";
import { useFormModal } from "@/hooks/use-form-modal";
import { useT } from "@/lib/i18n";

// ── Tab bar ───────────────────────────────────────────────────────────────────

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

// ── Element mini-box for the canvas ──────────────────────────────────────────

function ElementBox({ id, name, type }: { id: string; name: string; type: string }) {
  const layer = getLayer(type);
  const color = LAYER_HEX_COLORS[layer] ?? "#64748b";
  return (
    <Link href={`/elements/${encodeURIComponent(id)}`} className="block no-underline hover:scale-[1.02] transition-transform">
      <div style={{ width: 160, border: `1.5px solid ${color}`, borderRadius: 8, background: `${color}18`, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>{type}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.3 }}>{name || "—"}</div>
      </div>
    </Link>
  );
}

// ── Canvas diagram (source → rel → target) ────────────────────────────────────

function RelationshipCanvas({
  relType, relName, isOk,
  srcId, srcName, srcType,
  tgtId, tgtName, tgtType,
}: {
  relType: string; relName: string | null; isOk: boolean;
  srcId: string; srcName: string; srcType: string;
  tgtId: string; tgtName: string; tgtType: string;
}) {
  const arrowColor = isOk ? "#10b981" : "#dc2626";
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex items-center gap-4">
        <ElementBox id={srcId} name={srcName} type={srcType} />
        <div className="flex flex-col items-center gap-1.5 select-none">
          <svg width="120" height="20" style={{ overflow: "visible" }}>
            <line x1="0" y1="10" x2="110" y2="10" stroke={arrowColor} strokeWidth="1.5" />
            <polygon points="110,6 120,10 110,14" fill={arrowColor} />
          </svg>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-semibold" style={{ color: arrowColor }}>{relType}</span>
            {relName && <span className="text-[10px] text-muted-foreground italic">{relName}</span>}
          </div>
        </div>
        <ElementBox id={tgtId} name={tgtName} type={tgtType} />
      </div>
    </div>
  );
}

// ── Header + editable fields (name, type, source, target, documentation) ──────

function RelationshipFields({
  rel, isAdmin, saveField, t, onDelete,
  editingType, setEditingType, relTypes, isOk,
  editingSource, setEditingSource, allElements, srcEl,
  editingTarget, setEditingTarget, tgtEl,
}: {
  rel: RelationshipOut;
  isAdmin: boolean;
  saveField: (patch: RelationshipUpdateIn) => Promise<void>;
  t: ReturnType<typeof useT>["t"];
  onDelete: () => void;
  editingType: boolean;
  setEditingType: (v: boolean) => void;
  relTypes: string[];
  isOk: boolean;
  editingSource: boolean;
  setEditingSource: (v: boolean) => void;
  allElements: ElementOut[];
  srcEl: ElementOut | undefined;
  editingTarget: boolean;
  setEditingTarget: (v: boolean) => void;
  tgtEl: ElementOut | undefined;
}) {
  return (
    <div className="overflow-y-auto shrink-0 max-h-[55vh] space-y-3 pb-1">

      {/* Name + delete */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <InlineText
            value={rel.name ?? ""}
            onSave={(v) => saveField({ name: v || null })}
            className="text-xl sm:text-2xl font-semibold leading-tight block w-full"
            placeholder={t("relationships.placeholder")}
            disabled={!isAdmin}
          />
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={onDelete}
            className="shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5">
            <Trash2 className="size-3.5 mr-1.5" />{t("common.delete")}
          </Button>
        )}
      </div>

      {/* Compact editable fields */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">

        {/* Type */}
        <span className="text-muted-foreground text-xs whitespace-nowrap">{t("common.type")}</span>
        <div className="flex items-center gap-2 min-w-0">
          {isAdmin && editingType ? (
            <div className="flex items-center gap-2">
              <Select value={rel.type} onValueChange={async (v) => { if (v) await saveField({ type: v }); }} onOpenChange={(open) => { if (!open) setEditingType(false); }}>
                <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {relTypes.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setEditingType(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <Badge
              variant="secondary"
              className={`font-mono text-xs ${isAdmin ? "cursor-pointer hover:ring-1 hover:ring-ring" : ""}`}
              onDoubleClick={() => isAdmin && setEditingType(true)}
              title={isAdmin ? "Double-cliquer pour modifier" : undefined}
            >
              {rel.type}
            </Badge>
          )}
          {isOk ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700 shrink-0">
              ✓ {t("relationships.allowed")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/15 text-destructive shrink-0">
              ✕ {t("relationships.not_allowed")}
            </span>
          )}
        </div>

        {/* Source */}
        <span className="text-muted-foreground text-xs whitespace-nowrap">{t("common.source")}</span>
        <div className="min-w-0">
          {isAdmin && editingSource ? (
            <div className="flex items-center gap-2">
              <Select value={rel.source} onValueChange={async (v) => { if (v) await saveField({ source: v }); }} onOpenChange={(open) => { if (!open) setEditingSource(false); }}>
                <SelectTrigger className="h-7 text-xs w-full max-w-xs">
                  <span className="truncate">{srcEl?.name || rel.source_name || rel.source}</span>
                </SelectTrigger>
                <SelectContent>
                  {allElements.map((el) => (
                    <SelectItem key={el.identifier} value={el.identifier}>
                      {el.name || el.identifier}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{el.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setEditingSource(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 min-w-0 ${isAdmin ? "cursor-pointer group" : ""}`}
              onDoubleClick={() => isAdmin && setEditingSource(true)}
              title={isAdmin ? "Double-cliquer pour modifier" : undefined}
            >
              {srcEl ? (
                <Link href={`/elements/${encodeURIComponent(rel.source)}`} className="text-primary hover:underline font-medium truncate">
                  {srcEl.name || rel.source}
                </Link>
              ) : (
                <span className="text-muted-foreground/60 truncate">{rel.source_name || rel.source}</span>
              )}
              {srcEl && <span className="text-muted-foreground text-xs shrink-0">({srcEl.type})</span>}
              {isAdmin && <span className="opacity-0 group-hover:opacity-40 text-[10px] ml-1">✎</span>}
            </div>
          )}
        </div>

        {/* Target */}
        <span className="text-muted-foreground text-xs whitespace-nowrap">{t("common.target")}</span>
        <div className="min-w-0">
          {isAdmin && editingTarget ? (
            <div className="flex items-center gap-2">
              <Select value={rel.target} onValueChange={async (v) => { if (v) await saveField({ target: v }); }} onOpenChange={(open) => { if (!open) setEditingTarget(false); }}>
                <SelectTrigger className="h-7 text-xs w-full max-w-xs">
                  <span className="truncate">{tgtEl?.name || rel.target_name || rel.target}</span>
                </SelectTrigger>
                <SelectContent>
                  {allElements.map((el) => (
                    <SelectItem key={el.identifier} value={el.identifier}>
                      {el.name || el.identifier}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{el.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setEditingTarget(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 min-w-0 ${isAdmin ? "cursor-pointer group" : ""}`}
              onDoubleClick={() => isAdmin && setEditingTarget(true)}
              title={isAdmin ? "Double-cliquer pour modifier" : undefined}
            >
              {tgtEl ? (
                <Link href={`/elements/${encodeURIComponent(rel.target)}`} className="text-primary hover:underline font-medium truncate">
                  {tgtEl.name || rel.target}
                </Link>
              ) : (
                <span className="text-muted-foreground/60 truncate">{rel.target_name || rel.target}</span>
              )}
              {tgtEl && <span className="text-muted-foreground text-xs shrink-0">({tgtEl.type})</span>}
              {isAdmin && <span className="opacity-0 group-hover:opacity-40 text-[10px] ml-1">✎</span>}
            </div>
          )}
        </div>

        {/* Suggestions when invalid */}
        {!isOk && srcEl && tgtEl && (
          <>
            <span />
            <span className="text-xs text-destructive">
              {t("relationships.suggestions")} : {allowedRelationships(srcEl.type, tgtEl.type).join(", ") || t("common.none")}
            </span>
          </>
        )}

        {/* Documentation */}
        <span className="text-muted-foreground text-xs whitespace-nowrap self-start pt-0.5">{t("common.documentation")}</span>
        <InlineText
          value={rel.documentation ?? ""}
          onSave={(v) => saveField({ documentation: v || null })}
          className="text-sm text-muted-foreground leading-relaxed block w-full"
          placeholder={t("relationships.no_documentation")}
          multiline
          disabled={!isAdmin}
        />
      </div>

    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RelationshipDetailPage() {
  const { t } = useT();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true;
  const router = useRouter();

  const { data: rel, isLoading, error } = useRelationship(id);
  const { data: relViews = [] } = useRelationshipViews(id);
  const { data: allElements = [] } = useElements();
  const { data: relTypes = [] } = useRelationshipTypes();
  const { data: propDefs = [] } = usePropertyDefinitions();

  const updateMutation = useUpdateRelationship();
  const deleteMutation = useDeleteRelationship();
  const [deleteModal, deleteActions] = useFormModal<typeof rel>();
  const [activeTab, setActiveTab] = useState<"canvas" | "properties" | "views">("canvas");

  const saveField = useCallback(async (patch: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) => {
    await updateMutation.mutateAsync({ id, body: patch });
  }, [id, updateMutation]);

  const byId = useMemo(() => new Map(allElements.map((e) => [e.identifier, e])), [allElements]);

  const [editingType, setEditingType] = useState(false);
  const [editingSource, setEditingSource] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  // ── Properties CRUD ───────────────────────────────────────────────────────
  const properties: Property[] = rel?.properties ?? [];
  const usedRefs = useMemo(() => new Set(properties.map((p) => p.property_definition_ref)), [properties]);
  const availableDefs = useMemo(() => propDefs.filter((d) => !usedRefs.has(d.identifier)), [propDefs, usedRefs]);

  const [addingProp, setAddingProp] = useState(false);
  const [newPropRef, setNewPropRef] = useState("");
  const [newPropVal, setNewPropVal] = useState("");
  const [deletePropRef, setDeletePropRef] = useState<string | null>(null);

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

  async function handleDelete() {
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(id);
      router.push("/relationships");
    });
  }

  if (isLoading) {
    return <div className="px-4 sm:px-7 pt-6 text-muted-foreground text-sm">{t("common.loading")}</div>;
  }
  if (error || !rel) {
    return (
      <div className="px-4 sm:px-7 pt-6">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {t("common.error")}: {(error as Error | null)?.message ?? "Relation introuvable"}
        </div>
      </div>
    );
  }

  const srcEl = byId.get(rel.source);
  const tgtEl = byId.get(rel.target);
  const isOk = allowedRelationships(srcEl?.type, tgtEl?.type).includes(rel.type);

  const viewCounts = (() => {
    let ok = 0, bad = 0;
    for (const v of relViews) { if (v.conflict_count > 0) bad++; else ok++; }
    return { ok, bad };
  })();

  const viewColumns: ColumnDef<ViewOut>[] = [
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
  ];

  const tabs = [
    { id: "canvas",     label: t("relationships.tab_canvas") },
    { id: "properties", label: t("relationships.tab_properties"), count: properties.length },
    { id: "views",      label: t("relationships.tab_views") },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-var(--nav-h))] overflow-hidden px-4 sm:px-7 pt-4 sm:pt-6 pb-0">

      {/* Back */}
      <Link href="/relationships" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-3">
        <ChevronLeft className="size-3.5" />{t("breadcrumb.relationships")}
      </Link>

      {/* Header + fields — scrollable so the page stays usable on small screens */}
      <RelationshipFields
        rel={rel}
        isAdmin={isAdmin}
        saveField={saveField}
        t={t}
        onDelete={() => deleteActions.openWith(rel)}
        editingType={editingType}
        setEditingType={setEditingType}
        relTypes={relTypes}
        isOk={isOk}
        editingSource={editingSource}
        setEditingSource={setEditingSource}
        allElements={allElements}
        srcEl={srcEl}
        editingTarget={editingTarget}
        setEditingTarget={setEditingTarget}
        tgtEl={tgtEl}
      />

      {/* Tabs + content — fill remaining space */}
      <div className="flex flex-col flex-1 min-h-0 mt-4">
        <Tabs tabs={tabs} active={activeTab} onChange={(v) => setActiveTab(v as typeof activeTab)} />

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        {activeTab === "canvas" && (
          <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-border mt-3 mb-4 overflow-hidden bg-muted/20">
            {srcEl && tgtEl ? (
              <RelationshipCanvas
                relType={rel.type} relName={rel.name} isOk={isOk}
                srcId={rel.source} srcName={srcEl.name} srcType={srcEl.type}
                tgtId={rel.target} tgtName={tgtEl.name} tgtType={tgtEl.type}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            )}
          </div>
        )}

        {/* ── Propriétés ──────────────────────────────────────────────────── */}
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

        {/* ── Vues ────────────────────────────────────────────────────────── */}
        {activeTab === "views" && (
          <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-4">
            {relViews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("relationships.not_in_views_hint")}</p>
            ) : (
              <DataTable<ViewOut, unknown>
                columns={viewColumns}
                data={relViews}
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

      {/* Delete property confirmation */}
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

      {/* Delete dialog */}
      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("relationships.delete_title")}</DialogTitle>
            <DialogDescription>{t("relationships.delete_desc", { type: rel.type })}</DialogDescription>
          </DialogHeader>
          {deleteModal.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModal.isPending}>
              {deleteModal.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
