"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Ban, Play } from "lucide-react"
import { useT } from "@/lib/i18n"
import {
  usePlatformOrganization,
  useSetPlatformOrganizationEnabled,
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
  const deleteOrg = useDeletePlatformOrganization()
  const [deleteModal, deleteActions] = useFormModal<null>()

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
        <BackLink t={t} />
        <p className="text-sm text-muted-foreground">
          {t("platform.orgs.org_not_found")}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 p-7">
      <BackLink t={t} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {org.name}
            {org.is_personal && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                {t("organizations.personal_badge")}
              </span>
            )}
          </h1>
          <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
            {org.slug}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-[11px] font-medium ${org.enabled ? "text-primary" : "text-destructive"}`}
          >
            {org.enabled
              ? t("platform.status_enabled")
              : t("platform.status_suspended")}
          </span>
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
        </div>
      </div>

      <PlatformOrganizationForm org={org} />
      <PlatformOrganizationMembers org={org} />

      <div className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-destructive">
          {t("settings.org.delete_org_title")}
        </h2>
        <p className="text-[12px] text-muted-foreground">
          {t("platform.delete_org_desc", { name: org.name })}
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => deleteActions.openNew()}
        >
          {t("settings.org.delete_org_title")}
        </Button>
      </div>

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

function BackLink({ t }: { t: ReturnType<typeof useT>["t"] }) {
  return (
    <Link
      href="/platform/organizations"
      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground no-underline hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      {t("platform.title")}
    </Link>
  )
}
