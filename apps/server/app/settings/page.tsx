"use client"
import { useT } from "@/lib/i18n"
import { ModelExportButton } from "@/components/model-export-button"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  useWorkspaces,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

export default function SettingsPage() {
  const { t } = useT()
  const router = useRouter()
  const { data: workspaces = [], isLoading } = useWorkspaces()
  const updateWs = useUpdateWorkspace()
  const deleteWs = useDeleteWorkspace()
  const active = workspaces.find((w) => w.active)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deleteModal, deleteActions] = useFormModal<null>()

  useEffect(() => {
    if (active) {
      setName(active.name)
      setDescription(active.description ?? "")
    }
  }, [active?.id, active?.name, active?.description])

  async function handleSave() {
    if (!active || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateWs.mutateAsync({
        id: active.id,
        body: { name: name.trim(), description: description.trim() || null },
      })
      toast.success(t("settings.general.saved"))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!active) return
    await deleteActions.run(async () => {
      await deleteWs.mutateAsync(active.id)
      router.push("/workspaces")
    })
  }

  const dirty =
    !!active &&
    (name !== active.name || description !== (active.description ?? ""))

  return (
    <div className="space-y-5 p-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("settings.desc")}
          </p>
        </div>
        {active && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !name.trim() || !dirty}
              className="bg-indigo-600 text-primary-foreground hover:bg-indigo-700"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteActions.openNew()}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {t("common.delete")}
            </Button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      )}

      {active && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-name">{t("nav.workspace_name")} *</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ws-desc">{t("common.optional_desc")}</Label>
              <textarea
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
              />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h2 className="text-sm font-semibold">{t("sidebar.export")}</h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.general.export_desc")}
            </p>
            <ModelExportButton />
          </div>
        </div>
      )}

      <Dialog
        open={deleteModal.open}
        onOpenChange={(o) => !o && deleteActions.close()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.general.delete_ws")}</DialogTitle>
            <DialogDescription>
              {active &&
                t("settings.workspaces.delete_desc", { name: active.name })}
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
