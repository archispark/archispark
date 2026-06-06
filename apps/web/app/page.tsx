"use client";

import { useMemo } from "react";
import { useModel, useElements, useRelationships, useElementsInViews } from "@/lib/queries";
import { getLayer, LAYER_HEX_COLORS as LAYER_COLORS } from "@/lib/archimate-helpers";
import { allowedRelationships } from "@/lib/archimate-rules";
import type { ElementOut, RelationshipOut } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function OverviewPage() {
  const { t } = useT();
  const { data: model, isLoading: modelLoading, error: modelError } = useModel();
  const { data: elements = [], isLoading: elementsLoading } = useElements();
  const { data: relationships = [], isLoading: relsLoading } = useRelationships();
  const { data: inViews = [] } = useElementsInViews();

  const loading = modelLoading || elementsLoading || relsLoading;
  const error = modelError;

  const layerCounts = elements.reduce<Record<string, number>>((acc, el) => {
    const layer = getLayer(el.type);
    acc[layer] = (acc[layer] || 0) + 1;
    return acc;
  }, {});

  const byId = useMemo(() => new Map(elements.map((e) => [e.identifier, e])), [elements]);
  const inViewsSet = useMemo(() => new Set(inViews), [inViews]);

  const conflictingRels = useMemo(() =>
    relationships.filter((r) => {
      const src = byId.get(r.source);
      const tgt = byId.get(r.target);
      return !allowedRelationships(src?.type, tgt?.type).includes(r.type);
    }),
  [relationships, byId]);

  const absentElements = useMemo(() =>
    elements.filter((e) => !inViewsSet.has(e.identifier)),
  [elements, inViewsSet]);

  const absentByLayer = useMemo(() =>
    absentElements.reduce<Record<string, number>>((acc, el) => {
      const layer = getLayer(el.type);
      acc[layer] = (acc[layer] || 0) + 1;
      return acc;
    }, {}),
  [absentElements]);

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
      <div className="p-8">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {t("common.error")} : {(error as Error).message}
        </div>
        <p className="text-muted-foreground text-xs mt-2">
          {t("overview.api_hint")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-5xl">
      {model && (
        <div className="mb-6">
          <h1 className="text-lg font-semibold">{model.name}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {model.documentation || t("overview.archimate_model")}
            {model.version && <> · v{model.version}</>}
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-3">
        {t("overview.model_apercu")}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 mb-7">
        <StatCard
          label={t("overview.total_elements")}
          value={model?.element_count ?? 0}
          sub={{ label: "absents des vues", value: absentElements.length, total: model?.element_count ?? 0, color: "#d97706" }}
        />
        {Object.entries(layerCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([layer, count]) => {
            const absent = absentByLayer[layer] ?? 0;
            return (
              <StatCard
                key={layer}
                label={t(`layer.${layer}` as Parameters<typeof t>[0]) || layer}
                value={count}
                color={LAYER_COLORS[layer]}
                sub={{ label: "absents", value: absent, total: count, color: "#d97706" }}
              />
            );
          })}
        <StatCard label={t("overview.relationships")} value={model?.relationship_count ?? 0} sub={{ label: "en erreur", value: conflictingRels.length, total: model?.relationship_count ?? 0, color: "#dc2626" }} />
        <StatCard label={t("overview.views")} value={model?.view_count ?? 0} sub={{ label: "", value: 0, total: model?.view_count || 1, color: "#10b981" }} />
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 gap-6">
        {elements.length > 0 && <TypePieChart elements={elements} />}
        {relationships.length > 0 && <RelPieChart relationships={relationships} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: { label: string; value: number; total: number; color: string } }) {
  const okRatio = sub && sub.total > 0 ? Math.min((sub.total - sub.value) / sub.total, 1) : 1;
  const hasError = sub ? sub.value > 0 : false;
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</div>
      {sub && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${okRatio * 100}%`, backgroundColor: hasError ? sub.color : "#10b981" }}
            />
          </div>
          {hasError && (
            <div className="text-[10px] font-medium" style={{ color: sub.color }}>
              {sub.value} {sub.label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut pie chart — generic, no external dependency
// ---------------------------------------------------------------------------

const TOP_N = 14;

const RELATIONSHIP_COLORS: Record<string, string> = {
  Composition:    "#2563eb",
  Aggregation:    "#7c3aed",
  Assignment:     "#0891b2",
  Realization:    "#0d9488",
  Serving:        "#16a34a",
  Access:         "#059669",
  Influence:      "#d97706",
  Triggering:     "#ea580c",
  Flow:           "#dc2626",
  Association:    "#64748b",
  Specialization: "#db2777",
};

function polarXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  a0: number,
  a1: number,
) {
  const sweep = a1 - a0;
  const end = sweep >= 360 ? a0 + 359.999 : a1;
  const os = polarXY(cx, cy, ro, a0);
  const oe = polarXY(cx, cy, ro, end);
  const is = polarXY(cx, cy, ri, end);
  const ie = polarXY(cx, cy, ri, a0);
  const large = sweep > 180 ? 1 : 0;
  return (
    `M${os.x},${os.y} A${ro},${ro} 0 ${large} 1 ${oe.x},${oe.y}` +
    ` L${is.x},${is.y} A${ri},${ri} 0 ${large} 0 ${ie.x},${ie.y}Z`
  );
}

interface SliceData {
  label: string;
  count: number;
  color: string;
}

function DonutChart({
  data,
  total,
  centerLabel,
}: {
  data: SliceData[];
  total: number;
  centerLabel: string;
}) {
  const cx = 90, cy = 90, ro = 82, ri = 50;
  let angle = 0;

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
      <svg width={180} height={180} viewBox="0 0 180 180" className="shrink-0" aria-hidden="true">
        {data.map(({ label, count, color }) => {
          const sweep = (count / total) * 360;
          const a0 = angle;
          angle += sweep;
          return (
            <path
              key={label}
              d={donutSlicePath(cx, cy, ro, ri, a0, angle)}
              fill={color}
              stroke="var(--card, #fff)"
              strokeWidth={1.5}
            >
              <title>{label}: {count}</title>
            </path>
          );
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={26} fontWeight="700" fill="currentColor">
          {total}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.45}>
          {centerLabel}
        </text>
      </svg>

      <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-4 self-center w-full">
        {data.map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-2 min-w-0">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[12px] text-muted-foreground truncate flex-1">{label}</span>
            <span className="text-[12px] font-semibold tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypePieChart({ elements }: { elements: ElementOut[] }) {
  const { t } = useT();

  const typeCounts = elements.reduce<Record<string, number>>((acc, el) => {
    acc[el.type] = (acc[el.type] || 0) + 1;
    return acc;
  }, {});

  const total = elements.length;
  const sorted = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);
  const top = sorted.slice(0, TOP_N);
  const restCount = sorted.slice(TOP_N).reduce((s, [, c]) => s + c, 0);

  const data: SliceData[] = top.map(([type, count]) => ({
    label: type,
    count,
    color: LAYER_COLORS[getLayer(type)] ?? "#94a3b8",
  }));
  if (restCount > 0) {
    data.push({ label: t("overview.other"), count: restCount, color: "#94a3b8" });
  }

  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-3">
        {t("overview.elements_by_type")}
      </div>
      <div className="bg-card border border-border rounded-lg p-5">
        <DonutChart data={data} total={total} centerLabel={t("overview.total_elements")} />
      </div>
    </div>
  );
}

function RelPieChart({ relationships }: { relationships: RelationshipOut[] }) {
  const { t } = useT();

  const typeCounts = relationships.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const total = relationships.length;
  const sorted = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);
  const top = sorted.slice(0, TOP_N);
  const restCount = sorted.slice(TOP_N).reduce((s, [, c]) => s + c, 0);

  const data: SliceData[] = top.map(([type, count]) => ({
    label: type,
    count,
    color: RELATIONSHIP_COLORS[type] ?? "#94a3b8",
  }));
  if (restCount > 0) {
    data.push({ label: t("overview.other"), count: restCount, color: "#94a3b8" });
  }

  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-muted-foreground mb-3">
        {t("overview.relationships_by_type")}
      </div>
      <div className="bg-card border border-border rounded-lg p-5">
        <DonutChart data={data} total={total} centerLabel={t("overview.relationships")} />
      </div>
    </div>
  );
}
