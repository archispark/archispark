"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FolderOpen, Plus, Check } from "lucide-react"
import {
  useWorkspaces,
  useCreateWorkspace,
  useActivateWorkspace,
} from "@/lib/queries"
import { useT } from "@/lib/i18n"
import { ModelImportDropzone } from "@/components/model-import-dropzone"

export default function WorkspacesPage() {
  const { t } = useT()
  const router = useRouter()
  const { data: workspaces = [], isLoading } = useWorkspaces()
  const createWs = useCreateWorkspace()
  const activateWs = useActivateWorkspace()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return
    try {
      const ws = await createWs.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      if (!ws.active) await activateWs.mutateAsync(ws.id)
      setName("")
      setDescription("")
      setShowForm(false)
      setError(null)
      router.push("/")
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Click a workspace to enter it: activate it (unless already active) and open
  // its overview.
  async function enter(id: string, active: boolean) {
    try {
      if (!active) await activateWs.mutateAsync(id)
      setError(null)
      router.push("/")
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="max-w-3xl p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <FolderOpen className="size-5 text-primary" />
            {t("breadcrumb.workspaces")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("workspaces.subtitle")}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true)
              setError(null)
            }}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-[13px] text-primary-foreground hover:bg-indigo-700"
          >
            <Plus className="size-4" />
            {t("common.add")}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-5 flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
          <input
            autoFocus
            placeholder={t("nav.workspace_name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create()
              if (e.key === "Escape") setShowForm(false)
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
          <textarea
            placeholder={t("common.optional_desc")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowForm(false)
            }}
            rows={2}
            className="resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={createWs.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {t("common.create")}
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setError(null)
              }}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="mb-5">
        <ModelImportDropzone />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
          {t("common.loading")}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <FolderOpen className="mx-auto mb-3 size-8 text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">
            {t("workspaces.empty_title")}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("workspaces.empty_desc")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              role="button"
              tabIndex={0}
              onClick={() => enter(ws.id, ws.active)}
              onKeyDown={(e) => {
                if (e.key === "Enter") enter(ws.id, ws.active)
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/50 ${
                ws.active ? "border-primary/50" : "border-border"
              }`}
            >
              <FolderOpen
                className={`size-4 shrink-0 ${ws.active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`flex-1 truncate text-[14px] ${ws.active ? "font-medium text-foreground" : "text-foreground"}`}
              >
                {ws.name}
              </span>
              {ws.active && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                  <Check className="size-3.5" />
                  {t("nav.workspace_active")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
