"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchView, fetchElements, fetchRelationships, viewImageUrl, type ViewDetail, type ElementOut, type RelationshipOut } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";
import { ViewCanvas } from "@/components/view-canvas";
import { ValidatorTable } from "@/components/validator-table";
import { useT } from "@/lib/i18n";

type Tab = "canvas" | "svg";

function useImageBlob(id: string, format: "svg" | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  useEffect(() => {
    if (!format) return;
    let revoked = false;
    setBlobUrl(null);
    setImgError(null);

    fetch(viewImageUrl(id), {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch((err) => {
        if (!revoked) setImgError((err as Error).message);
      });

    return () => {
      revoked = true;
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [id, format]);

  return { blobUrl, imgError };
}

export default function ViewDetailPage() {
  const { t } = useT();
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
  const [tab, setTab] = useState<Tab>("canvas");

  const imageFormat = tab === "svg" ? tab : null;
  const { blobUrl, imgError } = useImageBlob(id, imageFormat);

  useEffect(() => {
    Promise.all([fetchView(id), fetchElements(), fetchRelationships()])
      .then(([v, elements, relationships]) => {
        setView(v);
        setElementsList(elements);
        setElementNames(new Map(elements.map((e) => [e.identifier, e.name])));
        setElementTypes(new Map(elements.map((e) => [e.identifier, e.type])));
        setRelationshipsList(relationships);
        setRelationshipTypes(new Map(relationships.map((r) => [r.identifier, r.type])));
        setRelationshipNames(new Map(relationships.filter((r) => r.name).map((r) => [r.identifier, r.name])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{view?.name || t("views.unnamed")}</h1>
          {view?.documentation && (
            <p className="text-muted-foreground text-[13px] mt-0.5">{view.documentation}</p>
          )}
          <div className="text-muted-foreground text-[12px] mt-1">
            {t("views.nodes_count", { n: view?.nodes.length ?? 0, c: view?.connections.length ?? 0 })}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={tab === "canvas" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("canvas")}
          >
            Canvas
          </Button>
          <Button
            variant={tab === "svg" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("svg")}
          >
            SVG
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {view ? (
            <div style={{ display: tab === "canvas" ? "block" : "none" }}>
              <ViewCanvas viewId={id} nodes={view.nodes} connections={view.connections} elements={elementsList} elementNames={elementNames} elementTypes={elementTypes} relationshipTypes={relationshipTypes} relationshipNames={relationshipNames} />
            </div>
          ) : null}
          {tab === "svg" ? (
            imgError ? (
              <div className="p-4 text-sm text-destructive bg-destructive/10 border-t border-destructive/30">
                {t("common.error")} : {imgError}
              </div>
            ) : blobUrl ? (
              <div className="overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={blobUrl}
                  alt={view?.name || "View"}
                  className="max-w-full h-auto"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground p-8">
                <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
                {t("views.loading_image")}
              </div>
            )
          ) : null}
        </div>

        {view && tab === "canvas" && (
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
    </div>
  );
}
