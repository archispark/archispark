"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"
import { type PlatformOrganizationDetailOut } from "@/lib/api"
import { useUpdatePlatformOrganization } from "@/lib/queries"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

/**
 * platform_admin-only — edits an organization's name and description.
 * Suspend/reactivate stays a separate immediate action, same as the
 * organizations list.
 */
export function PlatformOrganizationForm({
  org,
}: {
  org: PlatformOrganizationDetailOut
}) {
  const { t } = useT()
  const updateOrg = useUpdatePlatformOrganization()

  const [name, setName] = useState(org.name)
  const [description, setDescription] = useState(org.description ?? "")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(org.name)
    setDescription(org.description ?? "")
  }, [org.id, org.name, org.description])

  const dirty = name !== org.name || description !== (org.description ?? "")

  async function handleSave() {
    setError(null)
    try {
      await updateOrg.mutateAsync({
        id: org.id,
        changes: {
          name: name.trim(),
          description: description.trim() || null,
        },
      })
      toast.success(t("platform.orgs.saved"))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <Label htmlFor="org-name">{t("platform.orgs.name")}</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="org-description">
          {t("platform.orgs.description")}
        </Label>
        <textarea
          id="org-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={updateOrg.isPending || !dirty || !name.trim()}
      >
        {updateOrg.isPending ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  )
}
