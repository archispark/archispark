"use client"

import { useState, useEffect, useCallback } from "react"
import { useOrganizations, useWorkspaces } from "@/lib/queries"
import {
  fetchApiTokens,
  createApiToken,
  deleteApiToken,
  type ApiTokenOut,
  type ApiTokenCreatedOut,
} from "@/lib/api"
import { TokenRevealCard } from "@/components/profile-token-reveal"
import { TokenList } from "@/components/profile-token-list"
import { TokenCreateForm } from "@/components/profile-token-create-form"

export function TokensTab() {
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
        <TokenRevealCard
          created={created}
          visible={visible}
          onToggleVisible={() => setVisible((v) => !v)}
          copiedId={copiedId}
          onCopy={handleCopy}
        />
      )}

      <TokenList tokens={tokens} loading={loading} onDelete={handleDelete} />

      <TokenCreateForm
        show={showNew}
        onShowChange={setShowNew}
        name={newName}
        onNameChange={setNewName}
        organizationId={organizationId}
        onOrganizationChange={setOrganizationId}
        organizations={organizations}
        workspaceId={workspaceId}
        onWorkspaceChange={setWorkspaceId}
        workspaceChoices={workspaceChoices}
        expiryPreset={expiryPreset}
        onExpiryPresetChange={setExpiryPreset}
        customDate={customDate}
        onCustomDateChange={setCustomDate}
        creating={creating}
        onCreate={handleCreate}
      />
    </div>
  )
}
