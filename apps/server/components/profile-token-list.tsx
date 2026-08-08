"use client"

import { Trash2 } from "lucide-react"
import { type ApiTokenOut } from "@/lib/api"

export function formatExpiry(ts: number | null): {
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

export function TokenList({
  tokens,
  loading,
  onDelete,
}: {
  tokens: ApiTokenOut[]
  loading: boolean
  onDelete: (id: number) => void
}) {
  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Chargement…</p>
  }
  if (tokens.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Aucun token.</p>
  }
  return (
    <div className="space-y-1">
      {tokens.map((t) => {
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
              onClick={() => onDelete(t.id)}
              className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              title="Supprimer ce token"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
