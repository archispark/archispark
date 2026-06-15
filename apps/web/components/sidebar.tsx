"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { LayoutDashboard, LayoutGrid, Tag, Settings as SettingsIcon, GitBranch, List, ChevronDown, PanelLeftClose, PanelLeftOpen, Upload, Download } from "lucide-react";
import { getLayer, LAYER_HEX_COLORS, LAYER_LABELS } from "@/lib/archimate-helpers";
import { allowedRelationships } from "@/lib/archimate-rules";
import { useModel, useElements, useRelationships, useElementsInViews, useImportModel } from "@/lib/queries";
import { exportModelUrl } from "@/lib/api";
import type { ModelInfo } from "@/lib/api";
import { useIsOrgAdmin } from "@/hooks/use-organization";
import { useT } from "@/lib/i18n";

interface LayerGroup {
  key: string;
  label: string;
  dot: string;
}

const LAYER_GROUPS: LayerGroup[] = Object.entries(LAYER_HEX_COLORS).map(([key, dot]) => ({
  key,
  dot,
  label: LAYER_LABELS[key] ?? key,
}));

/** Collapsible sidebar section with a clickable header (open by default). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="px-2 pt-2 pb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-6 flex items-center justify-between gap-2 text-[10px] font-bold tracking-[0.8px] uppercase text-muted-foreground px-2 mb-1 hover:text-foreground transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`size-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && children}
    </div>
  );
}

/** Single icon-only link shown in the collapsed sidebar rail. */
export function RailLink({ href, icon: Icon, label, active, onClick, badge }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: "amber" | "destructive";
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center size-9 rounded-md transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {badge && (
        <span className={`absolute top-1 right-1 size-1.5 rounded-full ${badge === "amber" ? "bg-amber-500" : "bg-destructive"}`} />
      )}
    </Link>
  );
}

/** Elements nav section: link to the list plus one entry per ArchiMate layer. */
function ElementsNavSection({ pathname, currentLayer, onClose, model, absentCount, layerCounts, t }: {
  pathname: string;
  currentLayer: string | null;
  onClose: () => void;
  model: ModelInfo | undefined;
  absentCount: number;
  layerCounts: Record<string, number>;
  t: ReturnType<typeof useT>["t"];
}) {
  return (
    <Section title={t("sidebar.elements")}>
      {/* Always-available entry to the elements list (and its create dialog),
          even for an empty model where no layer link would otherwise show. */}
      <Link
        href="/elements"
        onClick={onClose}
        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
          pathname === "/elements" && !currentLayer
            ? "bg-card text-foreground font-medium shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <List className="size-3.5 shrink-0" />
          {t("sidebar.list")}
        </span>
        <span className="flex items-center gap-1">
          {model && <span className="text-[11px] text-muted-foreground">{model.element_count}</span>}
          {absentCount > 0 && <span className="text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 px-1">{absentCount}</span>}
        </span>
      </Link>
      {LAYER_GROUPS.map((group) => {
        const active = pathname === "/elements" && currentLayer === group.key;
        return (
          <Link
            key={group.key}
            href={`/elements?layer=${group.key}`}
            onClick={onClose}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
              active
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ background: group.dot }}
              />
              {t(`layer.${group.key}` as Parameters<typeof t>[0]) || group.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {layerCounts[group.key] || 0}
            </span>
          </Link>
        );
      })}
    </Section>
  );
}

/** Desktop-only button that collapses/expands the sidebar to an icon rail. */
function CollapseToggle({ collapsed, onToggleCollapse, t }: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  t: ReturnType<typeof useT>["t"];
}) {
  return (
    <div className="hidden md:block border-t border-border px-2 py-2">
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        className={`flex items-center gap-2.5 rounded-md text-sm w-full transition-colors text-muted-foreground hover:bg-muted hover:text-foreground ${
          collapsed ? "justify-center size-9 mx-auto" : "px-3 py-2"
        }`}
      >
        {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
        {!collapsed && t("sidebar.collapse")}
      </button>
    </div>
  );
}

/** Import/export controls for the active workspace's model — owner/admin only. */
function ImportExportControls({ collapsed, onClose, t }: {
  collapsed: boolean;
  onClose: () => void;
  t: ReturnType<typeof useT>["t"];
}) {
  const importModel = useImportModel();
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(exportModelUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="?([^";\n]+)"?/)?.[1] ?? "model.xml";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const info = await importModel.mutateAsync(file);
      toast.success(t("sidebar.import_success", { name: info.name, n: info.element_count, v: info.view_count }));
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const importLabel = importModel.isPending ? t("common.loading") : t("sidebar.import");
  const exportLabel = exporting ? t("sidebar.exporting") : t("sidebar.export");

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".xml,application/xml,text/xml" className="hidden" onChange={handleImportChange} />
      {collapsed ? (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importModel.isPending}
            title={importLabel}
            aria-label={importLabel}
            className="flex items-center justify-center size-9 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 disabled:pointer-events-none"
          >
            <Upload className="size-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            title={exportLabel}
            aria-label={exportLabel}
            className="flex items-center justify-center size-9 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 disabled:pointer-events-none"
          >
            <Download className="size-4 shrink-0" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importModel.isPending}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 disabled:pointer-events-none"
          >
            <Upload className="size-4 shrink-0" />
            {importLabel}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60 disabled:pointer-events-none"
          >
            <Download className="size-4 shrink-0" />
            {exportLabel}
          </button>
        </>
      )}
    </>
  );
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: { open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <Suspense>
      <SidebarInner open={open} onClose={onClose} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </Suspense>
  );
}

function SidebarInner({ open, onClose, collapsed, onToggleCollapse }: { open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useT();
  // React Query so the sidebar reflects mutations (e.g. a newly created element
  // bumps the counts) as soon as their queries are invalidated.
  const { data: model } = useModel();
  const { data: elements = [] } = useElements();
  const { data: relationships = [] } = useRelationships();
  const { data: inViews = [] } = useElementsInViews();
  const isOrgAdmin = useIsOrgAdmin();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const byId = useMemo(() => new Map(elements.map((e) => [e.identifier, e])), [elements]);
  const inViewsSet = useMemo(() => new Set(inViews), [inViews]);

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const el of elements) {
      const layer = getLayer(el.type);
      counts[layer] = (counts[layer] || 0) + 1;
    }
    return counts;
  }, [elements]);

  const absentCount = useMemo(() =>
    elements.filter((e) => !inViewsSet.has(e.identifier)).length,
  [elements, inViewsSet]);

  const relConflictCount = useMemo(() =>
    relationships.filter((r) => {
      const src = byId.get(r.source);
      const tgt = byId.get(r.target);
      return !allowedRelationships(src?.type, tgt?.type).includes(r.type);
    }).length,
  [relationships, byId]);

  const currentLayer = pathname === "/elements" ? searchParams.get("layer") : null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-foreground/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-[var(--nav-h)] bottom-0 left-0 z-40 w-[var(--sidebar-w)] ${collapsed ? "md:w-[var(--sidebar-w-collapsed,56px)]" : ""} bg-secondary border-r border-border flex flex-col overflow-y-auto transition-[width,transform] duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Full content — hidden on desktop when the sidebar is collapsed to an icon rail */}
        <div className={collapsed ? "contents md:hidden" : "contents"}>
        {/* Model info */}
        {model && (
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="text-[13px] font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis mb-1">
              {model.name}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t("sidebar.model_summary", { n: model.element_count, r: model.relationship_count, v: model.view_count })}
            </div>
          </div>
        )}

        <div className="flex-1 py-2 overflow-y-auto">
          {/* Overview */}
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm no-underline transition-colors ${
              pathname === "/"
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            {t("sidebar.overview")}
          </Link>

          {/* Separator */}
          <div className="mx-4 mt-3 mb-1 border-t border-border" />

          {/* Layer sections */}
          <ElementsNavSection
            pathname={pathname}
            currentLayer={currentLayer}
            onClose={onClose}
            model={model}
            absentCount={absentCount}
            layerCounts={layerCounts}
            t={t}
          />

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Relations group */}
          <Section title={t("sidebar.relationships")}>
            <Link
              href="/relationships"
              onClick={onClose}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/relationships"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <GitBranch className="size-3.5 shrink-0" />
                {t("sidebar.list")}
              </span>
              <span className="flex items-center gap-1">
                {model && <span className="text-[11px] text-muted-foreground">{model.relationship_count}</span>}
                {relConflictCount > 0 && <span className="text-[10px] font-bold rounded-full bg-destructive/15 text-destructive px-1">{relConflictCount}</span>}
              </span>
            </Link>
          </Section>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Vues group */}
          <Section title={t("sidebar.views")}>
            <Link
              href="/views"
              onClick={onClose}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/views" || pathname.startsWith("/views/")
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <LayoutGrid className="size-3.5 shrink-0" />
                {t("sidebar.list")}
              </span>
              {model && (
                <span className="text-[11px] text-muted-foreground">{model.view_count}</span>
              )}
            </Link>
          </Section>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Propriétés group */}
          <Section title={t("sidebar.properties")}>
            <Link
              href="/properties"
              onClick={onClose}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/properties"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <Tag className="size-3.5 shrink-0" />
                {t("sidebar.list")}
              </span>
              {model && (
                <span className="text-[11px] text-muted-foreground">{model.property_definition_count}</span>
              )}
            </Link>
          </Section>

        </div>

        {/* Organisation & settings — bottom */}
        <div className="border-t border-border px-2 py-2 flex flex-col gap-1">
          {isOrgAdmin && <ImportExportControls collapsed={false} onClose={onClose} t={t} />}
          <Link
            href="/settings"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm no-underline transition-colors ${
              pathname === "/settings" || pathname.startsWith("/settings/")
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <SettingsIcon className="size-4 shrink-0" />
            {t("sidebar.settings")}
          </Link>
        </div>
        </div>

        {/* Icon rail — shown on desktop in place of the full content when collapsed */}
        <div className={`hidden flex-1 flex-col items-center gap-1 py-3 ${collapsed ? "md:flex" : ""}`}>
          <RailLink href="/" icon={LayoutDashboard} label={t("sidebar.overview")} active={pathname === "/"} onClick={onClose} />
          <div className="w-6 border-t border-border my-1" />
          <RailLink href="/elements" icon={List} label={t("sidebar.elements")} active={pathname === "/elements"} onClick={onClose} badge={absentCount > 0 ? "amber" : undefined} />
          <RailLink href="/relationships" icon={GitBranch} label={t("sidebar.relationships")} active={pathname === "/relationships"} onClick={onClose} badge={relConflictCount > 0 ? "destructive" : undefined} />
          <RailLink href="/views" icon={LayoutGrid} label={t("sidebar.views")} active={pathname === "/views" || pathname.startsWith("/views/")} onClick={onClose} />
          <RailLink href="/properties" icon={Tag} label={t("sidebar.properties")} active={pathname === "/properties"} onClick={onClose} />
        </div>

        <div className={`hidden border-t border-border py-2 flex-col items-center gap-1 ${collapsed ? "md:flex" : ""}`}>
          {isOrgAdmin && <ImportExportControls collapsed={true} onClose={onClose} t={t} />}
          <RailLink href="/settings" icon={SettingsIcon} label={t("sidebar.settings")} active={pathname === "/settings" || pathname.startsWith("/settings/")} onClick={onClose} />
        </div>

        {/* Collapse / expand toggle — desktop only */}
        <CollapseToggle collapsed={collapsed} onToggleCollapse={onToggleCollapse} t={t} />
      </aside>
    </>
  );
}

