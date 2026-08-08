import { type RelationshipOut } from "@/lib/api"
import type {
  useCreateRelationship,
  useUpdateRelationship,
  useDeleteRelationship,
} from "@/lib/queries"

/** Create/update/clear the element's single Specialization relation. */
export async function saveSpecializationRelation({
  id,
  targetId,
  specializes,
  createRelMutation,
  updateRelMutation,
  deleteRelMutation,
}: {
  id: string
  targetId: string
  specializes: RelationshipOut[]
  createRelMutation: ReturnType<typeof useCreateRelationship>
  updateRelMutation: ReturnType<typeof useUpdateRelationship>
  deleteRelMutation: ReturnType<typeof useDeleteRelationship>
}) {
  const existing = specializes[0]
  if (!targetId) {
    if (existing) await deleteRelMutation.mutateAsync(existing.identifier)
    return
  }
  if (existing) {
    if (existing.target === targetId) return
    await updateRelMutation.mutateAsync({
      id: existing.identifier,
      body: { target: targetId },
    })
  } else {
    await createRelMutation.mutateAsync({
      type: "Specialization",
      source: id,
      target: targetId,
    })
  }
}
