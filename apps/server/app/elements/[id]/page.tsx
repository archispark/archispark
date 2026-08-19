"use client"

import { useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  useElement,
  useElementRelationships,
  useElements,
  useUpdateElement,
  useDeleteElement,
  useElementViews,
  useRelationshipTypes,
  usePropertyDefinitions,
  useRelationships,
} from "@/lib/queries"
import { type Property } from "@/lib/api"
import { getLayer, LAYER_BADGE_COLORS } from "@/lib/archimate-helpers"
import { useFormModal } from "@/hooks/use-form-modal"
import { useT } from "@/lib/i18n"
import type { ElementOut } from "@/lib/api"
import {
  Tabs,
  DeletePropertyConfirmDialog,
} from "@/components/detail-page-shared"
import { ElementHeader } from "@/components/element-detail-header"
import { EntityPropertiesTab } from "@/components/entity-properties-tab"
import { EntityViewsTab } from "@/components/entity-views-tab"
import { ElementRelationsTab } from "@/components/element-relations-tab"
import { ElementRelationDialogsGroup } from "@/components/element-relation-dialogs-group"
import { DeleteElementDialog } from "@/components/element-delete-dialog"
import { useElementProperties } from "@/components/use-element-properties"
import { useElementRelationForm } from "@/components/use-element-relation-form"
import { buildElementTabs } from "@/components/element-detail-tabs"
import { ElementGraphTab } from "@/components/element-graph-tab"

export default function ElementDetailPage() {
  const { t } = useT()
  // useParams() is typed nullable only for pages/-router compat (this app
  // only calls it from app/ client components, where it's always populated).
  const params = useParams<{ id: string }>()!
  const id = decodeURIComponent(params.id)
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const router = useRouter()

  const { data: element, isLoading: elLoading, error: elError } = useElement(id)
  const { data: relationships = [], isLoading: relLoading } =
    useElementRelationships(id)
  const { data: allElements = [] } = useElements()
  const { data: allRelationships = [] } = useRelationships()
  const { data: relTypes = [] } = useRelationshipTypes()
  const { data: propDefs = [] } = usePropertyDefinitions()
  const { data: elementViews = [] } = useElementViews(id)

  const updateMutation = useUpdateElement()
  const deleteMutation = useDeleteElement()

  const [activeTab, setActiveTab] = useState<
    "properties" | "relations" | "views"
  >("properties")

  // ── Delete element ────────────────────────────────────────────────────────
  const [deleteModal, deleteActions] = useFormModal<ElementOut>()
  async function handleDeleteElement() {
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(id)
      router.push("/elements")
    })
  }

  // ── Inline save helpers ────────────────────────────────────────────────────
  const saveField = useCallback(
    async (patch: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) => {
      await updateMutation.mutateAsync({ id, body: patch })
    },
    [id, updateMutation]
  )

  const properties: Property[] = element?.properties ?? []
  const propertiesForm = useElementProperties({ id, properties, propDefs })
  const relationForm = useElementRelationForm({ id })

  // ── byId for relation status ──────────────────────────────────────────────
  const byId = useMemo(
    () =>
      new Map<string, ElementOut>(allElements.map((e) => [e.identifier, e])),
    [allElements]
  )

  // ── Element select options (excludes self) ────────────────────────────────
  const elementSelectOpts = useMemo(
    () => allElements.filter((e) => e.identifier !== id),
    [allElements, id]
  )

  // ── Loading / error ────────────────────────────────────────────────────────
  if (elLoading) {
    return (
      <div className="px-4 pt-6 text-sm text-muted-foreground sm:px-7">
        {t("common.loading")}
      </div>
    )
  }
  if (elError || !element) {
    return (
      <div className="px-4 pt-6 sm:px-7">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("common.error")}:{" "}
          {(elError as Error | null)?.message ?? "Élément introuvable"}
        </div>
      </div>
    )
  }

  const layer = getLayer(element.type)
  const layerColor = LAYER_BADGE_COLORS[layer] ?? ""
  const tabs = buildElementTabs({
    t,
    relCount: relationships.length,
    propCount: properties.length,
    viewCount: elementViews.length,
  })

  return (
    <div className="flex min-h-[calc(100vh-var(--nav-h))] flex-col px-4 pt-4 pb-4 sm:px-7 sm:pt-6">
      {/* Header */}
      <ElementHeader
        element={element}
        isAdmin={isAdmin}
        saveField={saveField}
        layer={layer}
        layerColor={layerColor}
        onDelete={() => deleteActions.openWith(element)}
      />

      <div className="mt-4 flex flex-col">
        {/* ── Canvas ─────────────────────────────────────────────────────── */}
        <div className="flex h-[min(70vh,46rem)] flex-col pb-4">
          <ElementGraphTab
            element={element}
            allRelationships={allRelationships}
            byId={byId}
          />
        </div>

        <Tabs
          tabs={tabs}
          active={activeTab}
          onChange={(v) =>
            setActiveTab(v as "properties" | "relations" | "views")
          }
        />

        {/* ── Properties tab ──────────────────────────────────────────────── */}
        {activeTab === "properties" && (
          <EntityPropertiesTab
            isAdmin={isAdmin}
            properties={properties}
            propDefs={propDefs}
            availableDefs={propertiesForm.availableDefs}
            addingProp={propertiesForm.addingProp}
            onStartAdd={() => propertiesForm.setAddingProp(true)}
            newPropRef={propertiesForm.newPropRef}
            onNewPropRefChange={propertiesForm.setNewPropRef}
            newPropVal={propertiesForm.newPropVal}
            onNewPropValChange={propertiesForm.setNewPropVal}
            onSaveAdd={propertiesForm.savePropAdd}
            onCancelAdd={() => {
              propertiesForm.setAddingProp(false)
              propertiesForm.setNewPropRef("")
              propertiesForm.setNewPropVal("")
            }}
            savingAdd={updateMutation.isPending}
            onSaveValue={propertiesForm.savePropValue}
            onDeleteClick={propertiesForm.setDeletePropRef}
          />
        )}

        {/* ── Relations tab ────────────────────────────────────────────────── */}
        {activeTab === "relations" && (
          <ElementRelationsTab
            elementId={id}
            isAdmin={isAdmin}
            relationships={relationships}
            relLoading={relLoading}
            byId={byId}
            onCreateClick={relationForm.openCreateRel}
            onEditClick={relationForm.openEditRel}
            onDeleteClick={(rel) => relationForm.deleteRelActions.openWith(rel)}
          />
        )}

        {/* ── Views tab ────────────────────────────────────────────────────── */}
        {activeTab === "views" && <EntityViewsTab relViews={elementViews} />}
      </div>

      <DeletePropertyConfirmDialog
        propRef={propertiesForm.deletePropRef}
        onOpenChange={(o) => !o && propertiesForm.setDeletePropRef(null)}
        onConfirm={() => {
          propertiesForm.deleteProp(propertiesForm.deletePropRef!)
          propertiesForm.setDeletePropRef(null)
        }}
      />

      <DeleteElementDialog
        modal={deleteModal}
        actions={deleteActions}
        onConfirm={handleDeleteElement}
      />

      <ElementRelationDialogsGroup
        relationForm={relationForm}
        relTypes={relTypes}
        elementSelectOpts={elementSelectOpts}
      />
    </div>
  )
}
