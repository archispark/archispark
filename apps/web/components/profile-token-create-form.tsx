"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import { type OrganizationOut, type WorkspaceInfo } from "@/lib/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export const EXPIRY_PRESETS = [
  { label: "Aucune expiration", days: null },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
  { label: "1 an", days: 365 },
  { label: "Date personnalisée", days: -1 },
] as const

export function TokenCreateForm({
  show,
  onShowChange,
  name,
  onNameChange,
  organizationId,
  onOrganizationChange,
  organizations,
  workspaceId,
  onWorkspaceChange,
  workspaceChoices,
  expiryPreset,
  onExpiryPresetChange,
  customDate,
  onCustomDateChange,
  creating,
  onCreate,
}: {
  show: boolean
  onShowChange: (v: boolean) => void
  name: string
  onNameChange: (v: string) => void
  organizationId: string
  onOrganizationChange: (v: string) => void
  organizations: OrganizationOut[]
  workspaceId: string
  onWorkspaceChange: (v: string) => void
  workspaceChoices: WorkspaceInfo[]
  expiryPreset: number | null
  onExpiryPresetChange: (v: number | null) => void
  customDate: string
  onCustomDateChange: (v: string) => void
  creating: boolean
  onCreate: () => void
}) {
  const { t } = useT()

  if (!show) {
    return (
      <Button variant="outline" size="sm" onClick={() => onShowChange(true)}>
        <Plus className="size-3.5" />
        Nouveau token
      </Button>
    )
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split("T")[0]!

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="token-name" className="text-[13px]">
            Nom du token
          </Label>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate()
              if (e.key === "Escape") {
                onShowChange(false)
                onNameChange("")
              }
            }}
            placeholder="ex: Claude Code"
            className="mt-1"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="token-org" className="text-[13px]">
            {t("profile.token_org_label")}
          </Label>
          <select
            id="token-org"
            value={organizationId}
            onChange={(e) => {
              onOrganizationChange(e.target.value)
              onWorkspaceChange("")
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="token-ws" className="text-[13px]">
            {t("profile.token_ws_label")}
          </Label>
          <select
            id="token-ws"
            value={workspaceId}
            onChange={(e) => onWorkspaceChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t("profile.token_ws_any")}</option>
            {workspaceChoices.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[13px]">Expiration</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onExpiryPresetChange(p.days)}
                className={`rounded border px-2.5 py-1 text-[12px] transition-colors ${
                  expiryPreset === p.days
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {expiryPreset === -1 && (
            <Input
              type="date"
              value={customDate}
              min={minDateStr}
              onChange={(e) => onCustomDateChange(e.target.value)}
              className="mt-2 w-40"
            />
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={onCreate}
          disabled={creating || !name.trim() || !organizationId}
        >
          {creating ? "…" : "Créer"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onShowChange(false)
            onNameChange("")
            onExpiryPresetChange(null)
            onCustomDateChange("")
          }}
        >
          Annuler
        </Button>
      </div>
    </div>
  )
}
