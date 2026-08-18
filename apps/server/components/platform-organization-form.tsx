"use client"

import { useT } from "@/lib/i18n"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

/**
 * platform_admin-only. Presentational name/description fields — state, the
 * mutation and the Save button live in the page itself so the button can
 * sit next to the title, at the same height as suspend/reactivate/delete.
 */
export function PlatformOrganizationForm({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  error,
}: {
  name: string
  onNameChange: (name: string) => void
  description: string
  onDescriptionChange: (description: string) => void
  error: string | null
}) {
  const { t } = useT()

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="org-name">{t("platform.orgs.name")}</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
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
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
