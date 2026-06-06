"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchView, fetchElements, fetchRelationships,
  type ViewDetail, type ElementOut, type RelationshipOut,
} from "@/lib/api";
import { useViewpoints, useUpdateView, useDeleteView } from "@/lib/queries";
import { ViewCanvas } from "@/components/view-canvas";
import { ValidatorTable } from "@/components/validator-table";
import { Button } from "@workspace/ui/components/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from "@workspace/ui/components/dialog";
import { ChevronLeft, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-current-user";
import { useT } from "@/lib/i18n";

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ViewDetailPage() {
  const { t } = useT();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const [view, setView] = useState<ViewDetail | null>(null);
  const [elementsList, setElementsList] = useState<ElementOut[]>([]);
  const [relationshipsList, setRelationshipsList] = useState<RelationshipOut[]>([]);
  const [elementNames, setElementNames] = useState<Map<string, string>>(new Map());
  const [elementTypes, setElementTypes] = useState<Map<string, string>>(new Map());
  const [relationshipTypes, setRelationshipTypes] = useState<Map<string, string>>(new Map());
  const [relationshipNames, setRelationshipNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: viewpoints = [] } = useViewpoints();
  const updateMutation = useUpdateView();
  const deleteMutation = useDeleteView();

  const [editingViewpoint, setEditingViewpoint] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function reload() {
    setLoading(true);
    Promise.all([fetchView(id), fetchElements(), fetchRelationships()])
      .then(([v, elements, relationships]) => {
        setView(v);
        setElementsList(elements);
        setElementNames(new Map(elements.map((e) => [e.identifier, e.name])));
        setElementTypes(new Map(elements.map((e) => [e.identifier, e.type])));
        setRelationshipsList(relationships);
        setRelationshipTypes(new Map(relationships.map((r) => [r.identifier, r.type])));
        setRelationshipNames(new Map(relationships.filter((r): r is typeof r & { name: string } => r.name !== null).map((r) => [r.identifier, r.name])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [id]);

  const saveField = useCallback(async (patch: { name?: string; viewpoint?: string | null; documentation?: string | null }) => {
    if (!view) return;
    await updateMutation.mutateAsync({ id: view.identifier, body: patch });
    reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.identifier, updateMutation]);

  async function handleDelete() {
    if (!view) return;
    await deleteMutation.mutateAsync(view.identifier);
    router.push("/views");
  }

  if (loading) {
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
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {t("common.error")} : {error}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-7 pt-4 sm:pt-6 pb-6 space-y-5">

      {/* Back */}
      <Link href="/views" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="size-3.5" />{t("breadcrumb.views")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">

          {/* Viewpoint badge */}
          <div>
            {isAdmin && editingViewpoint ? (
              <Select
                value={view?.viewpoint ?? ""}
                onValueChange={async (v) => { await saveField({ viewpoint: v || null }); setEditingViewpoint(false); }}
              >
                <SelectTrigger className="h-6 text-xs w-52">
                  <SelectValue placeholder={t("views.no_viewpoint_short")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("views.no_viewpoint_short")}</SelectItem>
                  {viewpoints.map((vp) => <SelectItem key={vp} value={vp}>{vp}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <span
                onDoubleClick={() => isAdmin && setEditingViewpoint(true)}
                className={`inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground ${isAdmin ? "cursor-pointer hover:ring-1 hover:ring-ring group" : ""}`}
                title={isAdmin ? "Double-cliquer pour modifier le viewpoint" : undefined}
              >
                {view?.viewpoint || <span className="italic opacity-60">{t("views.no_viewpoint_short")}</span>}
                {isAdmin && <span className="ml-1 opacity-0 group-hover:opacity-40 text-[10px]">✎</span>}
              </span>
            )}
          </div>

          {/* Name */}
          <InlineText
            value={view?.name ?? ""}
            onSave={(v) => saveField({ name: v })}
            className="text-xl sm:text-2xl font-semibold leading-tight block w-full"
            placeholder={t("views.unnamed")}
            disabled={!isAdmin}
          />

          {/* Documentation */}
          <InlineText
            value={view?.documentation ?? ""}
            onSave={(v) => saveField({ documentation: v || null })}
            className="text-sm text-muted-foreground leading-relaxed block w-full"
            placeholder={t("elements.no_documentation")}
            multiline
            disabled={!isAdmin}
          />

          {/* Stats */}
          <div className="text-muted-foreground text-[12px]">
            {t("views.nodes_count", { n: view?.nodes.length ?? 0, s: (view?.nodes.length ?? 0) !== 1 ? "s" : "", c: view?.connections.length ?? 0 })}
          </div>
        </div>

        {/* Delete button */}
        {isAdmin && view && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            {t("common.delete")}
          </Button>
        )}
      </div>

      {/* Canvas + Validator */}
      <div className="space-y-4">
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {view ? (
            <ViewCanvas viewId={id} nodes={view.nodes} connections={view.connections} elements={elementsList} elementNames={elementNames} elementTypes={elementTypes} relationshipTypes={relationshipTypes} relationshipNames={relationshipNames} />
          ) : null}
        </div>

        {view && (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
              {t("views.validator_section")}
            </div>
            <ValidatorTable
              elements={elementsList}
              relationships={(() => {
                const refs = new Set(view.connections.map((c) => c.relationship_ref).filter((r): r is string => !!r));
                return relationshipsList.filter((r) => refs.has(r.identifier));
              })()}
            />
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("views.delete_title")}</DialogTitle>
            <DialogDescription>
              {t("views.delete_desc", { name: view?.name || "?" })}
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {(deleteMutation.error as Error).message}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
