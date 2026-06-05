"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useMemo } from "react";
import { LayoutDashboard, LayoutGrid, Tag, Users, Settings as SettingsIcon, GitBranch, List, ChevronDown } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-current-user";
import { getLayer, LAYER_HEX_COLORS, LAYER_LABELS } from "@/lib/archimate-helpers";
import { useModel, useElements } from "@/lib/queries";
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

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Suspense>
      <SidebarInner open={open} onClose={onClose} />
    </Suspense>
  );
}

function SidebarInner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useT();
  // React Query so the sidebar reflects mutations (e.g. a newly created element
  // bumps the counts) as soon as their queries are invalidated.
  const { data: model } = useModel();
  const { data: elements = [] } = useElements();
  const [mounted, setMounted] = useState(false);
  const isAdmin = useIsAdmin();

  useEffect(() => { setMounted(true); }, []);

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const el of elements) {
      const layer = getLayer(el.type);
      counts[layer] = (counts[layer] || 0) + 1;
    }
    return counts;
  }, [elements]);

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
        className={`fixed top-[var(--nav-h)] bottom-0 left-0 z-40 w-[var(--sidebar-w)] bg-secondary border-r border-border flex flex-col overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
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

          {/* Landscape views */}
          <Section title={t("sidebar.landscapes")}>
            <Link
              href="/capabilities"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/capabilities"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "#2563eb" }} />
              {t("sidebar.capabilities")}
            </Link>
            <Link
              href="/strategy"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/strategy"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "#dc2626" }} />
              {t("sidebar.strategy")}
            </Link>
            <Link
              href="/composition"
              onClick={onClose}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                pathname === "/composition"
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: "#64748b" }} />
              {t("sidebar.composition")}
            </Link>
          </Section>

          {/* Separator */}
          <div className="mx-4 mt-2 mb-1 border-t border-border" />

          {/* Layer sections */}
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
              {model && (
                <span className="text-[11px] text-muted-foreground">{model.element_count}</span>
              )}
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
              {model && (
                <span className="text-[11px] text-muted-foreground">{model.relationship_count}</span>
              )}
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

        {/* Settings — bottom */}
        {mounted && isAdmin && (
          <div className="border-t border-border px-2 py-2">
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
        )}
      </aside>
    </>
  );
}

