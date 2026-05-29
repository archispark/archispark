"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchView, fetchElements, fetchRelationships, viewImageUrl, type ViewDetail } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";
import { ViewCanvas } from "@/components/view-canvas";

type Tab = "canvas" | "svg" | "png";

function useImageBlob(id: string, format: "svg" | "png" | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  useEffect(() => {
    if (!format) return;
    let revoked = false;
    setBlobUrl(null);
    setImgError(null);

    const token = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)?.[1];
    fetch(viewImageUrl(id, format), {
      headers: token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {},
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
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [view, setView] = useState<ViewDetail | null>(null);
  const [elementNames, setElementNames] = useState<Map<string, string>>(new Map());
  const [elementTypes, setElementTypes] = useState<Map<string, string>>(new Map());
  const [relationshipTypes, setRelationshipTypes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("canvas");

  const imageFormat = tab === "svg" || tab === "png" ? tab : null;
  const { blobUrl, imgError } = useImageBlob(id, imageFormat);

  useEffect(() => {
    Promise.all([fetchView(id), fetchElements(), fetchRelationships()])
      .then(([v, elements, relationships]) => {
        setView(v);
        setElementNames(new Map(elements.map((e) => [e.identifier, e.name])));
        setElementTypes(new Map(elements.map((e) => [e.identifier, e.type])));
        setRelationshipTypes(new Map(relationships.map((r) => [r.identifier, r.type])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <div className="size-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{view?.name || "Sans nom"}</h1>
          {view?.documentation && (
            <p className="text-muted-foreground text-[13px] mt-0.5">{view.documentation}</p>
          )}
          <div className="text-muted-foreground text-[12px] mt-1">
            {view?.nodes.length ?? 0} nœuds · {view?.connections.length ?? 0} connexions
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
          <Button
            variant={tab === "png" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("png")}
          >
            PNG
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {tab === "canvas" && view ? (
          <ViewCanvas nodes={view.nodes} connections={view.connections} elementNames={elementNames} elementTypes={elementTypes} relationshipTypes={relationshipTypes} />
        ) : imgError ? (
          <div className="p-4 text-sm text-destructive bg-destructive/10 border-t border-destructive/30">
            Erreur : {imgError}
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
            Chargement de l&apos;image…
          </div>
        )}
      </div>
    </div>
  );
}
