"use client"

import { Suspense, useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useDebounce } from "use-debounce"
import { type ElementOut } from "@/lib/api"
import { getLayer, LAYER_LABELS } from "@/lib/archimate-helpers"
import {
  useElements,
  useElementTypes,
  useCreateElement,
  useDeleteElement,
  useElementsInViews,
  useRelationships,
} from "@/lib/queries"
import { DataTable } from "@/components/data-table"
import { useElementColumns, ElementSubRow } from "@/components/element-columns"
import { CreateElementDialog } from "@/components/element-create-dialog"
import {
  DeleteElementDialog,
  ElementStats,
} from "@/components/element-delete-dialog"
import { ElementsFilterBar } from "@/components/element-filter-bar"
import { useElementStats } from "@/components/use-element-stats"
import type { Property } from "@/lib/api"
import { useFormModal } from "@/hooks/use-form-modal"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { useT } from "@/lib/i18n"

export default function ElementsPage() {
  return (
    <Suspense>
      <ElementsPageInner />
    </Suspense>
  )
}

function ElementsPageInner() {
  const { t } = useT()
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const searchParams = useSearchParams()
  const layerFilter = searchParams.get("layer")

  const [search, setSearch] = useState("")
  const [debouncedSearch] = useDebounce(search, 300)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<
    "all" | "ok" | "conflict" | "absent"
  >("all")

  const { data: types = [] } = useElementTypes()
  const {
    data: elements = [],
    isLoading: loading,
    error,
  } = useElements(typeFilter, debouncedSearch || null)
  const { data: allElements = [] } = useElements()
  const { data: allRelationships = [] } = useRelationships()
  const { data: inViews = [] } = useElementsInViews()
  const inViewsSet = useMemo(() => new Set(inViews), [inViews])

  const byId = useMemo(
    () => new Map(allElements.map((e) => [e.identifier, e])),
    [allElements]
  )

  const { relStats, filteredElements, elementStats } = useElementStats({
    elements,
    allRelationships,
    byId,
    inViewsSet,
    layerFilter,
    statusFilter,
  })

  const deleteMutation = useDeleteElement()
  const [deleteModal, deleteActions] = useFormModal<ElementOut>()

  async function handleBulkDelete(rows: ElementOut[]) {
    await Promise.all(
      rows.map((el) => deleteMutation.mutateAsync(el.identifier))
    )
  }

  async function handleDeleteSingle() {
    if (!deleteModal.target) return
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(deleteModal.target!.identifier)
    })
  }

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("")
  const [newDoc, setNewDoc] = useState("")
  const [newProps, setNewProps] = useState<Property[]>([])
  const createMutation = useCreateElement()

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const typ of types) {
      const layer = getLayer(typ)
      ;(groups[layer] ??= []).push(typ)
    }
    return groups
  }, [types])

  useEffect(() => {
    if (
      layerFilter &&
      typeFilter &&
      !(grouped[layerFilter] ?? []).includes(typeFilter)
    ) {
      setTypeFilter(null)
    }
  }, [layerFilter, typeFilter, grouped])

  const searchRef = useRef<HTMLInputElement>(null)
  useKeyboardShortcut(
    "n",
    () => {
      if (isAdmin) setCreateOpen(true)
    },
    { enabled: !createOpen }
  )
  useKeyboardShortcut(
    "/",
    (e) => {
      e.preventDefault()
      searchRef.current?.focus()
    },
    { enabled: true }
  )

  async function handleCreate() {
    if (!newName.trim() || !newType) return
    await createMutation.mutateAsync(
      {
        name: newName.trim(),
        type: newType,
        documentation: newDoc.trim() || null,
        properties: newProps,
      },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setNewName("")
          setNewType("")
          setNewDoc("")
          setNewProps([])
        },
      }
    )
  }

  const columns = useElementColumns({
    isAdmin,
    inViewsSet,
    relStats,
    onDeleteClick: deleteActions.openWith,
  })

  const layerLabel = layerFilter
    ? t(`layer.${layerFilter}` as Parameters<typeof t>[0]) ||
      LAYER_LABELS[layerFilter] ||
      layerFilter
    : ""

  const pageTitle = layerFilter
    ? t("elements.title_layer", { layer: layerLabel })
    : t("elements.title")

  const pageDesc = layerFilter
    ? t("elements.layer_count", {
        n: filteredElements.length,
        s: filteredElements.length !== 1 ? "s" : "",
        layer: layerLabel,
      })
    : t("elements.browse_all")

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
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{pageDesc}</p>
        </div>
        {isAdmin && (
          <CreateElementDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            name={newName}
            onNameChange={setNewName}
            type={newType}
            onTypeChange={setNewType}
            doc={newDoc}
            onDocChange={setNewDoc}
            props={newProps}
            onPropsChange={setNewProps}
            layerFilter={layerFilter}
            grouped={grouped}
            error={
              createMutation.error
                ? (createMutation.error as Error).message
                : null
            }
            creating={createMutation.isPending}
            onCreate={handleCreate}
          />
        )}
      </div>

      <ElementsFilterBar
        ref={searchRef}
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        typeOptions={
          layerFilter
            ? (grouped[layerFilter] ?? [])
            : Object.values(grouped).flat()
        }
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <DataTable
        columns={columns}
        data={filteredElements}
        loading={loading}
        initialSorting={[{ id: "status", desc: true }]}
        selectable={isAdmin}
        onBulkDelete={isAdmin ? handleBulkDelete : undefined}
        getRowId={(row) => row.identifier}
        footerStats={
          <ElementStats
            ok={elementStats.ok}
            conflict={elementStats.conflict}
            absent={elementStats.absent}
            t={t}
          />
        }
        renderSubRow={(row) => (
          <ElementSubRow
            element={row.original as ElementOut}
            inViewsSet={inViewsSet}
            allRelationships={allRelationships}
            byId={byId}
          />
        )}
      />

      <DeleteElementDialog
        modal={deleteModal}
        actions={deleteActions}
        onConfirm={handleDeleteSingle}
      />
    </div>
  )
}
