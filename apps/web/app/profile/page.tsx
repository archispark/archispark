"use client"

import { useState, useEffect, useCallback } from "react"
import { Eye, EyeOff, Copy, Check, Plus, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useT } from "@/lib/i18n"
import { useOrganizations, useWorkspaces } from "@/lib/queries"
import {
  fetchApiTokens,
  createApiToken,
  deleteApiToken,
  type ApiTokenOut,
  type ApiTokenCreatedOut,
} from "@/lib/api"

// ---------------------------------------------------------------------------
// Tab: Informations personnelles
// ---------------------------------------------------------------------------

function InfoTab() {
  const user = useCurrentUser()

  return (
    <div className="space-y-4">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Informations
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-username">Nom d&apos;utilisateur</Label>
          <Input
            id="profile-username"
            value={user?.username ?? ""}
            readOnly
            className="mt-1 cursor-default bg-muted/40"
          />
        </div>
        <div>
          <Label htmlFor="profile-name">Nom d&apos;affichage</Label>
          <Input
            id="profile-name"
            value={user?.name ?? ""}
            readOnly
            className="mt-1 cursor-default bg-muted/40"
          />
        </div>
        {user?.email && (
          <div className="sm:col-span-2">
            <Label htmlFor="profile-email">Adresse e-mail</Label>
            <Input
              id="profile-email"
              value={user.email}
              readOnly
              className="mt-1 cursor-default bg-muted/40"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers for expiry display
// ---------------------------------------------------------------------------

const EXPIRY_PRESETS = [
  { label: "Aucune expiration", days: null },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
  { label: "1 an", days: 365 },
  { label: "Date personnalisée", days: -1 },
] as const

function formatExpiry(ts: number | null): {
  label: string
  urgent: boolean
  expired: boolean
} {
  if (ts === null)
    return { label: "Aucune expiration", urgent: false, expired: false }
  const now = Math.floor(Date.now() / 1000)
  if (ts < now) return { label: "Expiré", urgent: false, expired: true }
  const days = Math.ceil((ts - now) / 86400)
  const label =
    days === 0
      ? "Expire aujourd'hui"
      : days === 1
        ? "Expire demain"
        : `Expire dans ${days} j`
  return { label, urgent: days <= 7, expired: false }
}

// ---------------------------------------------------------------------------
// Tab: Tokens API
// ---------------------------------------------------------------------------

function TokensTab() {
  const { t } = useT()
  const { data: organizations = [] } = useOrganizations()
  const { data: activeOrgWorkspaces = [] } = useWorkspaces()
  const [tokens, setTokens] = useState<ApiTokenOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [organizationId, setOrganizationId] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [expiryPreset, setExpiryPreset] = useState<number | null>(null) // null = no expiry, -1 = custom
  const [customDate, setCustomDate] = useState("")
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<ApiTokenCreatedOut | null>(null)
  const [copiedId, setCopiedId] = useState<number | string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (organizationId || organizations.length === 0) return
    setOrganizationId(
      (organizations.find((o) => o.active) ?? organizations[0])!.id
    )
  }, [organizations, organizationId])

  const activeOrgId = organizations.find((o) => o.active)?.id
  // Workspace choices are only known for the organization currently active in
  // this session (GET /workspaces always lists the active organization's
  // workspaces) — for any other organization, the token is left unpinned to
  // a specific workspace (defaults to that organization's active workspace).
  const workspaceChoices =
    organizationId === activeOrgId ? activeOrgWorkspaces : []

  const load = useCallback(() => {
    setLoading(true)
    fetchApiTokens()
      .then(setTokens)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function resolveExpiresAt(): number | undefined {
    if (expiryPreset === null) return undefined
    if (expiryPreset === -1) {
      if (!customDate) return undefined
      const ts = Math.floor(new Date(customDate).getTime() / 1000)
      return isNaN(ts) ? undefined : ts
    }
    return Math.floor(Date.now() / 1000) + expiryPreset * 86400
  }

  async function handleCreate() {
    if (!newName.trim() || !organizationId) return
    setCreating(true)
    setError(null)
    try {
      const expiresAt = resolveExpiresAt()
      const data = await createApiToken(
        newName.trim(),
        organizationId,
        workspaceId || null,
        expiresAt
      )
      setCreated(data)
      setVisible(true)
      setNewName("")
      setWorkspaceId("")
      setExpiryPreset(null)
      setCustomDate("")
      setShowNew(false)
      setTokens((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          user_id: data.user_id,
          created_at: data.created_at,
          last_used_at: null,
          expires_at: data.expires_at,
        },
      ])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteApiToken(id)
      setTokens((prev) => prev.filter((t) => t.id !== id))
      if (created?.id === id) setCreated(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleCopy(value: string, id: number | string) {
    await navigator.clipboard.writeText(value)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const maskedToken = created?.token
    ? created.token.slice(0, 8) + "•".repeat(24) + created.token.slice(-8)
    : null

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split("T")[0]!

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted-foreground">
        Tokens personnels pour s&apos;authentifier sur l&apos;API REST et le
        serveur MCP (Claude Code, agents IA).
      </p>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {created && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
            Copiez ce token maintenant — il ne sera plus affiché.
          </p>
          <div className="relative">
            <Input
              readOnly
              value={visible ? created.token : (maskedToken ?? "")}
              className="bg-white pr-16 font-mono text-xs dark:bg-black/20"
            />
            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5">
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                title={visible ? "Masquer" : "Afficher"}
              >
                {visible ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(created.token, "new")}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                title="Copier"
              >
                {copiedId === "new" ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="rounded border border-border bg-muted/60 px-3 py-2">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              Configuration Claude Code
            </p>
            <code className="text-[11px] break-all text-foreground">
              {`claude mcp add archimate-vercel ${process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? "https://archispark-mcp-server.vercel.app/mcp/"} --transport http --header "Authorization: Bearer ${created.token}"`}
            </code>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {loading ? (
          <p className="text-[13px] text-muted-foreground">Chargement…</p>
        ) : tokens.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Aucun token.</p>
        ) : (
          tokens.map((t) => {
            const expiry = formatExpiry(t.expires_at)
            return (
              <div
                key={t.id}
                className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Créé le{" "}
                    {new Date(t.created_at * 1000).toLocaleDateString("fr-FR")}
                    {t.last_used_at
                      ? ` · Utilisé le ${new Date(t.last_used_at * 1000).toLocaleDateString("fr-FR")}`
                      : " · Jamais utilisé"}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] ${
                    expiry.expired
                      ? "text-destructive"
                      : expiry.urgent
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {expiry.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  title="Supprimer ce token"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {showNew ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="token-name" className="text-[13px]">
                Nom du token
              </Label>
              <Input
                id="token-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") {
                    setShowNew(false)
                    setNewName("")
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
                  setOrganizationId(e.target.value)
                  setWorkspaceId("")
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
                onChange={(e) => setWorkspaceId(e.target.value)}
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
                    onClick={() => setExpiryPreset(p.days)}
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
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="mt-2 w-40"
                />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !organizationId}
            >
              {creating ? "…" : "Créer"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowNew(false)
                setNewName("")
                setExpiryPreset(null)
                setCustomDate("")
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowNew(true)}>
          <Plus className="size-3.5" />
          Nouveau token
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = "info" | "tokens"

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Informations personnelles" },
  { id: "tokens", label: "Tokens API" },
]

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("info")

  return (
    <div className="max-w-2xl p-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Mon profil</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Gérez vos informations personnelles et vos accès.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-0 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] transition-colors ${
              tab === t.id
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab />}
      {tab === "tokens" && <TokensTab />}
    </div>
  )
}
