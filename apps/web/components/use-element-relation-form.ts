import { useState } from "react"
import {
  type RelationshipOut,
  type RelationshipCreateIn,
  type RelationshipUpdateIn,
} from "@/lib/api"
import {
  useCreateRelationship,
  useUpdateRelationship,
  useDeleteRelationship,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"

/** Create/edit/delete relation dialog state + handlers for the element detail page. */
export function useElementRelationForm({ id }: { id: string }) {
  const createRelMutation = useCreateRelationship()
  const updateRelMutation = useUpdateRelationship()
  const deleteRelMutation = useDeleteRelationship()

  const [createRelModal, createRelActions] = useFormModal<null>()
  const [editRelModal, editRelActions] = useFormModal<RelationshipOut>()
  const [deleteRelModal, deleteRelActions] = useFormModal<RelationshipOut>()

  const [relType, setRelType] = useState("")
  const [relSource, setRelSource] = useState(id)
  const [relTarget, setRelTarget] = useState("")
  const [relName, setRelName] = useState("")
  const [relDoc, setRelDoc] = useState("")

  function openCreateRel() {
    setRelType("")
    setRelSource(id)
    setRelTarget("")
    setRelName("")
    setRelDoc("")
    createRelActions.openNew()
  }
  function openEditRel(rel: RelationshipOut) {
    setRelType(rel.type)
    setRelSource(rel.source)
    setRelTarget(rel.target)
    setRelName(rel.name ?? "")
    setRelDoc(rel.documentation ?? "")
    editRelActions.openWith(rel)
  }

  async function handleCreateRel() {
    if (!relType || !relSource || !relTarget) return
    await createRelActions.run(async () => {
      await createRelMutation.mutateAsync({
        type: relType,
        source: relSource,
        target: relTarget,
        name: relName.trim() || undefined,
        documentation: relDoc.trim() || null,
      } as RelationshipCreateIn)
    })
  }
  async function handleEditRel() {
    if (!editRelModal.target || !relType || !relSource || !relTarget) return
    await editRelActions.run(async () => {
      await updateRelMutation.mutateAsync({
        id: editRelModal.target!.identifier,
        body: {
          type: relType,
          source: relSource,
          target: relTarget,
          name: relName.trim() || null,
          documentation: relDoc.trim() || null,
        } as RelationshipUpdateIn,
      })
    })
  }
  async function handleDeleteRel() {
    if (!deleteRelModal.target) return
    await deleteRelActions.run(async () => {
      await deleteRelMutation.mutateAsync(deleteRelModal.target!.identifier)
    })
  }

  return {
    createRelMutation,
    updateRelMutation,
    deleteRelMutation,
    createRelModal,
    createRelActions,
    editRelModal,
    editRelActions,
    deleteRelModal,
    deleteRelActions,
    relType,
    setRelType,
    relSource,
    setRelSource,
    relTarget,
    setRelTarget,
    relName,
    setRelName,
    relDoc,
    setRelDoc,
    openCreateRel,
    openEditRel,
    handleCreateRel,
    handleEditRel,
    handleDeleteRel,
  }
}
