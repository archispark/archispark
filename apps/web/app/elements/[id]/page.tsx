"use client"

import { useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  useElement,
  useElementRelationships,
  useElements,
  useElementTypes,
  useUpdateElement,
  useDeleteElement,
  useElementsInViews,
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
import { saveSpecializationRelation } from "@/components/element-specialization"
import { buildElementTabs } from "@/components/element-detail-tabs"
import { ElementGraphTab } from "@/components/element-graph-tab"
import { ChevronLeft } from "lucide-react"

export default function ElementDetailPage() {
  const { t } = useT()
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id)
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const router = useRouter()

  const { data: element, isLoading: elLoading, error: elError } = useElement(id)
  const { data: relationships = [], isLoading: relLoading } =
    useElementRelationships(id)
  const { data: allElements = [] } = useElements()
  const { data: allRelationships = [] } = useRelationships()
  const { data: elementTypes = [] } = useElementTypes()
  const { data: relTypes = [] } = useRelationshipTypes()
  const { data: propDefs = [] } = usePropertyDefinitions()
  const { data: inViews = [] } = useElementsInViews()
  const isInViews = useMemo(() => inViews.includes(id), [inViews, id])
  const { data: elementViews = [] } = useElementViews(id)

  const updateMutation = useUpdateElement()
  const deleteMutation = useDeleteElement()

  const [activeTab, setActiveTab] = useState<
    "properties" | "relations" | "canvas" | "views"
  >("canvas")

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

  // ── Type inline editing ───────────────────────────────────────────────────
  const [editingType, setEditingType] = useState(false)

  const groupedTypes = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const typ of elementTypes) {
      const layer = getLayer(typ)
      ;(groups[layer] ??= []).push(typ)
    }
    return groups
  }, [elementTypes])

  // ── Specialization ────────────────────────────────────────────────────────
  const specializes = useMemo(
    () =>
      relationships.filter(
        (r) => r.type === "Specialization" && r.source === id
      ),
    [relationships, id]
  )
  const [editingSpec, setEditingSpec] = useState(false)

  const properties: Property[] = element?.properties ?? []
  const propertiesForm = useElementProperties({ id, properties, propDefs })
  const relationForm = useElementRelationForm({ id })

  async function saveSpecialization(targetId: string) {
    setEditingSpec(false)
    await saveSpecializationRelation({
      id,
      targetId,
      specializes,
      createRelMutation: relationForm.createRelMutation,
      updateRelMutation: relationForm.updateRelMutation,
      deleteRelMutation: relationForm.deleteRelMutation,
    })
  }

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
    <div className="flex h-[calc(100vh-var(--nav-h))] flex-col overflow-hidden px-4 pt-4 pb-0 sm:px-7 sm:pt-6">
      {/* Back */}
      <Link
        href="/elements"
        className="mb-3 inline-flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        {t("breadcrumb.elements")}
      </Link>

      {/* Header */}
      <ElementHeader
        element={element}
        isAdmin={isAdmin}
        editingType={editingType}
        setEditingType={setEditingType}
        groupedTypes={groupedTypes}
        saveField={saveField}
        layer={layer}
        layerColor={layerColor}
        isInViews={isInViews}
        editingSpec={editingSpec}
        setEditingSpec={setEditingSpec}
        elementSelectOpts={elementSelectOpts}
        specializes={specializes}
        saveSpecialization={saveSpecialization}
        onDelete={() => deleteActions.openWith(element)}
      />

      {/* Tabs — fills remaining vertical space */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <Tabs
          tabs={tabs}
          active={activeTab}
          onChange={(v) =>
            setActiveTab(v as "properties" | "relations" | "canvas" | "views")
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

        {/* ── Canvas tab ───────────────────────────────────────────────────── */}
        {activeTab === "canvas" && (
          <div className="flex min-h-0 flex-1 flex-col pt-3 pb-4">
            <ElementGraphTab
              element={element}
              allRelationships={allRelationships}
              byId={byId}
            />
          </div>
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
