"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fetchPropertyDefinitions,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
  type PropertyDefinitionOut,
} from "@/lib/api";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { DataTable } from "@/components/data-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-current-user";
import { useT } from "@/lib/i18n";

const PROPERTY_TYPES = ["string", "boolean", "integer", "double", "date", "object"];

export default function PropertiesPage() {
  const { t } = useT();
  const isAdmin = useIsAdmin();
  const [defs, setDefs] = useState<PropertyDefinitionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const initialLoad = useRef(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("string");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PropertyDefinitionOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("string");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyDefinitionOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const reload = useCallback(() => {
    setLoading(true);
    fetchPropertyDefinitions()
      .then(setDefs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPropertyDefinitions()
      .then((d) => { setDefs(d); initialLoad.current = false; })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function openEdit(pd: PropertyDefinitionOut) {
    setEditTarget(pd);
    setEditName(pd.name);
    setEditType(pd.type || "string");
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(pd: PropertyDefinitionOut) {
    setDeleteTarget(pd);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createPropertyDefinition({ name: newName.trim(), type: newType });
      setCreateOpen(false);
      setNewName(""); setNewType("string");
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    setEditError(null);
    try {
      await updatePropertyDefinition(editTarget.identifier, { name: editName.trim(), type: editType });
      setEditOpen(false);
      reload();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePropertyDefinition(deleteTarget.identifier);
      setDeleteOpen(false);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    if (!debouncedSearch) return defs;
    const q = debouncedSearch.toLowerCase();
    return defs.filter((d) => d.name.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q));
  }, [defs, debouncedSearch]);

  const columns: ColumnDef<PropertyDefinitionOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name") || "—"}</span>,
    },
    {
      accessorKey: "type",
      header: t("common.type"),
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono text-xs">{row.getValue("type") || "string"}</Badge>
      ),
    },
    {
      accessorKey: "identifier",
      header: t("common.identifier"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-xs block">
          {row.getValue("identifier")}
        </span>
      ),
    },
    ...(isAdmin ? [{
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }: { row: { original: PropertyDefinitionOut } }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(row.original)} aria-label={t("common.edit")}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label={t("common.delete")}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  ], [isAdmin]);

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
          <h1 className="text-lg font-semibold">{t("properties.title")}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {t("properties.count", { n: filtered.length, s: filtered.length !== 1 ? "s" : "" })}
          </p>
        </div>

        {isAdmin && <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouvelle définition
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("properties.new_title")}</DialogTitle>
              <DialogDescription>{t("properties.new_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pd-name">{t("common.name")} *</Label>
                <Input
                  id="pd-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("properties.placeholder")}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("properties.value_type")}</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v ?? "string")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {createError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {createError}
              </div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>

      <Input
        placeholder={t("properties.search")}
        className="max-w-xs"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("properties.edit_title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-pd-name">{t("common.name")} *</Label>
              <Input
                id="edit-pd-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("properties.value_type")}</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v ?? "string")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {editError}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("properties.delete_title")}</DialogTitle>
            <DialogDescription>
              {t("properties.delete_desc", { name: deleteTarget?.name || "?" })}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
