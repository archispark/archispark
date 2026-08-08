import { useMemo, useState } from "react"
import { type Property, type PropertyDefinitionOut } from "@/lib/api"
import { useUpdateElement } from "@/lib/queries"

/** Inline properties CRUD state/handlers for the element detail page. */
export function useElementProperties({
  id,
  properties,
  propDefs,
}: {
  id: string
  properties: Property[]
  propDefs: PropertyDefinitionOut[]
}) {
  const updateMutation = useUpdateElement()

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

  return {
    updateMutation,
    availableDefs,
    addingProp,
    setAddingProp,
    newPropRef,
    setNewPropRef,
    newPropVal,
    setNewPropVal,
    deletePropRef,
    setDeletePropRef,
    savePropAdd,
    savePropValue,
    deleteProp,
  }
}
