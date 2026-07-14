"use client"

import { useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  useRelationship,
  useRelationshipViews,
  useRelationshipTypes,
  useElements,
  useUpdateRelationship,
  useDeleteRelationship,
  usePropertyDefinitions,
} from "@/lib/queries"
import { type Property } from "@/lib/api"
import { allowedRelationships } from "@/lib/archimate-rules"
import { ChevronLeft } from "lucide-react"
import { useFormModal } from "@/hooks/use-form-modal"
import { useT } from "@/lib/i18n"
import {
  Tabs,
  DeletePropertyConfirmDialog,
} from "@/components/detail-page-shared"
import { RelationshipCanvas } from "@/components/relationship-canvas-diagram"
import { RelationshipFields } from "@/components/relationship-detail-fields"
import { EntityPropertiesTab } from "@/components/entity-properties-tab"
import { EntityViewsTab } from "@/components/entity-views-tab"
import { DeleteRelationshipConfirmDialog } from "@/components/relationship-detail-dialogs"

export default function RelationshipDetailPage() {
  const { t } = useT()
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id)
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const router = useRouter()

  const { data: rel, isLoading, error } = useRelationship(id)
  const { data: relViews = [] } = useRelationshipViews(id)
  const { data: allElements = [] } = useElements()
  const { data: relTypes = [] } = useRelationshipTypes()
  const { data: propDefs = [] } = usePropertyDefinitions()

  const updateMutation = useUpdateRelationship()
  const deleteMutation = useDeleteRelationship()
  const [deleteModal, deleteActions] = useFormModal<typeof rel>()
  const [activeTab, setActiveTab] = useState<"canvas" | "properties" | "views">(
    "canvas"
  )

  const saveField = useCallback(
    async (patch: Parameters<typeof updateMutation.mutateAsync>[0]["body"]) => {
      await updateMutation.mutateAsync({ id, body: patch })
    },
    [id, updateMutation]
  )

  const byId = useMemo(
    () => new Map(allElements.map((e) => [e.identifier, e])),
    [allElements]
  )

  const [editingType, setEditingType] = useState(false)
  const [editingSource, setEditingSource] = useState(false)
  const [editingTarget, setEditingTarget] = useState(false)

  // ── Properties CRUD ───────────────────────────────────────────────────────
  const properties: Property[] = rel?.properties ?? []
  const usedRefs = useMemo(
    () => new Set(properties.map((p) => p.property_definition_ref)),
    [properties]
  )
  const availableDefs = useMemo(
    () => propDefs.filter((d) => !usedRefs.has(d.identifier)),
    [propDefs, usedRefs]
  )

  const [addingProp, setAddingProp] = useState(false)
  const [newPropRef, setNewPropRef] = useState("")
  const [newPropVal, setNewPropVal] = useState("")
  const [deletePropRef, setDeletePropRef] = useState<string | null>(null)

  async function savePropAdd() {
    if (!newPropRef) return
    await updateMutation.mutateAsync({
      id,
      body: {
        properties: [
          ...properties,
          { property_definition_ref: newPropRef, value: newPropVal },
        ],
      },
    })
    setNewPropRef("")
    setNewPropVal("")
    setAddingProp(false)
  }
  async function savePropValue(ref: string, val: string) {
    await updateMutation.mutateAsync({
      id,
      body: {
        properties: properties.map((p) =>
          p.property_definition_ref === ref ? { ...p, value: val } : p
        ),
      },
    })
  }
  async function deleteProp(ref: string) {
    await updateMutation.mutateAsync({
      id,
      body: {
        properties: properties.filter((p) => p.property_definition_ref !== ref),
      },
    })
  }

  async function handleDelete() {
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(id)
      router.push("/relationships")
    })
  }

  if (isLoading) {
    return (
      <div className="px-4 pt-6 text-sm text-muted-foreground sm:px-7">
        {t("common.loading")}
      </div>
    )
  }
  if (error || !rel) {
    return (
      <div className="px-4 pt-6 sm:px-7">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("common.error")}:{" "}
          {(error as Error | null)?.message ?? "Relation introuvable"}
        </div>
      </div>
    )
  }

  const srcEl = byId.get(rel.source)
  const tgtEl = byId.get(rel.target)
  const isOk = allowedRelationships(srcEl?.type, tgtEl?.type).includes(rel.type)

  const tabs = [
    { id: "canvas", label: t("relationships.tab_canvas") },
    {
      id: "properties",
      label: t("relationships.tab_properties"),
      count: properties.length,
    },
    { id: "views", label: t("relationships.tab_views") },
  ]

  return (
    <div className="flex h-[calc(100vh-var(--nav-h))] flex-col overflow-hidden px-4 pt-4 pb-0 sm:px-7 sm:pt-6">
      {/* Back */}
      <Link
        href="/relationships"
        className="mb-3 inline-flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        {t("breadcrumb.relationships")}
      </Link>

      {/* Header + fields — scrollable so the page stays usable on small screens */}
      <RelationshipFields
        rel={rel}
        isAdmin={isAdmin}
        saveField={saveField}
        onDelete={() => deleteActions.openWith(rel)}
        editingType={editingType}
        setEditingType={setEditingType}
        relTypes={relTypes}
        isOk={isOk}
        editingSource={editingSource}
        setEditingSource={setEditingSource}
        allElements={allElements}
        srcEl={srcEl}
        editingTarget={editingTarget}
        setEditingTarget={setEditingTarget}
        tgtEl={tgtEl}
      />

      {/* Tabs + content — fill remaining space */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <Tabs
          tabs={tabs}
          active={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
        />

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        {activeTab === "canvas" && (
          <div className="mt-3 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
            {srcEl && tgtEl ? (
              <RelationshipCanvas
                relType={rel.type}
                relName={rel.name}
                isOk={isOk}
                srcId={rel.source}
                srcName={srcEl.name}
                srcType={srcEl.type}
                tgtId={rel.target}
                tgtName={tgtEl.name}
                tgtType={tgtEl.type}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            )}
          </div>
        )}

        {/* ── Propriétés ──────────────────────────────────────────────────── */}
        {activeTab === "properties" && (
          <EntityPropertiesTab
            isAdmin={isAdmin}
            properties={properties}
            propDefs={propDefs}
            availableDefs={availableDefs}
            addingProp={addingProp}
            onStartAdd={() => setAddingProp(true)}
            newPropRef={newPropRef}
            onNewPropRefChange={setNewPropRef}
            newPropVal={newPropVal}
            onNewPropValChange={setNewPropVal}
            onSaveAdd={savePropAdd}
            onCancelAdd={() => {
              setAddingProp(false)
              setNewPropRef("")
              setNewPropVal("")
            }}
            savingAdd={updateMutation.isPending}
            onSaveValue={savePropValue}
            onDeleteClick={setDeletePropRef}
          />
        )}

        {/* ── Vues ────────────────────────────────────────────────────────── */}
        {activeTab === "views" && <EntityViewsTab relViews={relViews} />}
      </div>

      <DeletePropertyConfirmDialog
        propRef={deletePropRef}
        onOpenChange={(o) => !o && setDeletePropRef(null)}
        onConfirm={() => {
          deleteProp(deletePropRef!)
          setDeletePropRef(null)
        }}
      />

      <DeleteRelationshipConfirmDialog
        modal={deleteModal}
        actions={deleteActions}
        relType={rel.type}
        onConfirm={handleDelete}
      />
    </div>
  )
}
