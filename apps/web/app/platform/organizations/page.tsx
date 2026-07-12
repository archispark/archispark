"use client"

import { useState } from "react"
import { ShieldAlert, Trash2, Ban, Play, LogOut } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type PlatformOrganizationOut } from "@/lib/api"
import {
  usePlatformOrganizations,
  useSetPlatformOrganizationEnabled,
  useDeletePlatformOrganization,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
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
 * platform_admin-only view — metadata only, no access to organization
 * content. Reachable even though client-layout.tsx otherwise blocks
 * platform_admin sessions from the regular app (see PlatformAdminBlock).
 */
export default function PlatformOrganizationsPage() {
  const { t } = useT()
  const { data: organizations = [], isLoading } = usePlatformOrganizations()
  const setEnabled = useSetPlatformOrganizationEnabled()
  const deleteOrg = useDeletePlatformOrganization()
  const [deleteModal, deleteActions] = useFormModal<PlatformOrganizationOut>()

  async function handleDelete() {
    if (!deleteModal.target) return
    await deleteActions.run(async () => {
      await deleteOrg.mutateAsync(deleteModal.target!.id)
    })
  }

  function logout() {
    window.location.href = "/api/auth/logout"
  }

  return (
    <div className="max-w-3xl p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert className="size-5 text-primary" />
            {t("platform.title")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("platform.desc")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="size-4" />
          {t("nav.logout")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {organizations.map((org) => (
            <div key={org.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                  {org.name}
                  {org.is_personal && (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {t("organizations.personal_badge")}
                    </span>
                  )}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {org.slug}
                </p>
              </div>
              <span
                className={`shrink-0 text-[11px] font-medium ${org.enabled ? "text-primary" : "text-destructive"}`}
              >
                {org.enabled
                  ? t("platform.status_enabled")
                  : t("platform.status_suspended")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEnabled.mutate({ id: org.id, enabled: !org.enabled })
                }
                disabled={setEnabled.isPending}
                className="shrink-0"
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
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => deleteActions.openWith(org)}
                aria-label={t("common.delete")}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={deleteModal.open}
        onOpenChange={(o) => !o && deleteActions.close()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.org.delete_org_title")}</DialogTitle>
            <DialogDescription>
              {t("platform.delete_org_desc", {
                name: deleteModal.target?.name ?? "",
              })}
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
