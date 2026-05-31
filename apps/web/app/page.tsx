"use client";

import { useModel, useElements } from "@/lib/queries";
import { getLayer, LAYER_HEX_COLORS as LAYER_COLORS } from "@/lib/archimate-helpers";
import type { ElementOut } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function OverviewPage() {
  const { t } = useT();
  const { data: model, isLoading: modelLoading, error: modelError } = useModel();
  const { data: elements = [], isLoading: elementsLoading } = useElements();

  const loading = modelLoading || elementsLoading;
  const error = modelError;

  const layerCounts = elements.reduce<Record<string, number>>((acc, el) => {
    const layer = getLayer(el.type);
    acc[layer] = (acc[layer] || 0) + 1;
    return acc;
  }, {});

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
        <StatCard label={t("overview.total_elements")} value={model?.element_count ?? 0} />
        {Object.entries(layerCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([layer, count]) => (
            <StatCard
              key={layer}
              label={t(`layer.${layer}` as Parameters<typeof t>[0]) || layer}
              value={count}
              color={LAYER_COLORS[layer]}
            />
          ))}
        <StatCard label={t("overview.relationships")} value={model?.relationship_count ?? 0} />
        <StatCard label={t("overview.views")} value={model?.view_count ?? 0} />
      </div>

    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">{label}</div>
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
