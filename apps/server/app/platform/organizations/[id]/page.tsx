"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Ban, Play } from "lucide-react"
import { useT } from "@/lib/i18n"
import { toast } from "sonner"
import {
  usePlatformOrganization,
  useSetPlatformOrganizationEnabled,
  useUpdatePlatformOrganization,
  useDeletePlatformOrganization,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { PlatformOrganizationForm } from "@/components/platform-organization-form"
import { PlatformOrganizationMembers } from "@/components/platform-organization-members"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

/**
 * platform_admin-only — edits a single organization's name/description and
 * membership. See platform-store.ts / platform-organization-members-store.ts.
 */
export default function PlatformOrganizationDetailPage() {
  const params = useParams<{ id: string }>()!
  const orgId = decodeURIComponent(params.id)
  const { t } = useT()
  const router = useRouter()
  const { data: org, isLoading } = usePlatformOrganization(orgId)
  const setEnabled = useSetPlatformOrganizationEnabled()
  const updateOrg = useUpdatePlatformOrganization()
  const deleteOrg = useDeletePlatformOrganization()
  const [deleteModal, deleteActions] = useFormModal<null>()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return
    setName(org.name)
    setDescription(org.description ?? "")
  }, [org?.id, org?.name, org?.description])

  const dirty =
    !!org && (name !== org.name || description !== (org.description ?? ""))

  async function handleSave() {
    if (!org) return
    setError(null)
    try {
      await updateOrg.mutateAsync({
        id: org.id,
        changes: { name: name.trim(), description: description.trim() || null },
      })
      toast.success(t("platform.orgs.saved"))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDelete() {
    if (!org) return
    await deleteActions.run(async () => {
      await deleteOrg.mutateAsync(org.id)
      router.push("/platform/organizations")
    })
  }

  if (isLoading) {
    return (
      <div className="p-7 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (!org) {
    return (
      <div className="max-w-3xl space-y-4 p-7">
        <p className="text-sm text-muted-foreground">
          {t("platform.orgs.org_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {org.name}
            {org.is_personal && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                {t("organizations.personal_badge")}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                org.enabled
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {org.enabled
                ? t("platform.status_enabled")
                : t("platform.status_suspended")}
            </span>
          </h1>
          <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
            {org.slug}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setEnabled.mutate({ id: org.id, enabled: !org.enabled })
            }
            disabled={setEnabled.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {org.enabled ? (
              <>
                <Ban className="size-3.5" />
                {t("platform.suspend")}
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                {t("platform.reactivate")}
              </>
            )}
          </button>
          <Button
            onClick={handleSave}
            disabled={updateOrg.isPending || !dirty || !name.trim()}
            className="shrink-0 bg-indigo-600 text-primary-foreground hover:bg-indigo-700"
          >
            {updateOrg.isPending ? t("common.saving") : t("common.save")}
          </Button>
          <Button variant="destructive" onClick={() => deleteActions.openNew()}>
            {t("common.delete")}
          </Button>
        </div>
      </div>

      <PlatformOrganizationForm
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        error={error}
      />
      <PlatformOrganizationMembers org={org} />

      <Dialog
        open={deleteModal.open}
        onOpenChange={(o) => !o && deleteActions.close()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.org.delete_org_title")}</DialogTitle>
            <DialogDescription>
              {t("platform.delete_org_desc", { name: org.name })}
            </DialogDescription>
          </DialogHeader>
          {deleteModal.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteModal.error}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteModal.isPending}
            >
              {deleteModal.isPending
                ? t("common.deleting")
                : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
