"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fetchModel,
  fetchElementTypes,
  fetchElements,
  type ModelInfo,
  type ElementOut,
} from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select";
import { DataTable } from "@/components/data-table";

const LAYER_COLORS: Record<string, string> = {
  Business: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Application: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Technology: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Physical: "bg-green-200 text-green-900 dark:bg-green-800/40 dark:text-green-200",
  Motivation: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Strategy: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Implementation: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Composite: "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300",
};

function getLayer(type: string): string {
  if (type.startsWith("Business") || ["Contract", "Representation", "Product"].includes(type))
    return "Business";
  if (type.startsWith("Application") || type === "DataObject") return "Application";
  if (
    type.startsWith("Technology") ||
    ["Node", "Device", "SystemSoftware", "Path", "CommunicationNetwork", "Artifact"].includes(type)
  )
    return "Technology";
  if (["Equipment", "Facility", "DistributionNetwork", "Material"].includes(type)) return "Physical";
  if (
    ["Stakeholder", "Driver", "Assessment", "Goal", "Outcome", "Principle", "Requirement", "Constraint", "Meaning", "Value"].includes(type)
  )
    return "Motivation";
  if (["Resource", "Capability", "CourseOfAction", "ValueStream"].includes(type)) return "Strategy";
  if (["WorkPackage", "Deliverable", "ImplementationEvent", "Plateau", "Gap"].includes(type))
    return "Implementation";
  return "Composite";
}

const columns: ColumnDef<ElementOut>[] = [
  {
    accessorKey: "name",
    header: "Nom",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("name") || "—"}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {row.getValue("type")}
      </Badge>
    ),
  },
  {
    id: "layer",
    header: "Layer",
    accessorFn: (row) => getLayer(row.type),
    cell: ({ getValue }) => {
      const layer = getValue<string>();
      return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_COLORS[layer] ?? ""}`}>
          {layer}
        </span>
      );
    },
  },
  {
    accessorKey: "documentation",
    header: "Documentation",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="max-w-xs truncate block text-muted-foreground">
        {row.getValue("documentation") || "—"}
      </span>
    ),
  },
];

export default function Page() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [elements, setElements] = useState<ElementOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    Promise.all([fetchModel(), fetchElementTypes(), fetchElements()])
      .then(([m, t, e]) => {
        setModel(m);
        setTypes(t);
        setElements(e);
        initialLoad.current = false;
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialLoad.current) return;
    setLoading(true);
    fetchElements(typeFilter, debouncedSearch || null)
      .then(setElements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [typeFilter, debouncedSearch]);

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const t of types) {
      const layer = getLayer(t);
      (groups[layer] ??= []).push(t);
    }
    return groups;
  }, [types]);

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erreur</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Assurez-vous que l&apos;API ArchiMate tourne sur le port 8000.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-svh p-6 space-y-6">
      {model && (
        <Card>
          <CardHeader>
            <CardTitle>{model.name}</CardTitle>
            <CardDescription>
              {model.element_count} elements &middot; {model.relationship_count} relations &middot;{" "}
              {model.view_count} vues
              {model.version && <> &middot; v{model.version}</>}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher par nom..."
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={typeFilter ?? ""}
          onValueChange={(val) => setTypeFilter(val || null)}
        >
          <SelectTrigger className="min-w-[180px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les types</SelectItem>
            {Object.values(grouped).map((layerTypes) =>
              layerTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={elements} loading={loading} />
    </div>
  );
}
