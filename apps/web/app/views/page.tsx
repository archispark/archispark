"use client"

import { useEffect, useState, useCallback, useMemo } from "react" // eslint-disable-line
import { fetchViews, createView, deleteView, type ViewOut } from "@/lib/api"
import { useViewpoints } from "@/lib/queries"
import { useFormModal } from "@/hooks/use-form-modal"
import { useViewColumns } from "@/components/view-columns"
import { CreateViewDialog, DeleteViewDialog } from "@/components/view-dialogs"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { useT } from "@/lib/i18n"
import { DataTable } from "@/components/data-table"

export default function ViewsPage() {
  const { t } = useT()
  // Every workspace has exactly one owner (the authenticated user) — always write-enabled.
  const isAdmin = true
  const { data: viewpoints = [] } = useViewpoints()
  const [views, setViews] = useState<ViewOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState("")
  const [viewpoint, setViewpoint] = useState("")
  const [doc, setDoc] = useState("")

  const [createModal, createActions] = useFormModal<null>()
  const [pendingDeleteView, setPendingDeleteView] = useState<ViewOut | null>(
    null
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    fetchViews()
      .then(setViews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useKeyboardShortcut(
    "n",
    () => {
      if (isAdmin) openCreate()
    },
    { enabled: !createModal.open }
  )

  function openCreate() {
    setName("")
    setViewpoint("")
    setDoc("")
    createActions.openNew()
  }

  async function handleCreate() {
    if (!name.trim()) return
    await createActions.run(async () => {
      await createView({
        name: name.trim(),
        viewpoint: viewpoint || null,
        documentation: doc.trim() || null,
      })
      reload()
    })
  }

  async function handleBulkDelete(rows: ViewOut[]) {
    await Promise.all(rows.map((v) => deleteView(v.identifier)))
    reload()
  }

  async function handleDeleteSingle() {
    if (!pendingDeleteView) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await deleteView(pendingDeleteView.identifier)
      setPendingDeleteView(null)
      reload()
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "conflict">(
    "all"
  )

  const viewStats = useMemo(() => {
    let ok = 0,
      conflict = 0
    for (const v of views) {
      if (v.conflict_count > 0) conflict++
      else if (v.connection_count > 0) ok++
    }
    return { ok, conflict }
  }, [views])

  const filteredViews = useMemo(() => {
    if (statusFilter === "all") return views
    if (statusFilter === "ok")
      return views.filter((v) => v.conflict_count === 0)
    return views.filter((v) => v.conflict_count > 0)
  }, [views, statusFilter])

  const viewColumns = useViewColumns({
    isAdmin,
    onDeleteClick: setPendingDeleteView,
  })

  if (loading && views.length === 0) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
        {t("common.loading")}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("common.error")} : {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("views.title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t("views.count", {
              n: views.length,
              s: views.length !== 1 ? "s" : "",
            })}
          </p>
        </div>
        {isAdmin && (
          <CreateViewDialog
            modal={createModal}
            actions={createActions}
            onOpenCreate={openCreate}
            name={name}
            onNameChange={setName}
            viewpoint={viewpoint}
            onViewpointChange={setViewpoint}
            viewpoints={viewpoints}
            doc={doc}
            onDocChange={setDoc}
            onCreate={handleCreate}
          />
        )}
      </div>

      {views.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="mb-3.5 text-[40px]">📭</div>
          <p className="text-sm">{t("views.empty")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            {(["all", "ok", "conflict"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${statusFilter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}
              >
                {f === "all"
                  ? t("common.all")
                  : f === "ok"
                    ? t("common.ok")
                    : t("common.conflicts")}
              </button>
            ))}
          </div>
          <DataTable
            columns={viewColumns}
            data={filteredViews}
            pageSize={10}
            searchable
            searchPlaceholder={t("views.search")}
            initialSorting={[{ id: "status", desc: true }]}
            selectable={isAdmin}
            onBulkDelete={isAdmin ? handleBulkDelete : undefined}
            getRowId={(row) => row.identifier}
            footerStats={
              <>
                <span className="text-emerald-600">
                  {viewStats.ok} {t("common.ok")}
                </span>
                {viewStats.conflict > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-destructive">
                      {viewStats.conflict} {t("common.conflicts").toLowerCase()}
                    </span>
                  </>
                )}
              </>
            }
            renderSubRow={(row) => {
              const { ok_count, conflict_count } = row.original
              return (
                <div className="flex items-center gap-2 py-0.5 text-[12px] text-muted-foreground">
                  <span className="font-medium">Relations :</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-700">
                      ✓
                    </span>
                    <span className="font-medium text-emerald-700">
                      {ok_count} valide{ok_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-destructive/15 text-[10px] text-destructive">
                      ✕
                    </span>
                    <span
                      className={
                        conflict_count > 0 ? "font-medium text-destructive" : ""
                      }
                    >
                      {conflict_count} conflit{conflict_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
              )
            }}
          />
        </>
      )}

      <DeleteViewDialog
        view={pendingDeleteView}
        onOpenChange={(o) => {
          if (!o) {
            setPendingDeleteView(null)
            setDeleteError(null)
          }
        }}
        error={deleteError}
        deleting={deleteLoading}
        onConfirm={handleDeleteSingle}
      />
    </div>
  )
}
