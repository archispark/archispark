"use client"

import { useState, useMemo } from "react"
import { useDebounce } from "use-debounce"
import { type RelationshipOut, type ElementOut, type Property } from "@/lib/api"
import {
  useRelationships,
  useRelationshipTypes,
  useElements,
  useCreateRelationship,
  useUpdateRelationship,
  useDeleteRelationship,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { DataTable } from "@/components/data-table"
import {
  useRelationshipColumns,
  RelationshipSubRow,
  RelationshipStats,
} from "@/components/relationship-columns"
import { CreateRelationshipDialog } from "@/components/relationship-create-dialog"
import {
  EditRelationshipDialog,
  DeleteRelationshipDialog,
} from "@/components/relationship-dialogs"
import { type RelationshipFormFields } from "@/components/relationship-form-fields"
import { RelationshipsFilterBar } from "@/components/relationship-filter-bar"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { useT } from "@/lib/i18n"
import { allowedRelationships } from "@/lib/archimate-rules"

export default function RelationshipsPage() {
  const { t } = useT()
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const [search, setSearch] = useState("")
  const [debouncedSearch] = useDebounce(search, 300)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "conflict">(
    "all"
  )

  // Form fields shared between create/edit
  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [source, setSource] = useState("")
  const [target, setTarget] = useState("")
  const [doc, setDoc] = useState("")
  const [props, setProps] = useState<Property[]>([])

  const { data: types = [] } = useRelationshipTypes()
  const {
    data: relationships = [],
    isLoading: loading,
    error,
  } = useRelationships(typeFilter, debouncedSearch || null)
  const { data: allElements = [] } = useElements()

  const createMutation = useCreateRelationship()
  const updateMutation = useUpdateRelationship()
  const deleteMutation = useDeleteRelationship()

  const [createModal, createActions] = useFormModal<null>()
  const [editModal, editActions] = useFormModal<RelationshipOut>()
  const [deleteModal, deleteActions] = useFormModal<RelationshipOut>()

  const byId = useMemo(
    () =>
      new Map<string, ElementOut>(allElements.map((e) => [e.identifier, e])),
    [allElements]
  )
  const byRelId = useMemo(
    () =>
      new Map<string, RelationshipOut>(
        relationships.map((r) => [r.identifier, r])
      ),
    [relationships]
  )

  useKeyboardShortcut(
    "n",
    () => {
      if (isAdmin) openCreate()
    },
    { enabled: !createModal.open }
  )

  function openCreate() {
    setName("")
    setType("")
    setSource("")
    setTarget("")
    setDoc("")
    setProps([])
    createActions.openNew()
  }

  async function handleCreate() {
    if (!type || !source || !target) return
    await createActions.run(async () => {
      await createMutation.mutateAsync({
        name: name.trim() || null,
        type,
        source,
        target,
        documentation: doc.trim() || null,
        properties: props,
      })
    })
  }

  async function handleEdit() {
    if (!editModal.target || !type || !source || !target) return
    await editActions.run(async () => {
      await updateMutation.mutateAsync({
        id: editModal.target!.identifier,
        body: {
          name: name.trim() || null,
          type,
          source,
          target,
          documentation: doc.trim() || null,
          properties: props,
        },
      })
    })
  }

  async function handleDelete() {
    if (!deleteModal.target) return
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(deleteModal.target!.identifier)
    })
  }

  const formFields: RelationshipFormFields = {
    type,
    onTypeChange: setType,
    source,
    onSourceChange: setSource,
    target,
    onTargetChange: setTarget,
    name,
    onNameChange: setName,
    doc,
    onDocChange: setDoc,
    props,
    onPropsChange: setProps,
    types,
    allElements,
  }

  const validationStats = useMemo(() => {
    let ok = 0,
      bad = 0
    for (const rel of relationships) {
      const src = byId.get(rel.source)
      const tgt = byId.get(rel.target)
      if (allowedRelationships(src?.type, tgt?.type).includes(rel.type)) ok++
      else bad++
    }
    return { ok, bad }
  }, [relationships, byId])

  const filteredRelationships = useMemo(() => {
    if (statusFilter === "all") return relationships
    return relationships.filter((rel) => {
      const src = byId.get(rel.source)
      const tgt = byId.get(rel.target)
      const ok = allowedRelationships(src?.type, tgt?.type).includes(rel.type)
      return statusFilter === "ok" ? ok : !ok
    })
  }, [relationships, byId, statusFilter])

  const columns = useRelationshipColumns({
    isAdmin,
    byId,
    byRelId,
    onDeleteClick: deleteActions.openWith,
  })

  if (error) {
    return (
      <div className="p-7">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("common.error")} : {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("relationships.title")}</h1>
        </div>
        {isAdmin && (
          <CreateRelationshipDialog
            modal={createModal}
            actions={createActions}
            onOpenCreate={openCreate}
            fields={formFields}
            onCreate={handleCreate}
          />
        )}
      </div>

      <RelationshipsFilterBar
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        types={types}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <DataTable
        columns={columns}
        data={filteredRelationships}
        loading={loading}
        selectable={isAdmin}
        onBulkDelete={
          isAdmin
            ? async (rows) => {
                await Promise.all(
                  rows.map((r) => deleteMutation.mutateAsync(r.identifier))
                )
              }
            : undefined
        }
        getRowId={(row) => row.identifier}
        footerStats={
          <RelationshipStats
            ok={validationStats.ok}
            bad={validationStats.bad}
            t={t}
          />
        }
        renderSubRow={(row) => (
          <RelationshipSubRow
            rel={row.original as RelationshipOut}
            byId={byId}
          />
        )}
      />

      <EditRelationshipDialog
        modal={editModal}
        actions={editActions}
        fields={formFields}
        onSave={handleEdit}
      />

      <DeleteRelationshipDialog
        modal={deleteModal}
        actions={deleteActions}
        onConfirm={handleDelete}
      />
    </div>
  )
}
