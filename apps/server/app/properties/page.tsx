"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import {
  fetchPropertyDefinitions,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
  type PropertyDefinitionOut,
} from "@/lib/api"
import { Input } from "@workspace/ui/components/input"
import { DataTable } from "@/components/data-table"
import {
  CreatePropertyDefinitionDialog,
  EditPropertyDefinitionDialog,
  DeletePropertyDefinitionDialog,
} from "@/components/property-definition-dialogs"
import { usePropertyDefinitionColumns } from "@/components/property-definition-columns"
import { useT } from "@/lib/i18n"

export default function PropertiesPage() {
  const { t } = useT()
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const [defs, setDefs] = useState<PropertyDefinitionOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const initialLoad = useRef(true)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("string")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PropertyDefinitionOut | null>(
    null
  )
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState("string")
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] =
    useState<PropertyDefinitionOut | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const reload = useCallback(() => {
    setLoading(true)
    fetchPropertyDefinitions()
      .then(setDefs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPropertyDefinitions()
      .then((d) => {
        setDefs(d)
        initialLoad.current = false
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function openEdit(pd: PropertyDefinitionOut) {
    setEditTarget(pd)
    setEditName(pd.name)
    setEditType(pd.type || "string")
    setEditError(null)
    setEditOpen(true)
  }

  function openDelete(pd: PropertyDefinitionOut) {
    setDeleteTarget(pd)
    setDeleteError(null)
    setDeleteOpen(true)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await createPropertyDefinition({ name: newName.trim(), type: newType })
      setCreateOpen(false)
      setNewName("")
      setNewType("string")
      reload()
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim()) return
    setSaving(true)
    setEditError(null)
    try {
      await updatePropertyDefinition(editTarget.identifier, {
        name: editName.trim(),
        type: editType,
      })
      setEditOpen(false)
      reload()
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePropertyDefinition(deleteTarget.identifier)
      setDeleteOpen(false)
      reload()
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!debouncedSearch) return defs
    const q = debouncedSearch.toLowerCase()
    return defs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q)
    )
  }, [defs, debouncedSearch])

  const columns = usePropertyDefinitionColumns({
    isAdmin,
    onEdit: openEdit,
    onDelete: openDelete,
  })

  if (error) {
    return (
      <div className="p-7">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("common.error")} : {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("properties.title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("properties.count", {
              n: filtered.length,
              s: filtered.length !== 1 ? "s" : "",
            })}
          </p>
        </div>

        {isAdmin && (
          <CreatePropertyDefinitionDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            name={newName}
            onNameChange={setNewName}
            type={newType}
            onTypeChange={setNewType}
            error={createError}
            creating={creating}
            onCreate={handleCreate}
          />
        )}
      </div>

      <Input
        placeholder={t("properties.search")}
        className="max-w-xs"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <EditPropertyDefinitionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        name={editName}
        onNameChange={setEditName}
        type={editType}
        onTypeChange={setEditType}
        error={editError}
        saving={saving}
        onSave={handleEdit}
      />

      <DeletePropertyDefinitionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        targetName={deleteTarget?.name || "?"}
        error={deleteError}
        deleting={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
