"use client"

import { type ElementOut } from "@/lib/api"
import type { useElementRelationForm } from "@/components/use-element-relation-form"
import { CreateRelationDialog } from "@/components/element-relation-create-dialog"
import {
  EditRelationDialog,
  DeleteRelationDialog,
} from "@/components/element-relation-dialogs"

/** Bundles the create/edit/delete relation dialogs for the element detail page. */
export function ElementRelationDialogsGroup({
  relationForm,
  relTypes,
  elementSelectOpts,
}: {
  relationForm: ReturnType<typeof useElementRelationForm>
  relTypes: string[]
  elementSelectOpts: ElementOut[]
}) {
  const fields = {
    relType: relationForm.relType,
    setRelType: relationForm.setRelType,
    relSource: relationForm.relSource,
    setRelSource: relationForm.setRelSource,
    relTarget: relationForm.relTarget,
    setRelTarget: relationForm.setRelTarget,
    relName: relationForm.relName,
    setRelName: relationForm.setRelName,
    relDoc: relationForm.relDoc,
    setRelDoc: relationForm.setRelDoc,
    relTypes,
    elementSelectOpts,
  }
  return (
    <>
      <CreateRelationDialog
        modal={relationForm.createRelModal}
        actions={relationForm.createRelActions}
        fields={fields}
        onConfirm={relationForm.handleCreateRel}
      />
      <EditRelationDialog
        modal={relationForm.editRelModal}
        actions={relationForm.editRelActions}
        fields={fields}
        onConfirm={relationForm.handleEditRel}
      />
      <DeleteRelationDialog
        modal={relationForm.deleteRelModal}
        actions={relationForm.deleteRelActions}
        onConfirm={relationForm.handleDeleteRel}
      />
    </>
  )
}
