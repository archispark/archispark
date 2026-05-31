"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronRight, ChevronDown } from "lucide-react";
import { allowedRelationships } from "@/lib/archimate-rules";
import type { ElementOut, RelationshipOut } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { useT } from "@/lib/i18n";

type Filter = "all" | "ok" | "conflict";

interface Row {
  id: string;
  type: string;
  sourceName: string;
  sourceType: string;
  targetName: string;
  targetType: string;
  ok: boolean;
  allowed: string[];
}

export function ValidatorTable({
  elements,
  relationships,
}: {
  elements: ElementOut[];
  relationships: RelationshipOut[];
}) {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const columns: ColumnDef<Row>[] = useMemo(() => [
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
          {row.getIsExpanded()
            ? <ChevronDown className="size-3.5" />
            : <ChevronRight className="size-3.5" />}
        </button>
      ),
    },
    {
      id: "status",
      header: t("validator.status"),
      accessorFn: (r) => (r.ok ? "OK" : t("common.conflicts")),
      cell: ({ row }) =>
        row.original.ok ? (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-700 text-[11px]">✓</span>
        ) : (
          <span className="inline-flex items-center justify-center size-5 rounded-full bg-destructive/15 text-destructive text-[11px]">✕</span>
        ),
    },
    {
      accessorKey: "type",
      header: t("common.type"),
      cell: ({ row }) => <span className="font-medium">{row.original.type}</span>,
    },
    {
      id: "source",
      header: t("common.source"),
      accessorFn: (r) => `${r.sourceName} ${r.sourceType}`,
      cell: ({ row }) => (
        <div>
          <div>{row.original.sourceName}</div>
          <div className="text-[11px] text-muted-foreground">{row.original.sourceType}</div>
        </div>
      ),
    },
    {
      id: "target",
      header: t("common.target"),
      accessorFn: (r) => `${r.targetName} ${r.targetType}`,
      cell: ({ row }) => (
        <div>
          <div>{row.original.targetName}</div>
          <div className="text-[11px] text-muted-foreground">{row.original.targetType}</div>
        </div>
      ),
    },
  ], [t]);

  const rows: Row[] = useMemo(() => {
    const byId = new Map(elements.map((e) => [e.identifier, e]));
    return relationships.map((rel) => {
      const src = byId.get(rel.source);
      const tgt = byId.get(rel.target);
      const allowed = allowedRelationships(src?.type, tgt?.type);
      return {
        id: rel.identifier,
        type: rel.type,
        sourceName: src?.name || "(?)",
        sourceType: src?.type || "?",
        targetName: tgt?.name || "(?)",
        targetType: tgt?.type || "?",
        ok: allowed.includes(rel.type),
        allowed,
      };
    });
  }, [elements, relationships]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "ok" && !r.ok) return false;
      if (filter === "conflict" && r.ok) return false;
      if (!q) return true;
      return (
        r.type.toLowerCase().includes(q) ||
        r.sourceName.toLowerCase().includes(q) ||
        r.targetName.toLowerCase().includes(q) ||
        r.sourceType.toLowerCase().includes(q) ||
        r.targetType.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const counts = useMemo(() => {
    let ok = 0, bad = 0;
    for (const r of rows) (r.ok ? ok++ : bad++);
    return { ok, bad, total: rows.length };
  }, [rows]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            {counts.ok} OK
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-destructive" />
            {counts.bad} {t("common.conflicts")}
          </span>
          <span className="text-muted-foreground">/ {counts.total}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("validator.search")}
            className="text-[13px] px-2 py-1 border border-border rounded-md bg-background text-foreground"
          />
          {(["all", "ok", "conflict"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[12px] px-2.5 py-1 rounded-md border ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {f === "all" ? t("validator.all") : f === "ok" ? t("validator.ok") : t("validator.conflicts")}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={10}
        renderSubRow={(row) => {
          const r = row.original as Row;
          return (
            <div className="text-[12px] text-muted-foreground space-y-0.5">
              {r.ok ? (
                <p><span className="text-emerald-700 font-medium">{t("validator.allowed")}</span> — {r.type} entre {r.sourceType} et {r.targetType}</p>
              ) : (
                <>
                  <p><span className="text-destructive font-medium">{t("validator.not_allowed")}</span> — {r.type} entre {r.sourceType} et {r.targetType}</p>
                  <p>{t("validator.suggestions")} : {r.allowed.length > 0 ? r.allowed.join(", ") : t("validator.none")}</p>
                </>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
